"use server";

import { revalidatePath } from "next/cache";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
// Constants live in utils, not here: a "use server" file may export only
// async functions, and ReasonPromptModal needs the same limit.
import { isUuid, MAX_REASON_LENGTH, parseRejectReason } from "@/lib/utils";
import { BARANGAY_RESOLVE_LIVE } from "@/lib/features";
import { type HeldRow, routedTo } from "@/lib/routingAudit";
import { MESSAGES } from "@/lib/messages";
import { isCdrrmoDispatchActiveError, readCdrrmoDispatchEnabled } from "@/lib/cdrrmo-dispatch";

/*
 * Every function in this file is a public POST endpoint. Its arguments are
 * whatever the caller sent — TypeScript's parameter types describe the
 * console's own call sites, and nothing more. Each action therefore proves
 * the shape of its input before doing any work: a report id must be a uuid,
 * a decision must be one of two literals, a reason must be a bounded string,
 * and a bulk list must be a short array of distinct uuids.
 */

interface UpdateResult {
  success: boolean;
  message?: string;
  /**
   * "cdrrmo-dispatch-active": the backend's CDRRMO dispatch switch is on and
   * this is an Emergency report, so the old path refused it
   * (src/lib/cdrrmo-dispatch.ts). The page switches the report to the
   * Validate flow and words the message itself.
   */
  reason?: "cdrrmo-dispatch-active";
}

// The English text for a cdrrmo_dispatch_active refusal, for callers that
// don't read `reason`; the page shows the same key in the official's
// language.
const DISPATCH_ACTIVE = MESSAGES["cdrrmo.useValidate"].en;

// Same wording as profile.ts, so an expired session reads the same
// everywhere it can surface.
const SESSION_EXPIRED = "Your session expired. Sign in again.";
const UNREACHABLE = "Couldn't reach the server. Check your connection, then try again.";
const INVALID_REQUEST = "That request wasn't valid. Refresh the page and try again.";

// A duplicate cluster big enough to need more than this is not something to
// validate in one click, and without a cap one POST could queue thousands of
// sequential RPCs.
const MAX_BULK = 50;

type SessionState = "active" | "expired" | "unreachable";

/**
 * Whether the caller still has a session — used only where an expired session
 * would otherwise produce a misleading answer rather than an error (routing's
 * first step is a SELECT, which under no session returns zero rows, not an
 * error, and would read as [not in your barangay]).
 *
 * Tri-state on purpose: an Auth outage or a network failure is not [signed
 * out], and telling an official their session expired when the server simply
 * couldn't be reached sends them to sign in again for nothing.
 */
async function sessionState(supabase: ReturnType<typeof createClient>): Promise<SessionState> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (user) return "active";
  if (error && isAuthRetryableFetchError(error)) return "unreachable";
  return "expired";
}

const SESSION_MESSAGE: Record<Exclude<SessionState, "active">, string> = {
  expired: SESSION_EXPIRED,
  unreachable: UNREACHABLE,
};

/**
 * Classifies a failed PostgREST call before any business meaning is read into
 * it. No pre-flight Auth call is needed for this, which is why validate and
 * reject no longer make one:
 *
 * - status 0: the request never got an HTTP answer (network, DNS, timeout).
 * - status 401, or a PGRST30x code: the request reached PostgREST without a
 *   usable user JWT and ran as anon. PostgREST answers an insufficient-
 *   privilege error with 401 for anon and 403 for a signed-in role, so 401 is
 *   the session signal and 403 stays a genuine refusal.
 */
function transportMessage(status: number, error: { code?: string }): string | null {
  if (status === 0) return UNREACHABLE;
  if (status === 401 || (error.code ?? "").startsWith("PGRST30")) return SESSION_EXPIRED;
  return null;
}

/**
 * THE CUTOVER — review_report() is the ONLY path to validate/reject a report.
 * Since the 2026-08-31 db push, prod's incident_reports_review_stamped CHECK
 * constraint makes a raw update({ status: 'validated' | 'rejected' }) fail
 * with 23514 — there is no fallback, and none should be added back.
 *
 * RLS scopes what review_report() may do (own-barangay for barangay roles,
 * city-wide for municipal_admin); this function doesn't re-check that.
 *
 * There used to be a getUser() pre-flight here, purely to choose a toast. It
 * cost a blocking Auth round trip on every click, and reported an Auth outage
 * as an expired session. The RPC's own answer now carries the same signal —
 * see transportMessage().
 */
export async function updateReportStatus(
  reportId: string,
  status: "validated" | "rejected",
  reason?: string
): Promise<UpdateResult> {
  if (!isUuid(reportId) || (status !== "validated" && status !== "rejected")) {
    return { success: false, message: INVALID_REQUEST };
  }

  let pReason: string | null = null;
  if (status === "rejected") {
    // typeof first: a caller can send a number or an object, and `.trim()` on
    // either would throw inside the action instead of answering.
    const trimmed = typeof reason === "string" ? reason.trim() : "";
    if (trimmed.length === 0) {
      return { success: false, message: "A reason is required to reject a report." };
    }
    if (trimmed.length > MAX_REASON_LENGTH) {
      return {
        success: false,
        message: `A reason can be at most ${MAX_REASON_LENGTH} characters.`,
      };
    }
    // The reject prompt always sends a category prefix (composeRejectReason),
    // and Validation History reads the category back from it. Checked here
    // too because the action is a public endpoint: a reason without a known
    // category didn't come from the prompt, so it isn't stored.
    const { code, note } = parseRejectReason(trimmed);
    if (code === null) {
      return { success: false, message: "Choose a reason category for this rejection." };
    }
    if (code === "other" && note.length === 0) {
      return { success: false, message: "Add a note explaining the reason." };
    }
    // The trimmed text is what's stored, not the original with its padding.
    pReason = trimmed;
  }

  const supabase = createClient();
  const { error, status: httpStatus } = await supabase.rpc("review_report", {
    p_report_id: reportId,
    p_decision: status,
    p_reason: pReason,
  });

  if (error) {
    // Before any other reading: with CDRRMO dispatch on, review_report()
    // refuses an Emergency report with 42501 and this prefix, and 42501
    // alone would read as [wrong barangay].
    if (isCdrrmoDispatchActiveError(error)) {
      return { success: false, message: DISPATCH_ACTIVE, reason: "cdrrmo-dispatch-active" };
    }
    return {
      success: false,
      message:
        transportMessage(httpStatus, error) ??
        (await alreadyDecidedMessage(supabase, reportId, error)) ??
        messageForReviewError(error),
    };
  }

  revalidatePath("/queue");
  return { success: true };
}

