import "server-only";
import { createClient } from "@/lib/supabase/server";
import { categoryLabel, displayName, parseRejectReason, reporterLabel } from "@/lib/utils";
import { BARANGAY_RESOLVE_LIVE } from "@/lib/features";
import {
  isReviewStampedByCdrrmo,
  readCdrrmoDispatchEnabled,
  REPORT_VALIDATIONS_HISTORY_SELECT,
} from "@/lib/cdrrmo-dispatch";
import { YOUR_BARANGAY } from "@/components/validation-history/historyOptions";
import type { ResolutionStatus, ValidationRecord, ValidationSummary } from "@/types";

interface RawReviewedReport {
  // Set by resolve_report_at_barangay() alone. Only selected once the
  // backend's migration is live (see the query), so absent before then.
  barangay_resolved_at?: string | null;
  id: string;
  category: string;
  priority_name: "Low" | "Medium" | "High" | "Critical" | null;
  status: string;
  entry_tier: "emergency" | "other_reports";
  identity_withheld: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_reason: string | null;
  created_at: string;
}

export interface ValidationHistoryData {
  summary: ValidationSummary;
  records: ValidationRecord[];
  // Travels with the data so the client can say the view is capped without
  // importing anything from this module at runtime — it's "server-only", and
  // a value import from a "use client" component would drag it into the
  // browser bundle and fail the build. Types erase; constants don't.
  limit: number;
  // True when the query failed and the empty result is a fallback. The page
  // shows a banner instead of [No validation records yet].
  loadFailed: boolean;
  // True when the agency rows couldn't be read: every resolution is unknown,
  // and the page hides its resolution filter rather than filter on nothing.
  resolutionUnavailable: boolean;
}

interface RawResolutionNote {
  report_id: string;
  note: string | null;
}

interface RawOutcome {
  incident_report_id: string;
  resolved_at: string | null;
  resolution_outcome: string | null;
}

/**
 * One report_validations row (CDRRMO dispatch, spec 3.3), granted columns
 * only: `actor` isn't readable (REPORT_VALIDATIONS_READABLE).
 */
interface RawPartyDecision {
  incident_report_id: string;
  party: string;
  decision: string;
  reason: string | null;
  created_at: string;
}

const HISTORY_LIMIT = 50;

const HISTORY_COLUMNS =
  "id, category, priority_name, status, entry_tier, identity_withheld, reviewed_by, reviewed_at, review_reason, created_at";

// barangay_resolved_at arrives with the resolve-at-barangay migration.
// Naming it before then would fail the query, and so the page.
// Typed as a plain string: the list is built at run time, and the client's
// select parser only reads a literal. The rows are shaped by hand below
// either way.
const historyColumns: string = BARANGAY_RESOLVE_LIVE
  ? `${HISTORY_COLUMNS}, barangay_resolved_at`
  : HISTORY_COLUMNS;

/**
 * Fetches this barangay's reviewed reports (validated — including those since
 * routed or resolved — and rejected) —
 * built on top of the review_report() cutover (reviewed_by/reviewed_at/
 * review_reason), so no audit_logs involvement is needed at all: barangay
 * roles can already SELECT incident_reports table-wide for their own
 * barangay, unlike audit_logs, which no barangay role can read.
 *
 * reviewed_by references auth.users(id), NOT profiles(id) directly — there's
 * no direct FK from incident_reports to profiles, so PostgREST's automatic
 * embed syntax (`profiles!reviewed_by(full_name)`) doesn't apply here. A
 * second query resolves reviewer names instead.
 *
 * Capped at HISTORY_LIMIT rows, so `summary` describes what's on screen —
 * not an all-time barangay total. The page copy says so explicitly.
 */
