import "server-only";
import { createClient } from "@/lib/supabase/server";
import { manilaTimestamp } from "@/lib/utils";
import { MIN_SAMPLES_FOR_P95, minutesBetween, summariseDurations, type DurationSummary } from "@/lib/durations";

export interface AgencyResolution {
  agencyId: string;
  // null when the agency's name couldn't be read; the page says so.
  name: string | null;
  // Closed in the month with any outcome except out of scope.
  resolved: number;
  // Closed in the month as out of scope: sent back, not fixed.
  returned: number;
  // From the routing to the resolution, over the resolved ones only.
  time: DurationSummary;
}

export interface ResolutionTimesData {
  month: string; // YYYY-MM in Manila — the month shown
  currentMonth: string; // YYYY-MM in Manila — the latest month that can be picked
  agencies: AgencyResolution[];
  minSamplesForP95: number;
  limit: number;
  capped: boolean;
  loadFailed: boolean;
}

interface RoutingRow {
  agency_id: string;
  created_at: string;
  routed_at: string | null;
  resolved_at: string | null;
  resolution_outcome: string | null;
}

// Far above a barangay's monthly volume. Reaching it is reported, not hidden.
const ROW_LIMIT = 2000;
const MONTH_SHAPE = /^(\d{4})-(\d{2})$/;

/**
 * The paper's Monthly Resolution-Time Distribution by Agency (#16, Table
 * p.146): for every agency routing of this barangay's reports closed in the
 * chosen Manila month, the median and 95th-percentile time from the routing
 * to the resolution, per agency.
 *
 * agency_routing has no barangay column. ar_select_barangay, the policy that
 * lets the queue show agency progress, returns only rows of the official's
 * own barangay's reports, and that is the scope here, as in the queue's
 * Routed to agencies list.
 *
 * Out-of-scope closures are counted apart and kept out of the timing, as on
 * the city's Agency response page: sending a report back is not fixing it.
 * Only agency and time columns are read; nothing names a person.
 */
export async function getMonthlyResolutionTimes(requestedMonth: string | undefined): Promise<ResolutionTimesData> {
  const currentMonth = manilaMonth(new Date());
  const month = resolveMonth(requestedMonth, currentMonth);
  const start = `${month}-01T00:00:00+08:00`;
  const end = `${nextMonth(month)}-01T00:00:00+08:00`;
  const empty = (loadFailed: boolean): ResolutionTimesData => ({
    month,
    currentMonth,
    agencies: [],
    minSamplesForP95: MIN_SAMPLES_FOR_P95,
    limit: ROW_LIMIT,
    capped: false,
    loadFailed,
  });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("agency_routing")
    .select("agency_id, created_at, routed_at, resolved_at, resolution_outcome")
    .gte("resolved_at", new Date(start).toISOString())
    .lt("resolved_at", new Date(end).toISOString())
    .limit(ROW_LIMIT);

  if (error || !data) {
    console.error("[resolution-times] load failed", error?.code, error?.message);
    return empty(true);
  }

  const rows = data as RoutingRow[];
  const byAgency = new Map<string, RoutingRow[]>();
  for (const r of rows) byAgency.set(r.agency_id, [...(byAgency.get(r.agency_id) ?? []), r]);

  const names = new Map<string, string | null>();
  if (byAgency.size > 0) {
    const { data: agencies, error: namesError } = await supabase
      .from("agencies")
      .select("id, name")
      .in("id", [...byAgency.keys()]);
    if (namesError) console.error("[resolution-times] agency names failed", namesError.code, namesError.message);
    for (const a of (agencies ?? []) as { id: string; name: string | null }[]) names.set(a.id, a.name?.trim() || null);
  }

  const agencies = [...byAgency].map(([agencyId, group]): AgencyResolution => {
    const times: number[] = [];
    let resolved = 0;
    let returned = 0;
    for (const r of group) {
      if (r.resolution_outcome === "out-of-scope") {
        returned += 1;
        continue;
      }
      // Closed by CDRRMO's rejection of the report (CDRRMO dispatch), not by
      // the agency: neither a resolution nor a return.
      if (r.resolution_outcome === "rejected") continue;
      resolved += 1;
      const minutes = minutesBetween(r.routed_at ?? r.created_at, r.resolved_at);
      if (minutes !== null) times.push(minutes);
    }
    return { agencyId, name: names.get(agencyId) ?? null, resolved, returned, time: summariseDurations(times) };
  });

  agencies.sort(
    (a, b) => b.resolved - a.resolved || b.returned - a.returned || (a.name ?? "￿").localeCompare(b.name ?? "￿")
  );

  return { ...empty(false), agencies, capped: rows.length === ROW_LIMIT };
}

// The Manila calendar month of an instant, as YYYY-MM.
function manilaMonth(instant: Date): string {
  return manilaTimestamp(instant.toISOString()).slice(0, 7);
}

function nextMonth(month: string): string {
  const [, y, m] = MONTH_SHAPE.exec(month) as RegExpExecArray;
  const year = Number(y) + (m === "12" ? 1 : 0);
  const next = m === "12" ? 1 : Number(m) + 1;
  return `${year}-${String(next).padStart(2, "0")}`;
}

/**
 * The month to show. Anything that isn't a real month falls back to the
 * current one, and so does a future one.
 */
export function resolveMonth(requested: string | undefined, currentMonth: string): string {
  const match = requested ? MONTH_SHAPE.exec(requested) : null;
  if (!match) return currentMonth;
  const month = Number(match[2]);
  if (Number(match[1]) < 2000 || month < 1 || month > 12) return currentMonth;
  return (requested as string) > currentMonth ? currentMonth : (requested as string);
}
