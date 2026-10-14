import "server-only";
import { createClient } from "@/lib/supabase/server";
import { loadPositions } from "@/lib/data/positions";
import {
  partyDecisionsByReport,
  readCdrrmoDispatchEnabled,
  REPORT_VALIDATIONS_DECISIONS_SELECT,
  type PartyDecisions,
} from "@/lib/cdrrmo-dispatch";
import { isRejectedByCdrrmo } from "@/components/queue/routing";
import { categoryLabel, distinctCategories, medianAgeMinutes, reporterLabel, startOfManilaDay, timeAgo } from "@/lib/utils";
import type { AgencyRouting, KpiSummary, QueueReport, QueueTabId, RoutingOption, RoutingPlanEntry, SituationCluster, ReportPosition } from "@/types";

// Statuses that still belong in an active working queue. Anything past this
// (validated/routed/resolved/rejected) has already been acted on.
const PENDING_STATUSES = ["pending_priority", "prioritized"];

// Past validation, handed to agencies. Nothing moves a report here on its
// own — routing is a manual barangay action (see routeReport).
const DOWNSTREAM_STATUSES = ["routed", "resolved"];

// Every status a positively reviewed report can be in. A report validated
// this morning and routed this afternoon still counts toward [Validated
// today]; counting only status = 'validated' would make routing a report
// subtract it from the tile.
const VALIDATED_OR_LATER = ["validated", ...DOWNSTREAM_STATUSES];

// With CDRRMO dispatch on, CDRRMO can reject a report after it was routed
// (backend spec 3.4, owner Q10). Such a report stays in the routed half of
// Recent validated, marked [Rejected by CDRRMO], so the desk sees what
// became of a report it routed. Only while the switch is on: with it off,
// the routed half is exactly what it was.
const DOWNSTREAM_WITH_CDRRMO_REJECTS = [...DOWNSTREAM_STATUSES, "rejected"];

// The routed half of the Recent validated tab is a glance at what just
// happened, not a history; Validation History is the full record. The
// awaiting-routing half is NOT capped — it is a to-do list, and a validated
// report that fell off the end of a capped list would be a dead end nobody
// could see.
const RECENT_ROUTED_LIMIT = 20;

// How the routed half is picked: the newest agency_routing rows, then the
// reports behind them. A report has one row per agency (two or three is
// usual), so this many rows covers the last 20 routings with room for reports
// that turn out to be validated again. The candidates are capped too, since
// they go into one PostgREST in.() list.
const RECENT_ROUTING_ROWS = 120;
const RECENT_ROUTED_CANDIDATES = 60;

const REPORT_COLUMNS =
  "id, category, description, priority_name, status, entry_tier, identity_withheld, created_at, cluster_id, reviewed_at, severity_self_rating, safety_net_confirmation, anyone_hurt, is_ongoing, has_photo, has_video, discreet_reporting, priority_class, priority_score, confidence_band, sub_category";

interface RawReport {
  id: string;
  category: string;
  description: string | null;
  priority_name: "Low" | "Medium" | "High" | "Critical" | null;
  status: string;
  entry_tier: "emergency" | "other_reports";
  identity_withheld: boolean;
  created_at: string;
  cluster_id: string | null;
  reviewed_at: string | null;
  // Detail-drawer fields. Fetched with the list rather than on demand: the
  // whole set is one row that RLS already allows, so a second per-report
  // round trip would buy nothing.
  severity_self_rating: string | null;
  safety_net_confirmation: string | null;
  anyone_hurt: string | null;
  is_ongoing: boolean | null;
  has_photo: boolean;
  has_video: boolean;
  discreet_reporting: boolean;
  priority_class: number | null;
  priority_score: number | null;
  confidence_band: string | null;
  // Other-reports only (the backend's October push); null on every
  // emergency and on everything filed before it.
  sub_category: string | null;
}