// review_report()'s window: a report can be decided only while it is one of
// these. Kept in step with PENDING_STATUSES in src/lib/data/queue.ts.
const REVIEWABLE = new Set(["pending_priority", "prioritized"]);

/**
 * Says so when a refusal means another official decided the report first.
 *
 * review_report() answers a decision on a report that is already validated
 * with 42501, not 55000: the report has left the review window, and 42501 is
 * also its answer for a wrong barangay or a missing report. Mapped from the
 * code alone, an official who lost a race to a colleague was told [Not
 * permitted — wrong barangay], which sends them looking for a permissions
 * problem they don't have. So a 42501 is followed by one read of the report,
 * under the same RLS: readable and no longer pending means someone decided
 * it. Anything else, a failed read included, keeps the generic message.
 */
async function alreadyDecidedMessage(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  error: { code?: string }
): Promise<string | null> {
  // 55000 (someone decided it first) gets the same read: the Critical
  // escalation timer can be that someone.
  if (error.code !== "42501" && error.code !== "55000") return null;
  const { data, error: readError } = await supabase
    .from("incident_reports")
    .select("status")
    .eq("id", reportId)
    .maybeSingle();
  if (readError || !data) return null;
  if (REVIEWABLE.has(data.status as string)) return null;
  if ((data.status === "routed" || data.status === "resolved") && (await routedAutomatically(supabase, reportId))) {
    return ROUTED_BY_TIMER;
  }
  return "Someone else already reviewed this report.";
}

/**
 * The backend's Critical escalation timer (on since 2026-10-13) routes an
 * untouched Critical emergency to its mapped agencies 2 to 10 minutes after
 * scoring. An official deciding it as the timer fires loses the race to no
 * one: [Someone else already reviewed this report] would send them looking
 * for a colleague. A report the desk never routed carries auto_routed rows.
 */
const ROUTED_BY_TIMER =
  "This report was routed to its agencies automatically while you were deciding, because its review time ran out. The agencies already have it.";

/**
 * Whether any agency row on the report was written by automatic routing.
 * A failed read answers false, keeping the message that was shown before.
 */
async function routedAutomatically(supabase: ReturnType<typeof createClient>, reportId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("agency_routing")
    .select("agency_id")
    .eq("incident_report_id", reportId)
    .eq("auto_routed", true)
    .limit(1);
  if (error) {
    console.error("[reports] auto-routed read failed", error.code, error.message);
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * Maps review_report()'s SQLSTATEs to text this console owns. Never returns
 * the backend's message: that text is authored in another repo (or by
 * Postgres itself — 22023 isn't exclusive to the RPC's own RAISEs), it can
 * name internals, and it changes without this repo knowing. Branch on the
 * code, log the message server-side, show fixed copy.
 */
function messageForReviewError(error: { code?: string; message: string }): string {
  // 22023: bad decision value, or missing/empty reason on reject. The action
  // already checks both, so reaching this means something else was refused.
  // Neutral on purpose — the same mapper serves bulk validate, where
  // [a rejection needs a reason] would be false.
  if (error.code === "22023") {
    console.error("[review_report] 22023", error.message);
    return "That decision wasn't accepted. Refresh the report and try again.";
  }
  // 42501: not authorized — wrong role, wrong barangay, report not found,
  // or it already left the pending_priority/prioritized window.
  if (error.code === "42501") {
    return "Not permitted — wrong barangay, or already past review.";
  }
  // 55000: terminal-state conflict — someone else reviewed this report
  // between when the queue loaded and when this action fired.
  if (error.code === "55000") return "Someone else already reviewed this report.";
  console.error("[review_report] unexpected", error.code, error.message);
  return "Something went wrong. Try again.";
}

export interface RouteResult {
  success: boolean;
  message?: string;
  agencyCount?: number;
  /**
   * Set when the refusal has wording in src/lib/messages.ts, so the page can
   * show it in the official's language. message carries the English text
   * for any caller that doesn't read this.
   */
  reason?: "lead-taken" | "cdrrmo-dispatch-active";
}

/**
 * CDRRMO dispatch is on and this is an Emergency report: the desk validates
 * it, and the database routes it (src/lib/cdrrmo-dispatch.ts). Nothing of
 * this run was written by the time this is returned, except where a caller
 * says otherwise.
 */
function dispatchActiveResult(): RouteResult {
  revalidatePath("/queue");
  return { success: false, message: DISPATCH_ACTIVE, reason: "cdrrmo-dispatch-active" };
}

/**
 * Whether an Emergency report must go through CDRRMO dispatch instead of
 * this routing. The switch is read in parallel with the action's first
 * reads (no extra round trip) and checked before the first write, so the
 * routing's audit row is never written for a routing the database would
 * then refuse. Fails closed: any doubt about the switch is OFF, and the
 * routing goes ahead exactly as before (the database still refuses it if
 * the switch is in fact on; see sendAndRecord).
 */
function emergencyGoesThroughDispatch(entryTier: string | null | undefined, dispatchOn: boolean): boolean {
  return entryTier === "emergency" && dispatchOn;
}

const ROUTE_FAILED = "Something went wrong. Nothing new was routed — try again.";
const NOT_IN_BARANGAY = "That report isn't in your barangay, or no longer exists.";
const ALREADY_ROUTED = "Already routed — another official may have routed it first.";

/**
 * The backend's one-open-lead guard (agency_routing_one_open_lead): a report
 * may have only one open lead agency, and the losing writer of a lead race
 * gets 23P01 with DETAIL open_lead_exists. The whole statement aborts, so
 * none of this run's rows were written. PostgREST does not forward the
 * constraint name, so the code is what this branches on.
 *
 * The bare unique index answers 23505 naming the index instead, but only
 * under REPEATABLE READ / SERIALIZABLE or with triggers off; matched by
 * name so it can never be read as [that row is already there].
 *
 * Until the guard is live neither error can occur, and this is never true.
 */
const LEAD_GUARD = "agency_routing_one_open_lead";
function isLeadTaken(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "23P01") return true;
  return error.code === "23505" && (error.message ?? "").includes(LEAD_GUARD);
}

