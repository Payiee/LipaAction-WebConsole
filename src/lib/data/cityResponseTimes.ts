import "server-only";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel, startOfManilaDay } from "@/lib/utils";
import { MIN_SAMPLES_FOR_P95, minutesBetween, summariseDurations as summarise, type DurationSummary } from "@/lib/durations";

// Re-exported for the page, which imports its types from here.
export type { DurationSummary };

export interface AgencyResponse {
  agencyId: string;
  // null when the agency's name couldn't be read; the page says so.
  name: string | null;
  routed: number;
  // Neither acknowledged nor closed yet.
  awaitingAcknowledgement: number;
  // Being worked on now: marked in progress and not closed.
  inProgress: number;
  // Closed with any outcome except out of scope.
  resolved: number;
  // Closed as out of scope: sent back, not fixed.
  returned: number;
  toAcknowledge: DurationSummary;
  toResolve: DurationSummary;
  // The same two clocks per report category (display label), for the
  // paper's agency-by-category grids. Empty when the categories couldn't be
  // read (CityResponseData.categoriesUnavailable).
  byCategory: Record<string, CategoryCell>;
}

export interface CategoryCell {
  routed: number;
  toAcknowledge: DurationSummary;
  toResolve: DurationSummary;
}

export interface CityResponseData {
  windowDays: number;
  since: string; // ISO instant the window starts
  agencies: AgencyResponse[];
  // Every category that appears in the window, sorted, for the grids' columns.
  categories: string[];
  // True when the reports' categories couldn't be read: the grids are left
  // out, and the per-agency table stands on its own.
  categoriesUnavailable: boolean;
  minSamplesForP95: number;
  limit: number;
  capped: boolean;
  loadFailed: boolean;
}

interface RoutingRow {
  incident_report_id: string;
  agency_id: string;
  created_at: string;
  routed_at: string | null;
  acknowledged_at: string | null;
  in_progress_at: string | null;
  resolved_at: string | null;
  resolution_outcome: string | null;
}

const WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const ROW_LIMIT = 5000;
// Ids per category lookup: they travel in the URL.
const ID_CHUNK = 100;

/**
 * The paper's Per-Agency Response Time view (A.5.2): for every routing in
 * the last 30 Manila days, how long each agency took to acknowledge it, and
 * how long from acknowledgement to resolution.
 *
 * The paper times acknowledgement from the auto-route. Automatic routing is
 * off, so every routing here is a desk's, and the clock starts when the
 * agency row was written (routed_at, or created_at where that is empty).
 * Out-of-scope closures are counted apart and kept out of the resolution
 * time: sending a report back is not fixing it.
 *
 * Only agency and time columns are read. agency_routing names no reporter,
 * and routed_by / supervisor_approved_by, which name officials, are left out.
 */