interface RawRouting {
  incident_report_id: string;
  agency_id: string;
  is_primary: boolean;
  auto_routed: boolean | null;
  routed_at: string | null;
  acknowledged_at: string | null;
  in_progress_at: string | null;
  resolved_at: string | null;
  resolution_outcome: AgencyRouting["resolutionOutcome"];
}

interface RawMapping {
  category_key: string;
  agency_id: string;
  is_primary: boolean;
  sort_order: number | null;
}

// What toQueueReport needs beyond the report row itself. Pending reports get
// the empty default: routing doesn't apply to them yet.
interface RoutingExtras {
  routing: AgencyRouting[];
  routingPlan: RoutingPlanEntry[] | null;
  routingOptions: RoutingOption[] | null;
}

const NO_ROUTING: RoutingExtras = { routing: [], routingPlan: null, routingOptions: null };

// A report whose position was never looked up reads as unavailable, never as
// [no location sent], which would be a claim about the report.
const UNKNOWN_POSITION: ReportPosition = { kind: "unavailable" };

export interface QueueData {
  kpiSummary: KpiSummary;
  activeCluster: SituationCluster | null;
  // Every duplicate group, largest first; activeCluster is the first of them.
  // The Flagged duplicates tab shows each one with its own header and action.
  duplicateClusters: SituationCluster[];
  queueByTab: Record<QueueTabId, QueueReport[]>;
  queueTabMeta: { id: QueueTabId; label: string; count: number }[];
  // The backend's CDRRMO dispatch switch, read once for this page load
  // (src/lib/cdrrmo-dispatch.ts); false on any doubt. While false, nothing on
  // the page differs from the console before CDRRMO dispatch.
  cdrrmoDispatch: boolean;
  // CDRRMO, which CDRRMO dispatch always notifies; named in the Validate
  // confirmation. null while the switch is off, or if it couldn't be read.
  cdrrmoAgency: RoutingOption | null;
  // True when the queries failed and the empty shape above is a fallback,
  // not the truth. The page must say so — an outage rendered as [No reports
  // in this queue right now] is the one message an emergency console must
  // never show by accident.
  loadFailed: boolean;
  // The pending list loaded but part of Recent validated didn't. That tab
  // says so instead of showing a partial list as if it were complete.
  validatedUnavailable: boolean;
}

/**
 * Fetches and shapes this barangay's incident_reports into everything the
 * Queue page needs: the 4 tabs (Emergency/Standard/Duplicates/Validated —
 * "Recall window" was dropped, no backend concept for it), KPI counts, and
 * an "active cluster" banner when duplicate reports are grouped together.
 *
 * RLS already scopes incident_reports to the signed-in official's barangay —
 * the .eq() below is belt-and-suspenders, not the actual security boundary.
 */