/** Another official's lead won the race; nothing of this run was written. */
function leadTakenResult(): RouteResult {
  revalidatePath("/queue");
  return { success: false, message: MESSAGES["routing.leadTaken"].en, reason: "lead-taken" };
}
const ONLY_VALIDATED = "Only validated reports can be routed.";
const RESOLVED_AT_BARANGAY = "This report was just resolved at the barangay, so it wasn't sent to any agency.";

/**
 * Why a report that is already routed or resolved can't be routed now.
 * [Already routed] is false for a report the barangay resolved itself: it
 * never went to an agency. resolve_report_at_barangay() closes only a report
 * no agency has ever held, so a resolved report with no routing rows is one
 * of those. A failed read keeps [Already routed], the answer before this.
 */
async function alreadyClosedMessage(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  status: string
): Promise<string> {
  if (status !== "resolved") {
    return (await routedAutomatically(supabase, reportId)) ? ROUTED_BY_TIMER : ALREADY_ROUTED;
  }
  const rows = await routingRows(supabase, reportId);
  if (rows !== null && rows.length === 0) return RESOLVED_AT_BARANGAY;
  return (await routedAutomatically(supabase, reportId)) ? ROUTED_BY_TIMER : ALREADY_ROUTED;
}

/**
 * Whether every agency the report went to closed it as out of scope — the
 * report the backend's handback returns to the barangay. The same rule as
 * everyAgencyReturned in src/components/queue/routing.ts, which decides the
 * [returned] state on screen; the two must agree.
 *
 * 'recalled' is deliberately not counted. A recalled report the desk
 * re-validates is [Routing incomplete], and [Finish routing] (routeReport)
 * sends it back to its mapped agencies: the backend's
 * incident_reports_reroute_recalled trigger reopens the recalled rows on the
 * move to 'routed' (20261031090000_recall_window, item 7). Counting it here
 * would refuse that route-back and send the desk to the out-of-scope picker
 * instead, which offers none of those agencies. Choosing other agencies for
 * a recalled report is a separate state, not built (owner decision).
 */
function everyAgencyReturned(rows: HeldRow[]): boolean {
  return rows.length > 0 && rows.every((r) => r.resolved_at !== null && r.resolution_outcome === "out-of-scope");
}

/**
 * Finishes a routing that stopped part-way.
 *
 * Every validated report now goes to the agencies an official ticks in the
 * agency list (routeReportToAgencies), with the category's agencies marked
 * Recommended rather than sent to by default: agencies asked for this
 * (2026-10-14), since not every office is on duty around the clock. So this
 * action never routes by the category mapping. It handles one case, a
 * report left 'validated' with agencies already holding it, which the queue
 * shows as [Routing incomplete] with [Finish routing]:
 *
 *   a. read the report (RLS scopes it to the barangay)
 *   b. read who holds it (agency_routing)
 *   c. nothing is inserted: the holders are the plan
 *   d. log_audit('report_routed_manual'), built from the held rows
 *   e. set status = 'routed' (the status trigger allows validated → routed)
 *
 * Steps d and e are sendAndRecord's, shared with the other two routing
 * actions: a failed audit write stops the run before the status, because
 * once 'routed' the report can never come back here to be logged.
 *
 * A recalled report re-validated by the desk is also [Routing incomplete]:
 * its rows are closed 'recalled', and the move to 'routed' has the backend's
 * incident_reports_reroute_recalled trigger reopen them, so finishing sends
 * it back to the same agencies. A run that stopped before every mapped
 * agency was inserted (possible only before 2026-10-14) finishes with the
 * agencies that hold it, never adding one nobody chose.
 */