export async function getCityResponseTimes(): Promise<CityResponseData> {
  const since = new Date(startOfManilaDay().getTime() - (WINDOW_DAYS - 1) * DAY_MS).toISOString();
  const empty = (loadFailed: boolean): CityResponseData => ({
    windowDays: WINDOW_DAYS,
    since,
    agencies: [],
    categories: [],
    categoriesUnavailable: false,
    minSamplesForP95: MIN_SAMPLES_FOR_P95,
    limit: ROW_LIMIT,
    capped: false,
    loadFailed,
  });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("agency_routing")
    .select("incident_report_id, agency_id, created_at, routed_at, acknowledged_at, in_progress_at, resolved_at, resolution_outcome")
    .gte("created_at", since)
    .limit(ROW_LIMIT);

  if (error || !data) {
    console.error("[city-response] load failed", error?.code, error?.message);
    return empty(true);
  }

  const rows = data as RoutingRow[];
  const byAgency = new Map<string, { rows: RoutingRow[] }>();
  for (const r of rows) {
    const group = byAgency.get(r.agency_id) ?? { rows: [] };
    group.rows.push(r);
    byAgency.set(r.agency_id, group);
  }

  const names = new Map<string, string | null>();
  if (byAgency.size > 0) {
    const { data: agencies, error: namesError } = await supabase
      .from("agencies")
      .select("id, name")
      .in("id", [...byAgency.keys()]);
    if (namesError) console.error("[city-response] agency names failed", namesError.code, namesError.message);
    for (const a of (agencies ?? []) as { id: string; name: string | null }[]) names.set(a.id, a.name);
  }

  // Each routed report's category, read from the reports themselves. A
  // failure costs only the grids.
  const reportIds = [...new Set(rows.map((r) => r.incident_report_id))];
  const categoryOf = new Map<string, string>();
  let categoriesUnavailable = false;
  for (let i = 0; i < reportIds.length && !categoriesUnavailable; i += ID_CHUNK) {
    const { data: reports, error: categoriesError } = await supabase
      .from("incident_reports")
      .select("id, category")
      .in("id", reportIds.slice(i, i + ID_CHUNK));
    if (categoriesError) {
      console.error("[city-response] categories failed", categoriesError.code, categoriesError.message);
      categoriesUnavailable = true;
      break;
    }
    for (const r of (reports ?? []) as { id: string; category: string | null }[]) {
      // A report without a category stays out of the grids rather than
      // inventing a column for it.
      if (typeof r.category === "string" && r.category.trim()) categoryOf.set(r.id, categoryLabel(r.category));
    }
  }
  if (categoriesUnavailable) categoryOf.clear();

  const agencies = [...byAgency].map(([agencyId, { rows: group }]): AgencyResponse => {
    const toAcknowledge: number[] = [];
    const toResolve: number[] = [];
    const perCategory = new Map<string, { routed: number; ack: number[]; fix: number[] }>();
    let awaitingAcknowledgement = 0;
    let inProgress = 0;
    let resolved = 0;
    let returned = 0;

    for (const r of group) {
      const outOfScope = r.resolution_outcome === "out-of-scope";
      // Closed by CDRRMO's rejection of the report (CDRRMO dispatch), not by
      // the agency: counted as neither resolved nor returned, and no time to
      // resolve.
      const withdrawn = r.resolution_outcome === "rejected";
      // An agency may mark a report in progress without acknowledging it
      // first; it is being worked on, so it isn't waiting either.
      if (!r.acknowledged_at && !r.in_progress_at && !r.resolved_at) awaitingAcknowledgement += 1;
      if (r.in_progress_at && !r.resolved_at) inProgress += 1;
      if (r.resolved_at && !withdrawn) {
        if (outOfScope) returned += 1;
        else resolved += 1;
      }
      const ack = minutesBetween(r.routed_at ?? r.created_at, r.acknowledged_at);
      if (ack !== null) toAcknowledge.push(ack);
      const fix = outOfScope || withdrawn ? null : minutesBetween(r.acknowledged_at, r.resolved_at);
      if (fix !== null) toResolve.push(fix);

      const category = categoryOf.get(r.incident_report_id);
      if (category) {
        const cell = perCategory.get(category) ?? { routed: 0, ack: [], fix: [] };
        cell.routed += 1;
        if (ack !== null) cell.ack.push(ack);
        if (fix !== null) cell.fix.push(fix);
        perCategory.set(category, cell);
      }
    }

    return {
      agencyId,
      name: names.get(agencyId) ?? null,
      routed: group.length,
      awaitingAcknowledgement,
      inProgress,
      resolved,
      returned,
      toAcknowledge: summarise(toAcknowledge),
      toResolve: summarise(toResolve),
      byCategory: Object.fromEntries(
        [...perCategory].map(([category, cell]) => [
          category,
          { routed: cell.routed, toAcknowledge: summarise(cell.ack), toResolve: summarise(cell.fix) },
        ])
      ),
    };
  });

  agencies.sort(
    (a, b) => b.routed - a.routed || (a.name ?? "￿").localeCompare(b.name ?? "￿")
  );

  const categories = [...new Set(categoryOf.values())].sort((a, b) => a.localeCompare(b));
  return { ...empty(false), agencies, categories, categoriesUnavailable, capped: rows.length === ROW_LIMIT };
}