export async function getBarangayQueue(
  barangayId: string,
  barangayName: string
): Promise<QueueData> {
  const supabase = createClient();

  // Narrow queries rather than one wide one. This used to select every
  // report the barangay had ever filed and partition by status in JS — fine
  // at one report, thousands of rows per page load after a year in service.
  // Pending and awaiting-routing are to-do lists and stay uncapped (their
  // size is the backlog itself); recently routed is capped; today's count is
  // a HEAD request that returns no rows at all.
  const dayStart = startOfManilaDay().toISOString();
  const [pendingRes, awaitingRes, recentRes, todayRes, cdrrmoDispatch] = await Promise.all([
    supabase
      .from("incident_reports")
      .select(REPORT_COLUMNS)
      .eq("incident_barangay_id", barangayId)
      .in("status", PENDING_STATUSES)
      // The backend owner's ranking (2026-09-11): highest score first, then
      // longest-waiting first, unscored reports last. Oldest-first within a
      // score is what a 5-minute SLA wants — the report closest to breaching
      // leads — and it is what [Validate next] lands on. This used to be
      // newest-first, which buried the report that had waited longest.
      .order("priority_score", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("incident_reports")
      .select(REPORT_COLUMNS)
      .eq("incident_barangay_id", barangayId)
      .eq("status", "validated")
      // nullsFirst: false — pre-cutover rows have no reviewed_at and would
      // otherwise float to the top of a newest-first list.
      .order("reviewed_at", { ascending: false, nullsFirst: false }),
    // The routed half is picked by routing time, from the newest
    // agency_routing rows. incident_reports has no routing time of its own,
    // and ordering it by review time sank two kinds of report below the cap:
    // one routed long after it was validated, and one routed automatically,
    // which is never reviewed at all. created_at is when the row was written,
    // which is when that agency was sent the report. agency_routing has no
    // barangay column; row-level security (ar_select_barangay) scopes it.
    supabase
      .from("agency_routing")
      .select("incident_report_id, created_at")
      .order("created_at", { ascending: false, nullsFirst: false })
      .limit(RECENT_ROUTING_ROWS),
    // Pre-cutover rows (reviewed_at IS NULL) fall out of a >= comparison on
    // their own, which is the intended exclusion: there's no knowing what
    // day they were handled.
    supabase
      .from("incident_reports")
      .select("id", { count: "exact", head: true })
      .eq("incident_barangay_id", barangayId)
      .in("status", VALIDATED_OR_LATER)
      .gte("reviewed_at", dayStart),
    readCdrrmoDispatchEnabled(supabase),
  ]);

  // Only the pending list takes the page down. It IS the emergency console;
  // the other three are secondary, and a failure in any of them used to
  // replace a working list of live emergencies with an outage banner. Each
  // now degrades only its own part, logged under its own name — a HEAD count
  // that fails has no error code, so the log has to say which query it was.
  if (pendingRes.error || !pendingRes.data) {
    // Fail closed to an empty queue rather than crashing the whole page on a
    // transient query error — but say so in the returned data, and put the
    // real reason in the server log, where table and column names belong.
    console.error("[queue] pending load failed", pendingRes.status, pendingRes.error?.code, pendingRes.error?.message);
    return failedQueueData();
  }
  for (const [part, res] of [["awaiting-routing", awaitingRes], ["recent-routings", recentRes], ["validated-today", todayRes]] as const) {
    if (res.error) console.error(`[queue] ${part} failed`, res.status, res.error.code, res.error.message);
  }

  const pending = pendingRes.data as RawReport[];
  const awaiting = (awaitingRes.error ? [] : awaitingRes.data ?? []) as RawReport[];
  const { routed, failed: routedFailed } = recentRes.error
    ? { routed: [], failed: true }
    : await loadRecentlyRouted(
        supabase,
        barangayId,
        (recentRes.data ?? []) as { incident_report_id: string }[],
        cdrrmoDispatch ? DOWNSTREAM_WITH_CDRRMO_REJECTS : DOWNSTREAM_STATUSES
      );
  const validatedUnavailable = Boolean(awaitingRes.error) || routedFailed;

  // With CDRRMO dispatch on, two more reads, each failing soft to the
  // console's behaviour without them: who decided on the Recent validated
  // reports (report_validations), and today's barangay validations.
  const [routingExtras, positions, cdrrmoAgency, decisions, barangayToday] = await Promise.all([
    loadRouting(supabase, pending, awaiting, routed),
    loadPositions(supabase, [...pending, ...awaiting, ...routed], "queue"),
    cdrrmoDispatch ? loadCdrrmoAgency(supabase) : Promise.resolve(null),
    // Routed reports only: the decisions decide whether the desk may record
    // its validation of a routed report; an awaiting one never needs them.
    cdrrmoDispatch ? loadPartyDecisions(supabase, routed.map((r) => r.id)) : Promise.resolve(null),
    cdrrmoDispatch ? countBarangayValidationsSince(supabase, barangayId, dayStart) : Promise.resolve(null),
  ]);
  const positionOf = (r: RawReport) => positions.get(r.id) ?? UNKNOWN_POSITION;
  // Only routed reports had their decisions read; an awaiting one carries
  // null (not read), never an empty decision pair.
  const routedIds = new Set(routed.map((r) => r.id));
  const decisionsOf = (r: RawReport) =>
    decisions && routedIds.has(r.id) ? decisions.get(r.id) ?? { barangay: null, cdrrmo: null } : null;

  const emergency = pending
    .filter((r) => r.entry_tier === "emergency")
    .map((r) => toQueueReport(r, routingExtras.get(r.id), positionOf(r)));
  const standard = pending
    .filter((r) => r.entry_tier === "other_reports")
    .map((r) => toQueueReport(r, routingExtras.get(r.id), positionOf(r)));
  // Awaiting routing first: those still need someone to act. Routed ones
  // are there to show what the agencies have done since.
  const validated = [...awaiting, ...routed]
    .map((r) => toQueueReport(r, routingExtras.get(r.id), positionOf(r), decisionsOf(r)))
    // A rejected report is here only when CDRRMO rejected it after it was
    // routed. One rejected some other way (say, at the desk after a recall)
    // left the queue when it was rejected, as every rejection does.
    .filter((r) => r.details.status !== "rejected" || isRejectedByCdrrmo(r.details.status, r.details.routing));

  // Duplicates: pending reports that share a cluster_id with at least one
  // other pending report (the duplicate-flagging algorithm's output).
  const clusterGroups = new Map<string, RawReport[]>();
  for (const r of pending) {
    if (!r.cluster_id) continue;
    const group = clusterGroups.get(r.cluster_id) ?? [];
    group.push(r);
    clusterGroups.set(r.cluster_id, group);
  }
  // Largest group first. Groups are built in the pending order (score, then
  // longest waiting), and the sort is stable, so among groups of one size the
  // one holding the highest-ranked report leads.
  const duplicateGroups = [...clusterGroups.values()]
    .filter((g) => g.length >= 2)
    .sort((a, b) => b.length - a.length);
  // Flat, in the same group order, so the tab's rows, its count, the search
  // box and [Validate next] all read the groups as they are shown.
  const duplicates = duplicateGroups.flat().map((r) => toQueueReport(r, routingExtras.get(r.id), positionOf(r)));
  const duplicateClusters: SituationCluster[] = duplicateGroups.map((group) => ({
    id: group[0].cluster_id as string,
    categories: distinctCategories(group.map((r) => categoryLabel(r.category))),
    memberCount: group.length,
    // RLS only lets this official see their own barangay's reports, so a
    // cross-barangay cluster (if one exists) would only ever show this one
    // barangay's members from here.
    barangaysAffected: [barangayName],
    identityWithheldMembers: group.filter((r) => r.identity_withheld).length,
    members: group.map((r) => toQueueReport(r, routingExtras.get(r.id), positionOf(r))),
  }));

  // Active-cluster banner (the "ACTIVE FLOODING"-style card) on the
  // Emergency tab: the largest duplicate group, if any exist.
  const activeCluster: SituationCluster | null = duplicateClusters[0] ?? null;

  const kpiSummary: KpiSummary = {
    fastTriageCount: emergency.length,
    standardIntakeCount: standard.length,
    // NOTE: repurposed from the mockup's "median resolution time" (no real
    // resolution-time column exists yet) to "median time pending reports
    // have been waiting" — same KPI tile, adjusted meaning. Revisit once
    // agency_routing's resolved_at is wired in for a true resolution-time
    // metric.
    medianMinutes: medianAgeMinutes(pending.map((r) => r.created_at)),
    // Today in Manila — see startOfManilaDay. Counted in SQL rather than from
    // the tab's rows, whose routed half is capped and would undercount a busy
    // day. Includes routed and resolved, so routing a report doesn't take it
    // back off the tile. This previously counted every validated report ever
    // while the tile was labelled [Validated today].
    // null, not 0, when the count failed: [0 validated today] would be a claim.
    // With CDRRMO dispatch on, only this barangay's own validations count
    // (spec 3.3): a report CDRRMO validated is not one the desk validated.
    // If that count can't be read, the tile keeps today's count.
    validatedCount: barangayToday ?? (todayRes.error ? null : todayRes.count ?? 0),
  };

  const queueByTab: Record<QueueTabId, QueueReport[]> = {
    emergency,
    standard,
    duplicates,
    validated,
  };

  const queueTabMeta: QueueData["queueTabMeta"] = [
    { id: "emergency", label: "Emergency Fast-triage", count: emergency.length },
    { id: "standard", label: "Standard intake", count: standard.length },
    { id: "duplicates", label: "Flagged duplicates", count: duplicates.length },
    { id: "validated", label: "Recent validated", count: validated.length },
  ];

  return {
    kpiSummary,
    activeCluster,
    duplicateClusters,
    queueByTab,
    queueTabMeta,
    cdrrmoDispatch,
    cdrrmoAgency,
    loadFailed: false,
    validatedUnavailable,
  };
}

/**
 * Who decided on each report under CDRRMO dispatch: its report_validations
 * rows (spec 3.3; the report's barangay roles may read them). null when the
 * read fails, which every caller treats as "not known", never as "nobody".
 */
async function loadPartyDecisions(
  supabase: ReturnType<typeof createClient>,
  reportIds: string[]
): Promise<Map<string, PartyDecisions> | null> {
  if (reportIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("report_validations")
    .select(REPORT_VALIDATIONS_DECISIONS_SELECT)
    .in("incident_report_id", reportIds);
  if (error) {
    console.error("[queue] report_validations load failed", error.code, error.message);
    return null;
  }
  return partyDecisionsByReport((data ?? []) as { incident_report_id: string; party: string; decision: string }[]);
}

/**
 * This barangay's own validations since `since`, from report_validations
 * (party 'barangay'). report_validations has no barangay column, so the
 * filter goes through its incident_report_id foreign key to the report's
 * incident_barangay_id (an inner embed). RLS also scopes the rows to this
 * barangay's reports; the filter is belt-and-suspenders, as in the queue
 * reads. null when the count fails.
 */
async function countBarangayValidationsSince(
  supabase: ReturnType<typeof createClient>,
  barangayId: string,
  since: string
): Promise<number | null> {
  // Only granted columns (REPORT_VALIDATIONS_READABLE): incident_report_id,
  // party, decision, created_at.
  const { count, error } = await supabase
    .from("report_validations")
    .select("incident_report_id, incident_reports!inner(incident_barangay_id)", { count: "exact", head: true })
    .eq("incident_reports.incident_barangay_id", barangayId)
    .eq("party", "barangay")
    .eq("decision", "validated")
    .gte("created_at", since);
  if (error) {
    console.error("[queue] barangay validations count failed", error.code, error.message);
    return null;
  }
  return count ?? 0;
}

/**
 * CDRRMO's agency row, by its code (backend spec 3.1: CDRRMO is identified
 * by agencies.code = 'cdrrmo', never by a uuid). Read only while CDRRMO
 * dispatch is on; a failure only costs its name in the Validate
 * confirmation, which then says [CDRRMO] in words.
 */
async function loadCdrrmoAgency(supabase: ReturnType<typeof createClient>): Promise<RoutingOption | null> {
  const { data, error } = await supabase.from("agencies").select("id, name").eq("code", "cdrrmo").maybeSingle();
  if (error || !data) {
    if (error) console.error("[queue] cdrrmo agency load failed", error.code, error.message);
    return null;
  }
  const row = data as { id: string; name: string | null };
  return { agencyId: row.id, agencyName: row.name?.trim() || "CDRRMO" };
}

/**
 * The routed half of Recent validated: the reports behind the newest
 * agency_routing rows, newest routing first, capped at RECENT_ROUTED_LIMIT.
 * Only routed and resolved reports are kept — one that every agency sent back
 * is validated again and belongs to the awaiting half. A routed report the
 * desk can see no agency row for can't be found this way; routing always
 * writes one, so none is expected.
 *
 * failed is true when the reports couldn't be read, so the tab can say its
 * list is incomplete rather than show a partial one as the whole.
 */
async function loadRecentlyRouted(
  supabase: ReturnType<typeof createClient>,
  barangayId: string,
  rows: { incident_report_id: string }[],
  statuses: string[]
): Promise<{ routed: RawReport[]; failed: boolean }> {
  // The rows arrive newest first; a report's first row is its latest routing.
  const rank = new Map<string, number>();
  for (const row of rows) {
    if (!rank.has(row.incident_report_id)) rank.set(row.incident_report_id, rank.size);
  }
  const ids = [...rank.keys()].slice(0, RECENT_ROUTED_CANDIDATES);
  if (ids.length === 0) return { routed: [], failed: false };

  const { data, error, status } = await supabase
    .from("incident_reports")
    .select(REPORT_COLUMNS)
    .eq("incident_barangay_id", barangayId)
    .in("id", ids)
    .in("status", statuses);
  if (error) {
    console.error("[queue] recently-routed failed", status, error.code, error.message);
    return { routed: [], failed: true };
  }
  const routed = ((data ?? []) as RawReport[])
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
    .slice(0, RECENT_ROUTED_LIMIT);
  return { routed, failed: false };
}

/**
 * Everything the Recent validated tab says about routing, loaded after the
 * reports themselves because it needs their ids and categories.
 *
 * None of this is allowed to take the queue down. These three tables are
 * secondary to the pending list — an RLS change on agency_routing must not
 * put an outage banner over live emergencies — so each failure is logged and
 * degrades only its own part:
 *  - routing rows fail → routed reports show their status without agency
 *    progress; a half-finished routing can't be detected, which is safe
 *    because routeReport is idempotent.
 *  - the category mapping fails → routingPlan stays null on validated
 *    reports, which the UI shows as [couldn't load routing options] rather
 *    than as [no agency mapped], a claim it couldn't back up.
 *  - agency names fail → [Unnamed agency], and a returned report gets no
 *    list of other agencies to choose from (routingOptions null), which the
 *    UI shows as [couldn't load the agency list] rather than as [no other
 *    agency].
 *
 * Pending reports get the category mapping too, for the drawer's preview of
 * where a report would go once validated (the paper's [you're confirming,
 * not choosing], p.186). A preview sends nothing: routing is still its own
 * confirmed step after validation.
 *
 * Pending reports get their agency rows as well, for one case: a report
 * routed automatically, before any review, that every agency then sent back
 * as out of scope. The backend's handback returns it to 'prioritized', into
 * the pending queue, and its rows are what show it was returned — without
 * them the drawer would offer the very agencies that returned it as where
 * routing will send it. Every other pending report has no rows.
 */
async function loadRouting(
  supabase: ReturnType<typeof createClient>,
  pending: RawReport[],
  awaiting: RawReport[],
  routed: RawReport[]
): Promise<Map<string, RoutingExtras>> {
  const extras = new Map<string, RoutingExtras>();
  const reportIds = [...pending, ...awaiting, ...routed].map((r) => r.id);

  // Only well-formed category keys reach the filter. category is written by
  // the mobile app and ends up inside a PostgREST in.() list; a key is
  // snake_case by contract, so anything else is dropped rather than quoted and
  // hoped for. A dropped category simply shows [couldn't load routing options].
  const categories = [...new Set([...pending, ...awaiting].map((r) => r.category))].filter((c) =>
    /^[a-z0-9_]{1,64}$/.test(c)
  );
  if (reportIds.length === 0 && categories.length === 0) return extras;

  const [routingRes, mappingRes, agenciesRes] = await Promise.all([
    reportIds.length > 0
      ? supabase
          .from("agency_routing")
          .select(
            "incident_report_id, agency_id, is_primary, auto_routed, routed_at, acknowledged_at, in_progress_at, resolved_at, resolution_outcome"
          )
          .in("incident_report_id", reportIds)
      : Promise.resolve({ data: [] as RawRouting[], error: null }),
    categories.length > 0
      ? supabase
          .from("category_agency_routing")
          .select("category_key, agency_id, is_primary, sort_order")
          .in("category_key", categories)
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [] as RawMapping[], error: null }),
    // A small reference table (the city's responder agencies), readable by
    // every authenticated user — fetched whole rather than by id so it can
    // run in parallel with the two lookups that would supply the ids.
    supabase.from("agencies").select("id, name").limit(500),
  ]);

  if (routingRes.error) {
    console.error("[queue] agency_routing load failed", routingRes.error.code, routingRes.error.message);
  }
  if (mappingRes.error) {
    console.error(
      "[queue] category_agency_routing load failed",
      mappingRes.error.code,
      mappingRes.error.message
    );
  }
  if (agenciesRes.error) {
    console.error("[queue] agencies load failed", agenciesRes.error.code, agenciesRes.error.message);
  }

  const agencyNames = new Map<string, string>(
    ((agenciesRes.data ?? []) as { id: string; name: string | null }[]).map((a) => [
      a.id,
      a.name?.trim() || "Unnamed agency",
    ])
  );
  const nameOf = (agencyId: string) => agencyNames.get(agencyId) ?? "Unnamed agency";

  const routingByReport = new Map<string, AgencyRouting[]>();
  // Which agencies hold each report, by id: the picker must not offer an
  // agency that already has the report, and names can repeat or be missing.
  const heldBy = new Map<string, Set<string>>();
  for (const row of (routingRes.data ?? []) as RawRouting[]) {
    const held = heldBy.get(row.incident_report_id) ?? new Set<string>();
    held.add(row.agency_id);
    heldBy.set(row.incident_report_id, held);
    const list = routingByReport.get(row.incident_report_id) ?? [];
    list.push({
      agencyName: nameOf(row.agency_id),
      isPrimary: row.is_primary,
      autoRouted: Boolean(row.auto_routed),
      routedAt: row.routed_at,
      acknowledgedAt: row.acknowledged_at,
      inProgressAt: row.in_progress_at,
      resolvedAt: row.resolved_at,
      resolutionOutcome: row.resolution_outcome,
    });
    routingByReport.set(row.incident_report_id, list);
  }
  // Primary agency first, so every surface can read the head of the list as
  // the lead responder.
  for (const list of routingByReport.values()) {
    list.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  }

  const planByCategory = new Map<string, RoutingPlanEntry[]>();
  if (!mappingRes.error) {
    for (const row of (mappingRes.data ?? []) as RawMapping[]) {
      const plan = planByCategory.get(row.category_key) ?? [];
      plan.push({ agencyId: row.agency_id, agencyName: nameOf(row.agency_id), isPrimary: row.is_primary });
      planByCategory.set(row.category_key, plan);
    }
  }

  // Every agency with a name, for the picker a returned report offers. An
  // agency without one is left out: an official can't knowingly choose
  // [Unnamed agency].
  const namedAgencies = ((agenciesRes.data ?? []) as { id: string; name: string | null }[])
    .filter((a) => Boolean(a.name?.trim()))
    .map((a) => ({ agencyId: a.id, agencyName: (a.name as string).trim() }))
    .sort((a, b) => a.agencyName.localeCompare(b.agencyName, "en"));

  // A pending report has agency rows only when the agencies handed it back
  // after an automatic routing. The picker waits for validation, as for any
  // returned report, so no options here.
  for (const r of pending) {
    extras.set(r.id, {
      routing: routingByReport.get(r.id) ?? [],
      routingPlan: mappingRes.error ? null : planByCategory.get(r.category) ?? [],
      routingOptions: null,
    });
  }
  for (const r of awaiting) {
    const held = heldBy.get(r.id);
    extras.set(r.id, {
      routing: routingByReport.get(r.id) ?? [],
      // A category absent from a successful lookup has no mapping: []. A
      // failed lookup proves nothing either way: null.
      routingPlan: mappingRes.error ? null : planByCategory.get(r.category) ?? [],
      // The picker's list, in two cases. A validated report that agencies
      // already hold can need another agency: routingState decides whether it
      // does (every agency sent it back). A validated Other-report no agency
      // holds yet goes to the agencies the desk picks, from every named
      // agency. A failed agency list is null, never [], which would claim
      // that no agency exists.
      routingOptions: held
        ? agenciesRes.error
          ? null
          : namedAgencies.filter((a) => !held.has(a.agencyId))
        : r.entry_tier === "other_reports"
          ? agenciesRes.error
            ? null
            : namedAgencies
          : null,
    });
  }
  for (const r of routed) {
    extras.set(r.id, { routing: routingByReport.get(r.id) ?? [], routingPlan: null, routingOptions: null });
  }

  return extras;
}