export async function routeReport(reportId: string): Promise<RouteResult> {
  if (!isUuid(reportId)) {
    return { success: false, message: INVALID_REQUEST };
  }

  const supabase = createClient();

  // a. — in parallel with the session check, which only has to decide how to
  // read an empty result: under no session this SELECT returns zero rows, not
  // an error.
  const [session, reportRes, dispatchOn] = await Promise.all([
    sessionState(supabase),
    supabase.from("incident_reports").select("id, status, entry_tier").eq("id", reportId).maybeSingle(),
    readCdrrmoDispatchEnabled(supabase),
  ]);

  if (session !== "active") {
    return { success: false, message: SESSION_MESSAGE[session] };
  }

  const { data: report, error: reportError } = reportRes;
  if (reportError) {
    console.error("[routeReport] read failed", reportError.code, reportError.message);
    return { success: false, message: ROUTE_FAILED };
  }
  if (!report) {
    return { success: false, message: NOT_IN_BARANGAY };
  }
  if (report.status === "routed" || report.status === "resolved") {
    revalidatePath("/queue");
    return { success: false, message: await alreadyClosedMessage(supabase, reportId, report.status) };
  }
  if (report.status !== "validated") {
    // rejected is terminal; pending hasn't been reviewed. Neither routes.
    return { success: false, message: ONLY_VALIDATED };
  }
  if (emergencyGoesThroughDispatch(report.entry_tier, dispatchOn)) return dispatchActiveResult();

  // b.
  const held = await routingRows(supabase, reportId);
  if (held === null) return { success: false, message: ROUTE_FAILED };
  if (held.length === 0) {
    return { success: false, message: "Choose the agencies this report goes to, then route it." };
  }
  // A report every agency sent back is 'validated' again with its rows still
  // there. Finishing would mark it routed with nobody holding it, so the
  // official chooses other agencies instead (rerouteReport).
  if (everyAgencyReturned(held)) {
    revalidatePath("/queue");
    return {
      success: false,
      message: "Every agency sent this report back as out of scope. Choose another agency for it instead.",
    };
  }
  // c. Every agency in this plan already holds it, so nothing is inserted;
  // the audit row is built from the held rows (routedTo), not this plan.
  const plan = new Map(held.map((row): [string, boolean] => [row.agency_id, row.is_primary]));
  return sendAndRecord(supabase, reportId, plan, held);
}

/**
 * Sends a returned report to agencies an official chooses: a report every
 * agency it went to closed as out of scope, which the backend's handback puts
 * back to 'validated' (agreed with the backend owner 2026-09-29, live with
 * their next database push). Until then a returned report stays 'routed' and
 * never reaches this action.
 *
 * The category mapping is exactly who sent it back, so the agencies come from
 * the official — and ar_insert_barangay doesn't limit which agency a barangay
 * may route to. The choice is therefore proven here: every id must name an
 * agency that exists, and none may already hold the report. The first one
 * chosen leads (is_primary).
 *
 * From the insert on it is routeReport's contract, shared through
 * sendAndRecord: auto_routed = false, the audit row before the status, and
 * the same recovery. A run that stops after the insert leaves the report
 * 'validated' with an agency holding it open, which the queue shows as
 * [Routing incomplete]; routeReport finishes it from there.
 */
export async function rerouteReport(reportId: string, agencyIds: string[]): Promise<RouteResult> {
  const chosen = isUuid(reportId) ? chosenAgencies(agencyIds) : null;
  if (!chosen) {
    return { success: false, message: INVALID_REQUEST };
  }

  const supabase = createClient();

  // a. As in routeReport: the session check only decides how to read an
  // empty result.
  const [session, reportRes, dispatchOn] = await Promise.all([
    sessionState(supabase),
    supabase.from("incident_reports").select("id, status, entry_tier").eq("id", reportId).maybeSingle(),
    readCdrrmoDispatchEnabled(supabase),
  ]);

  if (session !== "active") {
    return { success: false, message: SESSION_MESSAGE[session] };
  }

  const { data: report, error: reportError } = reportRes;
  if (reportError) {
    console.error("[rerouteReport] read failed", reportError.code, reportError.message);
    return { success: false, message: ROUTE_FAILED };
  }
  if (!report) {
    return { success: false, message: NOT_IN_BARANGAY };
  }
  if (report.status === "routed" || report.status === "resolved") {
    revalidatePath("/queue");
    return { success: false, message: await alreadyClosedMessage(supabase, reportId, report.status) };
  }
  if (report.status !== "validated") {
    return { success: false, message: ONLY_VALIDATED };
  }
  // A handed-back Emergency report is CDRRMO's to send on while dispatch is
  // on; the desk can't pick its agencies.
  if (emergencyGoesThroughDispatch(report.entry_tier, dispatchOn)) return dispatchActiveResult();

  // Who holds it now, and whether the chosen agencies exist.
  const [rows, agenciesRes] = await Promise.all([
    routingRows(supabase, reportId),
    supabase.from("agencies").select("id").in("id", chosen),
  ]);
  if (rows === null) return { success: false, message: ROUTE_FAILED };
  if (agenciesRes.error) {
    console.error("[rerouteReport] agencies read failed", agenciesRes.error.code, agenciesRes.error.message);
    return { success: false, message: ROUTE_FAILED };
  }

  // Only a returned report goes to an agency of the official's choosing.
  // Anything else means the report changed after the picker opened.
  if (!everyAgencyReturned(rows)) {
    revalidatePath("/queue");
    return {
      success: false,
      message:
        rows.length === 0
          ? "This report hasn't been routed yet. Use Route to agency."
          : "An agency already holds this report — another official may have routed it. Refresh to see where it stands.",
    };
  }

  const known = new Set(((agenciesRes.data ?? []) as { id: string }[]).map((a) => a.id.toLowerCase()));
  if (!chosen.every((agencyId) => known.has(agencyId))) {
    return { success: false, message: "One of the chosen agencies wasn't found. Refresh, then choose again." };
  }
  const held = new Set(rows.map((row) => row.agency_id.toLowerCase()));
  if (chosen.some((agencyId) => held.has(agencyId))) {
    return { success: false, message: "One of the chosen agencies already sent this report back. Choose another." };
  }

  const plan = new Map(chosen.map((agencyId, index): [string, boolean] => [agencyId, index === 0]));
  return sendAndRecord(supabase, reportId, plan, rows);
}