export async function getValidationHistory(barangayId: string): Promise<ValidationHistoryData> {
  const supabase = createClient();

  // The CDRRMO dispatch switch, read beside the reports (false on any doubt,
  // src/lib/cdrrmo-dispatch.ts). Only while it is on does this page read
  // report_validations, so that a CDRRMO decision is never shown or counted
  // as this barangay's own (spec 3.3).
  const [{ data, error }, cdrrmoDispatch] = await Promise.all([
    supabase
      .from("incident_reports")
      .select(
historyColumns)
      .eq("incident_barangay_id", barangayId)
      // A validated report doesn't stop being validated when it's routed or
      // resolved — it moves on. Filtering on status = 'validated' alone made
      // routing a report delete it from this page. routed/resolved rows are
      // held to a real review stamp, so anything that ever reaches them
      // without passing a barangay review (auto_route(), if it's ever wired)
      // isn't passed off as a validation. Pre-cutover validated/rejected rows
      // have no stamp and stay in, by status, as before.
      .or(
        "status.in.(validated,rejected),and(status.in.(routed,resolved),reviewed_at.not.is.null)"
      )
      // nullsFirst: false matters — Postgres sorts NULLs FIRST on DESC by
      // default, which would float any pre-cutover row (reviewed_at IS NULL,
      // reviewed before review_report() existed) to the top of a
      // newest-first list.
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .limit(HISTORY_LIMIT),
    readCdrrmoDispatchEnabled(supabase),
  ]);

  if (error || !data) {
    console.error("[validation-history] load failed", error?.code, error?.message);
    return failedValidationHistoryData();
  }

  const rows = data as unknown as RawReviewedReport[];

  const partyRows = cdrrmoDispatch ? await loadPartyDecisions(supabase, rows.map((r) => r.id)) : null;

  const reviewerIds = [
    ...new Set(rows.map((r) => r.reviewed_by).filter((id): id is string => Boolean(id))),
  ];
  // Confirmed reports only: a rejected one never reaches an agency.
  const confirmedIds = rows.filter((r) => r.status !== "rejected").map((r) => r.id);

  // Reports the desk closed itself. Their notes sit in their own table,
  // readable by this barangay's desk only.
  const barangayResolvedIds = rows.filter((r) => r.barangay_resolved_at).map((r) => r.id);

  // The lookups at once. Each failure costs only its own column.
  const [reviewersRes, outcomesRes, notesRes] = await Promise.all([
    reviewerIds.length > 0
      ? supabase.from("profiles").select("id, full_name").in("id", reviewerIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
    confirmedIds.length > 0
      ? supabase
          .from("agency_routing")
          .select("incident_report_id, resolved_at, resolution_outcome")
          .in("incident_report_id", confirmedIds)
      : Promise.resolve({ data: [] as RawOutcome[], error: null }),
    barangayResolvedIds.length > 0
      ? supabase.from("barangay_resolutions").select("report_id, note").in("report_id", barangayResolvedIds)
      : Promise.resolve({ data: [] as RawResolutionNote[], error: null }),
  ]);

  // A failed read leaves the notes out; the outcome line still says the
  // barangay resolved it, from the marker on the report.
  if (notesRes.error) {
    console.error("[validation-history] resolution notes failed", notesRes.error.code, notesRes.error.message);
  }
  const notesByReport = new Map<string, string>();
  for (const n of (notesRes.data ?? []) as RawResolutionNote[]) {
    if (n.note) notesByReport.set(n.report_id, n.note);
  }

  const reviewerNames = new Map<string, string>();
  // If this lookup fails, the names are UNKNOWN, not absent. It used to drop
  // its error, so every decision read [Unnamed official] — which looks like a
  // fact about the officials rather than a failed query.
  let namesUnavailable = false;
  if (reviewersRes.error) {
    console.error("[validation-history] reviewer names failed", reviewersRes.error.code, reviewersRes.error.message);
    namesUnavailable = true;
  }
  for (const r of (reviewersRes.data ?? []) as { id: string; full_name: string | null }[]) {
    reviewerNames.set(r.id, displayName(r.full_name));
  }

  const resolutionUnavailable = Boolean(outcomesRes.error);
  if (outcomesRes.error) {
    console.error("[validation-history] agency outcomes failed", outcomesRes.error.code, outcomesRes.error.message);
  }
  const outcomesByReport = new Map<string, RawOutcome[]>();
  for (const o of (outcomesRes.data ?? []) as RawOutcome[]) {
    outcomesByReport.set(o.incident_report_id, [...(outcomesByReport.get(o.incident_report_id) ?? []), o]);
  }

  const partiesByReport = new Map<string, RawPartyDecision[]>();
  for (const p of partyRows ?? []) {
    partiesByReport.set(p.incident_report_id, [...(partiesByReport.get(p.incident_report_id) ?? []), p]);
  }

  const records = rows.map((r) => {
    const record = toValidationRecord(
      r,
      reviewerNames,
      namesUnavailable,
      resolutionOf(r, resolutionUnavailable ? null : outcomesByReport.get(r.id) ?? []),
      notesByReport.get(r.id)
    );
    const parties = partiesByReport.get(r.id);
    return parties ? withPartyDecisions(record, r, parties) : record;
  });

  const summary: ValidationSummary = {
    total: rows.length,
    // Everything that isn't rejected: validated, routed, and resolved are all
    // reports this barangay confirmed.
    // Only this barangay's own decisions (spec 3.3): a record CDRRMO decided
    // is listed, never counted. Without CDRRMO dispatch no record has
    // decidedBy, and these are the counts they always were.
    confirmed: records.filter((r) => r.verdict === "Confirmed" && r.decidedBy !== "cdrrmo").length,
    // Barangay rejections. This tile used to be labelled [Confirmed-false],
    // but in the paper that is an agency's resolution outcome
    // (agency_routing.resolution_outcome) with a sanction effect — a desk
    // rejection is neither, so it is called what it is.
    rejected: records.filter((r) => r.verdict === "Rejected" && r.decidedBy !== "cdrrmo").length,
    identityWithheld: rows.filter((r) => r.identity_withheld).length,
  };

  return { summary, records, limit: HISTORY_LIMIT, loadFailed: false, resolutionUnavailable };
}

/**
 * What became of a confirmed report. One the desk closed itself says so
 * from the marker the backend sets (barangay_resolved_at), never inferred
 * from a resolved report having no agency rows. Otherwise, from its agency
 * rows: still held while any agency hasn't closed it; once all have, the
 * strongest outcome any of them recorded, with [returned] only when every
 * one sent it back. outcomes is null when the agency rows couldn't be read.
 */
function resolutionOf(r: RawReviewedReport, outcomes: RawOutcome[] | null): ResolutionStatus | null {
  if (r.status === "rejected") return null;
  if (r.barangay_resolved_at) return "resolvedAtBarangay";
  if (outcomes === null) return null;
  if (outcomes.length === 0) return "notRouted";
  if (outcomes.some((o) => !o.resolved_at)) return "withAgencies";
  const has = (outcome: string) => outcomes.some((o) => o.resolution_outcome === outcome);
  if (has("resolved")) return "resolved";
  if (has("confirmed-false")) return "confirmedFalse";
  if (has("duplicate")) return "duplicate";
  return "returned";
}

/**
 * The report_validations rows for these reports, or null when the read
 * fails: the page then shows what it showed before CDRRMO dispatch.
 */
async function loadPartyDecisions(
  supabase: ReturnType<typeof createClient>,
  reportIds: string[]
): Promise<RawPartyDecision[] | null> {
  if (reportIds.length === 0) return [];
  const { data, error } = await supabase
    .from("report_validations")
    .select(REPORT_VALIDATIONS_HISTORY_SELECT)
    .in("incident_report_id", reportIds);
  if (error) {
    console.error("[validation-history] report_validations failed", error.code, error.message);
    return null;
  }
  return (data ?? []) as RawPartyDecision[];
}

/**
 * Rewrites a record from its report_validations rows (CDRRMO dispatch).
 * The barangay's own row, when there is one, is the decision this page
 * shows: its verdict, its reason, whatever CDRRMO did after
 * (a later CDRRMO rejection shows as the resolution, [Rejected by CDRRMO
 * after routing]; a CDRRMO override of the barangay's rejection as [Sent on
 * by CDRRMO after your rejection]). With only a CDRRMO row, the record is CDRRMO's: labelled
 * [Validated by CDRRMO] / [Rejected by CDRRMO] instead of an official, and
 * marked decidedBy so no figure counts it as the barangay's.
 */
function withPartyDecisions(
  record: ValidationRecord,
  r: RawReviewedReport,
  parties: RawPartyDecision[]
): ValidationRecord {
  const barangay = parties.find((p) => p.party === "barangay");
  const cdrrmo = parties.find((p) => p.party === "cdrrmo");
  if (barangay) {
    const confirmed = barangay.decision === "validated";
    const reason = confirmed ? null : barangay.reason ?? r.review_reason;
    const parsed = reason ? parseRejectReason(reason) : null;
    // The official comes from the report's reviewed_by, which is the
    // barangay's own review unless the stamp is CDRRMO's: CDRRMO decided
    // first, overrode the barangay, or rejected after routing
    // (isReviewStampedByCdrrmo). Then reviewed_by is CDRRMO's reviewer,
    // never shown as the barangay's, and the barangay's actor isn't
    // readable, so the column says [Your barangay].
    const stampedByCdrrmo = isReviewStampedByCdrrmo(barangay, cdrrmo);
    return {
      ...record,
      verdict: confirmed ? "Confirmed" : "Rejected",
      validatingOfficial: stampedByCdrrmo ? YOUR_BARANGAY : record.validatingOfficial,
      officialIsBarangayGeneric: stampedByCdrrmo || undefined,
      reason: reason ?? undefined,
      reasonCode: parsed?.code ?? null,
      reasonNote: parsed?.note,
      resolution:
        confirmed && r.status === "rejected" && cdrrmo?.decision === "rejected"
          ? "rejectedByCdrrmo"
          : !confirmed && cdrrmo?.decision === "validated"
            ? "overriddenByCdrrmo"
            : record.resolution,
    };
  }
  if (cdrrmo) {
    const confirmed = cdrrmo.decision === "validated";
    return {
      ...record,
      verdict: confirmed ? "Confirmed" : "Rejected",
      validatingOfficial: confirmed ? "Validated by CDRRMO" : "Rejected by CDRRMO",
      decidedBy: "cdrrmo",
    };
  }
  return record;
}

function toValidationRecord(
  r: RawReviewedReport,
  reviewerNames: Map<string, string>,
  namesUnavailable: boolean,
  resolution: ResolutionStatus | null,
  resolutionNote: string | undefined
): ValidationRecord {
  const parsedReason = r.review_reason ? parseRejectReason(r.review_reason) : null;
  return {
    reportId: r.id,
    category: categoryLabel(r.category),
    // Both are real columns, passed through as-is. No derivation: the earlier
    // "tier" collapsed priority and intake tier into one value, and the table
    // then read that value back as a priority — so an emergency report with
    // priority_name 'Low' rendered as a High badge.
    priority: r.priority_name,
    entryTier: r.entry_tier,
    verdict: r.status === "rejected" ? "Rejected" : "Confirmed",
    // Pre-cutover rows can have a NULL reviewed_by (nobody stamped them),
    // and a reviewer whose profiles row isn't readable falls through the
    // same way — both surface as "Unknown official" rather than a blank cell.
    validatingOfficial: r.reviewed_by
      ? reviewerNames.get(r.reviewed_by) ?? (namesUnavailable ? "Name unavailable" : "Unnamed official")
      : "Unknown official",
    // Pre-cutover rows have no reviewed_at, so created_at stands in — for both
    // the display string and the raw value the range filter compares against,
    // so the two can never disagree about which moment a row belongs to.
    timestamp: formatReviewedAt(r.reviewed_at ?? r.created_at),
    reviewedAt: r.reviewed_at ?? r.created_at,
    reporter: {
      // Privacy-by-design: officials never see a reporter's name, withheld
      // or not. Same rule as the queue.
      name: reporterLabel(r.identity_withheld),
      identityWithheld: r.identity_withheld,
    },
    // Only present for rejected rows — review_reason is NULL for validated
    // ones (the RPC only fills it on rejection).
    reason: r.review_reason ?? undefined,
    reasonCode: parsedReason?.code ?? null,
    reasonNote: parsedReason?.note,
    resolution,
    resolutionNote,
  };
}

function failedValidationHistoryData(): ValidationHistoryData {
  return {
    summary: { total: 0, confirmed: 0, rejected: 0, identityWithheld: 0 },
    records: [],
    limit: HISTORY_LIMIT,
    loadFailed: true,
    resolutionUnavailable: true,
  };
}

// Formatted on the server, so the zone must be explicit: without it this
// renders in the host's zone, and a deployed host runs UTC — every row and
// the CSV would read eight hours early. Manila has no DST, so the fixed zone
// is exact. Keep in step with ReportDetailPanel's formatTimestamp.
function formatReviewedAt(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