function toQueueReport(
  r: RawReport,
  extras: RoutingExtras = NO_ROUTING,
  position: ReportPosition = UNKNOWN_POSITION,
  partyDecisions: PartyDecisions | null = null
): QueueReport {
  return {
    id: r.id,
    // Display form. The raw key stays in the database; routeReport re-reads
    // it there rather than trusting anything shaped here.
    category: categoryLabel(r.category),
    // Passed through, null included. Defaulting to Low showed unscored
    // emergencies as the lowest tier.
    priority: r.priority_name,
    summary: r.description ?? "(No description provided)",
    // No address text field exists on incident_reports (only geom) — location
    // is intentionally omitted here, not hidden. ReportRow only renders it
    // when present.
    timestamp: timeAgo(r.created_at),
    reporter: {
      // Real system never shows a reporter's name, identity-withheld or not
      // (privacy-by-design) — this matches that, not a data gap.
      name: reporterLabel(r.identity_withheld),
      identityWithheld: r.identity_withheld,
    },
    details: {
      entryTier: r.entry_tier,
      status: r.status,
      description: r.description,
      severitySelfRating: r.severity_self_rating,
      safetyNetConfirmation: r.safety_net_confirmation,
      anyoneHurt: r.anyone_hurt,
      isOngoing: r.is_ongoing,
      hasPhoto: r.has_photo,
      hasVideo: r.has_video,
      discreetReporting: r.discreet_reporting,
      priorityClass: r.priority_class,
      priorityScore: r.priority_score,
      confidenceBand: r.confidence_band,
      subCategory: r.sub_category ? categoryLabel(r.sub_category) : null,
      clusterId: r.cluster_id,
      submittedAt: r.created_at,
      routing: extras.routing,
      routingPlan: extras.routingPlan,
      routingOptions: extras.routingOptions,
      position,
      reviewedAt: r.reviewed_at,
      partyDecisions,
    },
  };
}

function failedQueueData(): QueueData {
  return {
    kpiSummary: { fastTriageCount: 0, standardIntakeCount: 0, medianMinutes: 0, validatedCount: 0 },
    activeCluster: null,
    duplicateClusters: [],
    queueByTab: { emergency: [], standard: [], duplicates: [], validated: [] },
    queueTabMeta: [
      { id: "emergency", label: "Emergency Fast-triage", count: 0 },
      { id: "standard", label: "Standard intake", count: 0 },
      { id: "duplicates", label: "Flagged duplicates", count: 0 },
      { id: "validated", label: "Recent validated", count: 0 },
    ],
    cdrrmoDispatch: false,
    cdrrmoAgency: null,
    loadFailed: true,
    // The whole page failed; the banner already says so.
    validatedUnavailable: false,
  };
}