/**
 * Sends a validated report to the agencies an official ticked for it, like
 * tagging it with the offices it belongs to. The category's agencies are
 * shown as Recommended and nothing is ticked in advance: agencies asked
 * (2026-10-14) that the barangay choose, because not every office is on
 * duty around the clock. Emergencies included, while CDRRMO dispatch is
 * off; with it on, the database routes an Emergency report on validation.
 *
 * ar_insert_barangay doesn't limit which agency a barangay may route to, so
 * the choice is proven here, as in rerouteReport: the report is validated
 * and held by no agency yet (a held one is either
 * half-routed, which routeReport finishes, or returned, which rerouteReport
 * handles); every id names an agency that exists. The first one chosen leads
 * (is_primary). From the insert on it is routeReport's contract, through
 * sendAndRecord.
 */
export async function routeReportToAgencies(reportId: string, agencyIds: string[]): Promise<RouteResult> {
  const chosen = isUuid(reportId) ? chosenAgencies(agencyIds) : null;
  if (!chosen) {
    return { success: false, message: INVALID_REQUEST };
  }

  const supabase = createClient();

  const [session, reportRes, dispatchOn] = await Promise.all([
    sessionState(supabase),
    supabase.from("incident_reports").select("id, status, entry_tier").eq("id", reportId).maybeSingle(),
    readCdrrmoDispatchEnabled(supabase),
  ]);

  if (session !== "active") {
    return { success: false, message: SESSION_MESSAGE[session] };
  }

  const { data: report, error: reportError } = reportRes;
  if (reportError) {
    console.error("[routeReportToAgencies] read failed", reportError.code, reportError.message);
    return { success: false, message: ROUTE_FAILED };
  }
  if (!report) {
    return { success: false, message: NOT_IN_BARANGAY };
  }
  if (report.status === "routed" || report.status === "resolved") {
    revalidatePath("/queue");
    return { success: false, message: await alreadyClosedMessage(supabase, reportId, report.status) };
  }
  if (report.status !== "validated") {
    return { success: false, message: ONLY_VALIDATED };
  }
  // With CDRRMO dispatch on, an Emergency report is routed by the database
  // on validation: the desk's ticks go through validate_emergency_report()
  // (owner decision Q4), never through this insert, which this refuses.
  if (emergencyGoesThroughDispatch(report.entry_tier, dispatchOn)) return dispatchActiveResult();

  const [rows, agenciesRes] = await Promise.all([
    routingRows(supabase, reportId),
    supabase.from("agencies").select("id").in("id", chosen),
  ]);
  if (rows === null) return { success: false, message: ROUTE_FAILED };
  if (agenciesRes.error) {
    console.error(
      "[routeReportToAgencies] agencies read failed",
      agenciesRes.error.code,
      agenciesRes.error.message
    );
    return { success: false, message: ROUTE_FAILED };
  }
  if (rows.length > 0) {
    // The report changed after the picker opened: another official routed
    // it, or a run stopped part-way. The queue shows which.
    revalidatePath("/queue");
    return {
      success: false,
      message:
        "An agency already holds this report — another official may have routed it. Refresh to see where it stands.",
    };
  }

  const known = new Set(((agenciesRes.data ?? []) as { id: string }[]).map((a) => a.id.toLowerCase()));
  if (!chosen.every((agencyId) => known.has(agencyId))) {
    return { success: false, message: "One of the chosen agencies wasn't found. Refresh, then choose again." };
  }

  const plan = new Map(chosen.map((agencyId, index): [string, boolean] => [agencyId, index === 0]));
  return sendAndRecord(supabase, reportId, plan, []);
}

/**
 * The agency ids a picker sent, proven: 1 to MAX_BULK uuids, de-duplicated
 * in the order chosen so the first stays the lead. null for anything else.
 */
function chosenAgencies(agencyIds: unknown): string[] | null {
  if (
    !Array.isArray(agencyIds) ||
    agencyIds.length === 0 ||
    agencyIds.length > MAX_BULK ||
    !agencyIds.every((id) => typeof id === "string" && isUuid(id))
  ) {
    return null;
  }
  return [...new Set((agencyIds as string[]).map((id) => id.toLowerCase()))];
}

/**
 * Steps c to e, shared by routeReport and rerouteReport: send the report to
 * every agency in plan that doesn't hold it yet, record the routing, then
 * mark it routed. plan maps each agency to whether it leads (is_primary);
 * existingRows are the routing rows read before this pass.
 */
async function sendAndRecord(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  plan: Map<string, boolean>,
  existingRows: HeldRow[]
): Promise<RouteResult> {
  const existing = new Set(existingRows.map((row) => row.agency_id.toLowerCase()));
  const missing = [...plan.keys()].filter((agencyId) => !existing.has(agencyId.toLowerCase()));
  if (missing.length > 0) {
    const rows = missing.map((agencyId) => routingRow(reportId, agencyId, plan.get(agencyId) ?? false));
    const { error: insertError } = await supabase.from("agency_routing").insert(rows);

    if (isCdrrmoDispatchActiveError(insertError)) {
      // The switch went on after this action's own check. The insert is one
      // statement, so none of its rows were written.
      return dispatchActiveResult();
    }
    if (isLeadTaken(insertError)) {
      // Not retried: another official's lead holds the report, and adding
      // this run's other agencies under it would leave a routing nobody
      // chose. No audit row, no status change.
      console.error("[routeReport] lead already taken", insertError?.code);
      return leadTakenResult();
    }
    if (insertError?.code === "23505") {
      // agency_routing is UNIQUE (incident_report_id, agency_id), and a
      // multi-row INSERT is one statement: a single duplicate aborts it, so
      // NONE of this run's rows were written — not [they all exist]. Some
      // other writer got there first with at least one of them. Re-read, and
      // insert whatever is still missing one row at a time, where a 23505
      // really does mean that row is present.
      const recovered = await insertRemainingIndividually(supabase, reportId, plan);
      if (recovered === "lead-taken") return leadTakenResult();
      if (recovered === "dispatch-active") return dispatchActiveResult();
      if (recovered === "failed") {
        revalidatePath("/queue");
        return {
          success: false,
          message: "Couldn't confirm every agency received it. Select Finish routing to complete it.",
        };
      }
    } else if (insertError) {
      console.error("[routeReport] insert failed", insertError.code, insertError.message);
      if (insertError.code !== "42501") return { success: false, message: ROUTE_FAILED };
      // 42501 is also the answer when the report was resolved at the
      // barangay between this action's first read and its insert: no agency
      // row may be added to a resolved report. One read tells that apart
      // from a report outside this barangay; a failed read keeps the
      // general message.
      const { data: now } = await supabase
        .from("incident_reports")
        .select("status")
        .eq("id", reportId)
        .maybeSingle();
      if (now?.status === "resolved") {
        revalidatePath("/queue");
        return { success: false, message: RESOLVED_AT_BARANGAY };
      }
      return { success: false, message: "Not permitted — this report isn't in your barangay's scope." };
    }
  }

  // From here the agencies can already see the report. Every failure below
  // leaves it 'validated' with an agency holding it, which the queue shows
  // as [Routing incomplete] with a button that runs routeReport to finish.
  const incomplete = (what: string) => {
    revalidatePath("/queue");
    return {
      success: false,
      message: `Sent to the agencies, but ${what}. Select Finish routing to complete it.`,
    };
  };

  // d. Which agencies, and which one leads, so the trail can answer who
  // the report was sent to without a join against agency_routing (whose rows
  // a later recall or reroute can change). Built from the rows, not the plan:
  // a [Finish routing] after a re-route carries the mapping as its plan,
  // which names the agencies that sent the report back (routedTo).
  // log_audit() puts no shape rule on this action's metadata.
  const sent = routedTo(
    existingRows,
    new Map(missing.map((agencyId): [string, boolean] => [agencyId, plan.get(agencyId) ?? false]))
  );
  const { error: auditError } = await supabase.rpc("log_audit", {
    p_action: "report_routed_manual",
    p_report_id: reportId,
    p_metadata: {
      agency_count: sent.agencyIds.length,
      agency_ids: sent.agencyIds,
      lead_agency_id: sent.leadAgencyId,
    },
  });
  if (auditError) {
    console.error("[routeReport] log_audit failed", auditError.code, auditError.message);
    return incomplete("the routing couldn't be recorded in the audit trail");
  }

  // e. Guarded on the current status so a concurrent route can't be
  // overwritten.
  const { data: updated, error: statusError } = await supabase
    .from("incident_reports")
    .update({ status: "routed" })
    .eq("id", reportId)
    .eq("status", "validated")
    .select("id");

  if (isCdrrmoDispatchActiveError(statusError)) {
    // The switch went on between this action's check and here. The rows and
    // the audit row above stay; the move to 'routed' is CDRRMO dispatch's
    // now, and the desk's Validate takes it from here.
    console.error("[routeReport] status refused: cdrrmo dispatch active", statusError?.code);
    return dispatchActiveResult();
  }
  if (statusError?.code === "23514") {
    // The backend's guard (agreed 2026-09-29): a report can't become
    // 'routed' while no agency holds it open. Every agency closed its part
    // between the read above and this update, so there is nothing to finish
    // — [Finish routing] would only meet the guard again.
    console.error("[routeReport] status refused by a check", statusError.code, statusError.message);
    revalidatePath("/queue");
    return {
      success: false,
      message: "No agency still holds this report, so it can't be marked as routed. Refresh to see where it stands.",
    };
  }
  if (statusError) {
    console.error("[routeReport] status update failed", statusError.code, statusError.message);
    return incomplete("its status couldn't be updated");
  }

  // Zero rows back is ambiguous, and the difference matters: either another
  // official moved it first (fine — it's routed), or RLS filtered the UPDATE
  // out, which Postgres does silently, with no error. Only a re-read tells
  // them apart; assuming success here would report a routing that never
  // finished.
  if (!updated || updated.length === 0) {
    const { data: now } = await supabase
      .from("incident_reports")
      .select("status")
      .eq("id", reportId)
      .maybeSingle();
    if (now?.status !== "routed" && now?.status !== "resolved") {
      return incomplete("its status couldn't be updated");
    }
  }

  revalidatePath("/queue");
  return { success: true, agencyCount: sent.agencyIds.length };
}

function routingRow(reportId: string, agencyId: string, isPrimary: boolean) {
  // Only these four columns are insert-grantable, and ar_insert_barangay
  // requires auto_routed = false: a barangay can only route by hand.
  return { incident_report_id: reportId, agency_id: agencyId, is_primary: isPrimary, auto_routed: false };
}

/** The agencies that hold this report and how far each got, or null if the read failed. */
async function routingRows(
  supabase: ReturnType<typeof createClient>,
  reportId: string
): Promise<HeldRow[] | null> {
  const { data, error } = await supabase
    .from("agency_routing")
    .select("agency_id, is_primary, routed_at, resolved_at, resolution_outcome")
    .eq("incident_report_id", reportId);
  if (error) {
    console.error("[routeReport] existing read failed", error.code, error.message);
    return null;
  }
  return (data ?? []) as HeldRow[];
}

/**
 * Whether another routing's lead holds the report open: an open row
 * (is_primary, resolved_at null) for an agency this plan doesn't lead with.
 * Only a plan that has a lead can collide with one; a plan without a lead
 * adds supporting agencies, which the one-open-lead guard allows.
 */
function foreignOpenLead(rows: HeldRow[], plan: Map<string, boolean>): boolean {
  const planLeads = new Set(
    [...plan].filter(([, isPrimary]) => isPrimary).map(([agencyId]) => agencyId.toLowerCase())
  );
  if (planLeads.size === 0) return false;
  return rows.some(
    (row) => row.is_primary && row.resolved_at === null && !planLeads.has(row.agency_id.toLowerCase())
  );
}

/**
 * Recovery after a multi-row insert lost a race. Returns "ok" only once a
 * re-read proves every planned agency holds the report — the audit and status
 * steps must not run on an assumption.
 *
 * If another official's lead already holds the report the run stops
 * ("lead-taken") before any of its own rows are written, rather than leaving
 * its other agencies under a lead it didn't choose: first by the re-read
 * (an open lead this plan doesn't name), then by the guard itself, since the
 * lead is inserted first and only a lead row can meet it.
 */
async function insertRemainingIndividually(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  plan: Map<string, boolean>
): Promise<"ok" | "lead-taken" | "dispatch-active" | "failed"> {
  const rows = await routingRows(supabase, reportId);
  if (rows === null) return "failed";

  // The lost race can answer 23505 rather than the guard's 23P01 when one of
  // this plan's agencies, its lead included, is already held under another
  // official's lead: the duplicate aborts the statement first. Skipping the
  // present agencies would then add the rest under that lead and record this
  // plan's lead in the audit row — so an open lead this plan didn't choose
  // stops the run here, before anything is written.
  if (foreignOpenLead(rows, plan)) {
    console.error("[routeReport] recovery: another lead holds the report");
    return "lead-taken";
  }
  const present = new Set(rows.map((row) => row.agency_id.toLowerCase()));

  const leadFirst = [...plan].sort(([, a], [, b]) => Number(b) - Number(a));
  for (const [agencyId, isPrimary] of leadFirst) {
    if (present.has(agencyId.toLowerCase())) continue;
    const { error } = await supabase.from("agency_routing").insert(routingRow(reportId, agencyId, isPrimary));
    if (isCdrrmoDispatchActiveError(error)) return "dispatch-active";
    if (isLeadTaken(error)) {
      console.error("[routeReport] recovery: lead already taken", error?.code);
      return "lead-taken";
    }
    if (error && error.code !== "23505") {
      console.error("[routeReport] recovery insert failed", error.code, error.message);
      return "failed";
    }
  }

  const after = await routingRows(supabase, reportId);
  if (after === null) return "failed";
  const held = new Set(after.map((row) => row.agency_id.toLowerCase()));
  return [...plan.keys()].every((agencyId) => held.has(agencyId.toLowerCase())) ? "ok" : "failed";
}

const RESOLVE_FAILED = "Something went wrong. The report wasn't resolved — try again.";

/**
 * Console-owned text for a refusal by resolve_report_at_barangay(), or null
 * for one the contract doesn't name. Chosen by the token in details where
 * there is one; a token this console hasn't seen falls back to its code.
 */
function resolveRefusal(error: { code?: string; details?: string | null }): string | null {
  const token = error.details ?? "";
  if (error.code === "22023") return "The note wasn't accepted. Write what was done, in 1,000 characters or fewer.";
  if (error.code === "42501") {
    if (token.includes("not_other_report")) return "Emergency reports go to an agency. Use Route to agency.";
    if (token.includes("out_of_scope")) return NOT_IN_BARANGAY;
    if (token.includes("no_barangay")) {
      return "Your account isn't assigned to a barangay, so it can't resolve reports. Ask an administrator.";
    }
    return "Not permitted — your account can't resolve reports at the barangay.";
  }
  if (error.code === "55000") {
    if (token.includes("agency_holds")) {
      return "An agency already has this report, so it can't be resolved at the barangay.";
    }
    return "Someone else already routed or resolved this report.";
  }
  return null;
}

/**
 * Closes a validated Other-report at the barangay, without sending it to any
 * agency: the desk handled it itself. Emergencies never take this path; they
 * always go to an agency.
 *
 * The write is one backend function, resolve_report_at_barangay(p_report_id,
 * p_note), agreed with the backend owner on 2026-10-05: in one transaction
 * it locks the report, sets the status and a resolved-at marker, saves the
 * note and writes the audit row, so there is no part-way state to finish,
 * as there is with routing's separate steps. It returns 'resolved', or
 * 'already_resolved' when the same official repeats the same note; both
 * mean the report is resolved. Until it is live BARANGAY_RESOLVE_LIVE is
 * false and this action refuses before any read.
 *
 * Its refusals carry a stable token in the error's details, and that token
 * is what the answer is chosen by, never the message text. One difference
 * from review_report(): a report in the wrong state is 55000, not 42501.
 *
 * The checks before the call repeat what the function is asked to enforce.
 * They are here so the official gets a specific answer (already routed, not
 * an Other-report) rather than one refusal code for all of them, and because
 * this is a public endpoint whatever the buttons show.
 *
 * Only a report no agency has ever held. One that an agency holds, or that
 * agencies sent back, keeps its routing actions: closing it here would hide
 * what the agencies did with it behind [resolved].
 */
export async function resolveAtBarangay(reportId: string, note: string): Promise<UpdateResult> {
  if (!BARANGAY_RESOLVE_LIVE) {
    return { success: false, message: "Resolving at the barangay isn't available yet." };
  }
  if (!isUuid(reportId) || typeof note !== "string") {
    return { success: false, message: INVALID_REQUEST };
  }
  const trimmed = note.trim();
  if (trimmed.length === 0) {
    return { success: false, message: "Add a note saying what was done." };
  }
  if (trimmed.length > MAX_REASON_LENGTH) {
    return { success: false, message: `A note can be at most ${MAX_REASON_LENGTH} characters.` };
  }

  const supabase = createClient();

  // As in routeReport: the session check only decides how to read an empty
  // result.
  const [session, reportRes] = await Promise.all([
    sessionState(supabase),
    supabase.from("incident_reports").select("id, status, entry_tier").eq("id", reportId).maybeSingle(),
  ]);

  if (session !== "active") {
    return { success: false, message: SESSION_MESSAGE[session] };
  }

  const { data: report, error: reportError } = reportRes;
  if (reportError) {
    console.error("[resolveAtBarangay] read failed", reportError.code, reportError.message);
    return { success: false, message: RESOLVE_FAILED };
  }
  if (!report) {
    return { success: false, message: NOT_IN_BARANGAY };
  }
  if (report.status === "routed" || report.status === "resolved") {
    revalidatePath("/queue");
    return {
      success: false,
      message: "Already routed or resolved — another official may have handled it first.",
    };
  }
  if (report.status !== "validated") {
    return { success: false, message: "Only validated reports can be resolved at the barangay." };
  }
  if (report.entry_tier !== "other_reports") {
    return { success: false, message: "Emergency reports go to an agency. Use Route to agency." };
  }

  const rows = await routingRows(supabase, reportId);
  if (rows === null) return { success: false, message: RESOLVE_FAILED };
  if (rows.length > 0) {
    revalidatePath("/queue");
    return {
      success: false,
      message:
        "An agency already has this report, so it can't be resolved at the barangay. Refresh to see where it stands.",
    };
  }

  const { error, status: httpStatus } = await supabase.rpc("resolve_report_at_barangay", {
    p_report_id: reportId,
    p_note: trimmed,
  });

  if (error) {
    const transport = transportMessage(httpStatus, error);
    if (transport) return { success: false, message: transport };
    const message = resolveRefusal(error);
    // 55000: the report changed since the page loaded, so show where it
    // stands now.
    if (error.code === "55000") revalidatePath("/queue");
    if (message) return { success: false, message };
    console.error("[resolveAtBarangay] refused", error.code, error.details, error.message);
    return { success: false, message: RESOLVE_FAILED };
  }

  revalidatePath("/queue");
  return { success: true };
}

export interface BulkValidateResult {
  validated: number;
  // reason "cdrrmo-dispatch-active": an Emergency member refused because
  // CDRRMO dispatch is on (src/lib/cdrrmo-dispatch.ts); the page words it.
  failures: { reportId: string; message: string; reason?: "cdrrmo-dispatch-active" }[];
}

/**
 * Validates every report in a duplicate cluster, one review_report() call per
 * member.
 *
 * There is no bulk RPC and no transaction spanning the set, so this is not
 * all-or-nothing: some members can succeed while others fail, most often with
 * 55000 because another official reviewed one of them first. The caller gets
 * both counts and must say so — reporting a partial run as success is exactly
 * the failure this button had before it did any work at all.
 *
 * Sequential rather than Promise.all: these are writes against the same
 * cluster, and a failure part-way through shouldn't leave the rest in flight.
 * A transport failure (no network, no session) stops the loop: every remaining
 * member would fail the same way, so they're reported with that one message
 * rather than tried and failed one by one.
 */
export async function validateReports(reportIds: string[]): Promise<BulkValidateResult> {
  // Proven before any work: a short array of uuids, de-duplicated. Rejected as
  // one failure, not one per element — the input may be enormous, and
  // reflecting it back would make the response as large as the request.
  if (
    !Array.isArray(reportIds) ||
    reportIds.length === 0 ||
    reportIds.length > MAX_BULK ||
    !reportIds.every(isUuid)
  ) {
    return { validated: 0, failures: [{ reportId: "", message: INVALID_REQUEST }] };
  }
  const ids = [...new Set(reportIds.map((id) => id.toLowerCase()))];

  const supabase = createClient();
  const failures: BulkValidateResult["failures"] = [];
  let validated = 0;

  for (let index = 0; index < ids.length; index++) {
    const reportId = ids[index];
    const { error, status } = await supabase.rpc("review_report", {
      p_report_id: reportId,
      p_decision: "validated",
      p_reason: null,
    });

    if (!error) {
      validated += 1;
      continue;
    }

    const transport = transportMessage(status, error);
    if (transport) {
      for (const remaining of ids.slice(index)) failures.push({ reportId: remaining, message: transport });
      break;
    }
    if (isCdrrmoDispatchActiveError(error)) {
      // An Emergency member while CDRRMO dispatch is on: it is validated one
      // at a time, through Validate, which routes it too.
      failures.push({ reportId, message: DISPATCH_ACTIVE, reason: "cdrrmo-dispatch-active" });
      continue;
    }
    failures.push({
      reportId,
      message: (await alreadyDecidedMessage(supabase, reportId, error)) ?? messageForReviewError(error),
    });
  }

  if (validated > 0) revalidatePath("/queue");
  return { validated, failures };
}
