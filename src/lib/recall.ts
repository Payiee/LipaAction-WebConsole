/**
 * The barangay Recall screen's rules (RECALL-UI). Spec: LipaAction
 * docs/specs/2026-10-14-barangay-recall-screen-design.md. Pure, with no
 * runtime imports, so `npm run check:recall` (scripts/check-recall.mjs) can
 * load it in plain Node.
 *
 * The backend decides everything. recall_auto_routed_report(p_report_id,
 * p_severity, p_reason) is SECURITY DEFINER, EXECUTE for authenticated
 * (20261031090000_recall_window.sql:444 and :600-601), redefined with the
 * responder window by 20261130120000_responder_routing.sql:499 (same
 * signature, results and SQLSTATEs). What this file computes on the client is
 * advisory: which rows offer a button, and the countdown. A desk whose clock
 * is off still gets the server's answer, and the toast says what it was.
 */

// ---------------------------------------------------------------------------
// Contract names and constants.

export const RECALL_RPC = "recall_auto_routed_report";

/**
 * recall_window_ends_at(p_report): SECURITY INVOKER, read only, EXECUTE for
 * authenticated (20261031090000_recall_window.sql:197-216; body redefined at
 * 20261130120000_responder_routing.sql:476). Called once per page session,
 * from the browser (RecallContext), on one report, as a probe that the recall
 * functions are deployed (they ship in the same migration). Not called per
 * row (spec section 5), and not on every refresh.
 */
export const RECALL_PROBE_RPC = "recall_window_ends_at";

/**
 * responders_for_reports(p_report_ids uuid[]) returns (report_id, unit_label):
 * the responder's UNIT only, never a name or phone
 * (20261130090000_responder_credentials.sql:605-633). The desk gate is the
 * report's own barangay. More than 200 ids is 22023 (:617).
 */
export const RESPONDERS_RPC = "responders_for_reports";
export const RESPONDERS_MAX_IDS = 200;

/**
 * The inbox kind written for each desk role when a responder's report is
 * routed without the desk (20261130120000_responder_routing.sql:257, added to
 * notifications_kind_check at :673). The Critical escalation timer writes no
 * desk notification, so the header count covers responder routes only.
 */
export const DESK_AUTO_ROUTED_KIND = "desk_report_auto_routed";

// The unread ones the header counts. The cap only bounds the read; the badge
// says [50+] at the cap.
export const UNREAD_AUTO_ROUTED_LIMIT = 50;

// 20261031090000_recall_window.sql:479
export const RECALL_SEVERITIES = ["none", "safety_net_trip", "classifier_wrong", "agency_mismatch"] as const;
export type RecallSeverity = (typeof RECALL_SEVERITIES)[number];

// 20261031090000_recall_window.sql:483: 1 to 500 characters after trimming.
export const RECALL_REASON_MAX = 500;

// recall_window_minutes(): Critical 5, High 15, any other class none
// (20261031090000_recall_window.sql:188).
export const CLASS_WINDOW_MINUTES = { Critical: 5, High: 15 } as const;

// recall_window_minutes_for_report(): a responder's report with no escalated
// routing row gets Critical 5, every other class 15
// (20261130120000_responder_routing.sql, section 3).
export const RESPONDER_WINDOW_MINUTES = { Critical: 5, other: 15 } as const;

// The longest any window runs. Past this, every eligible report is closed.
export const MAX_WINDOW_MINUTES = 15;

/**
 * agency_routing columns the recall reading needs beyond what the queue
 * already loaded: the dispatch stamps (20261019090000_agency_dispatch_stamps.sql:67-69,
 * plus in_progress_at) and the timer's flag
 * (20261127090000_critical_escalation_timer.sql:176). Table-wide SELECT for
 * authenticated, rows scoped by ar_select_barangay.
 */
export const ROUTING_DISPATCH_COLUMNS = "unit_assigned_at, en_route_at, on_scene_at, in_progress_at, escalated";

// ---------------------------------------------------------------------------
// Input checks. The server action runs these before any call; the dialog uses
// the same ones to enable its confirm button.

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The RPC's btrim(p_reason, E' \t\r\n'): spaces, tabs and newlines only. */
export function trimRecallReason(reason: string): string {
  return reason.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
}

/** Postgres char_length counts code points, not UTF-16 units. */
export function recallReasonLength(reason: string): number {
  return [...reason].length;
}

export function isRecallSeverity(value: unknown): value is RecallSeverity {
  return typeof value === "string" && (RECALL_SEVERITIES as readonly string[]).includes(value);
}

export type RecallInput =
  | { ok: true; reportId: string; severity: RecallSeverity; reason: string }
  | { ok: false };

export function validateRecallInput(reportId: unknown, severity: unknown, reason: unknown): RecallInput {
  if (typeof reportId !== "string" || !UUID_SHAPE.test(reportId)) return { ok: false };
  if (!isRecallSeverity(severity)) return { ok: false };
  if (typeof reason !== "string") return { ok: false };
  const trimmed = trimRecallReason(reason);
  const length = recallReasonLength(trimmed);
  if (length === 0 || length > RECALL_REASON_MAX) return { ok: false };
  return { ok: true, reportId, severity, reason: trimmed };
}

// ---------------------------------------------------------------------------
// Where a report stands for a recall.

export interface RecallRoutingRow {
  agencyName?: string;
  autoRouted: boolean;
  routedAt: string | null;
  resolvedAt: string | null;
  unitAssignedAt: string | null;
  enRouteAt: string | null;
  onSceneAt: string | null;
  inProgressAt: string | null;
  escalated: boolean;
}

export interface RecallSubject {
  status: string;
  reviewedAt: string | null;
  priority: string | null;
  // The report carries a responder credential, as far as the desk can tell
  // (responders_for_reports answered with a unit). false when the read failed
  // or the credential was anonymised: the class window applies then, which
  // can only make the client read a window as shorter or absent, never open
  // a button the server would refuse (closed still offers Record recall).
  responder: boolean;
  routing: RecallRoutingRow[];
}

export type RecallState =
  // Not recallable: no button anywhere.
  | { kind: "none" }
  // Window open, no open row dispatched: the primary Recall.
  | { kind: "open"; endsAt: number; escalated: boolean }
  // Window open, but an open row has a unit assigned, en route, on scene or
  // in progress: the RPC answers after_dispatch. Secondary Record recall.
  | { kind: "dispatched"; endsAt: number; escalated: boolean; agency: string | null }
  // Window over, or no window for the class (endsAt null): the RPC answers
  // after_window. Secondary Record recall (Chapter 3 T04).
  | { kind: "closed"; endsAt: number | null; escalated: boolean };

/** recall_window_minutes_for_report(), from what the desk can read. */
export function recallWindowMinutes(priority: string | null, responder: boolean, escalated: boolean): number | null {
  if (responder && !escalated) {
    return priority === "Critical" ? RESPONDER_WINDOW_MINUTES.Critical : RESPONDER_WINDOW_MINUTES.other;
  }
  if (priority === "Critical") return CLASS_WINDOW_MINUTES.Critical;
  if (priority === "High") return CLASS_WINDOW_MINUTES.High;
  return null;
}

function isDispatched(r: RecallRoutingRow): boolean {
  return Boolean(r.unitAssignedAt || r.enRouteAt || r.onSceneAt || r.inProgressAt);
}

/**
 * The RPC's checks in its order (20261130120000_responder_routing.sql:556-585):
 * routed, never reviewed, at least one row, every row auto_routed, at least
 * one open; then the window (window first), then dispatch. `mark` is the
 * page's memory of an info-only answer the server already gave for this
 * report (spec section 8): it can move open to dispatched or closed, never
 * make a report recallable.
 */
export function recallState(
  subject: RecallSubject | null,
  now: number,
  mark: "dispatched" | "closed" | null = null
): RecallState {
  if (!subject) return { kind: "none" };
  const rows = subject.routing;
  if (subject.status !== "routed" || subject.reviewedAt !== null) return { kind: "none" };
  if (rows.length === 0 || rows.some((r) => !r.autoRouted)) return { kind: "none" };
  const open = rows.filter((r) => !r.resolvedAt);
  if (open.length === 0) return { kind: "none" };

  const escalated = rows.some((r) => r.escalated);
  const minutes = recallWindowMinutes(subject.priority, subject.responder, escalated);
  const routedTimes = rows.map((r) => (r.routedAt ? Date.parse(r.routedAt) : Number.NaN));
  // An undated row: the window can't be placed, so read it as closed.
  if (minutes === null || routedTimes.some((t) => Number.isNaN(t))) {
    return { kind: "closed", endsAt: null, escalated };
  }
  const endsAt = Math.min(...routedTimes) + minutes * 60_000;
  if (now > endsAt || mark === "closed") return { kind: "closed", endsAt, escalated };

  const dispatchedRow = open.find(isDispatched);
  if (dispatchedRow || mark === "dispatched") {
    return { kind: "dispatched", endsAt, escalated, agency: dispatchedRow?.agencyName ?? null };
  }
  return { kind: "open", endsAt, escalated };
}

/**
 * Which button a state offers: the primary Recall, the secondary Record
 * recall (dispatched, or the window closed: spec Q2 keeps it for T04), or
 * nothing. `available` is false when the recall functions are not deployed
 * or the probe failed: fail closed, no button.
 */
/**
 * Whether the dialog warns that the Critical escalation timer will never send
 * the report again. Timer rule i refuses any report with an agency_routing
 * row, open or closed ("previously_routed",
 * 20261127090000_critical_escalation_timer.sql:54), so ANY recall of a
 * Critical report ends its safety net, a responder's route included. Shown
 * whenever the recall may really take the report back: an open window, or a
 * closed one the server may still see open (the browser clock is advisory).
 * Not for dispatched: that answer is after_dispatch or after_window, never a
 * recall.
 */
export function timerNoticeApplies(priority: string | null, kind: RecallState["kind"]): boolean {
  return priority === "Critical" && (kind === "open" || kind === "closed");
}

/**
 * Which description the dialog shows. A closed window is the browser's
 * reading only (clock skew, a responder lookup that failed, an anonymised
 * credential), so its copy never claims the outcome: the server decides.
 */
export type RecallDialogCopy = "open" | "dispatched" | "closedAt" | "mayHaveClosed" | "none";

export function recallDialogCopy(state: RecallState): RecallDialogCopy {
  switch (state.kind) {
    case "open":
      return "open";
    case "dispatched":
      return "dispatched";
    case "closed":
      return state.endsAt === null ? "mayHaveClosed" : "closedAt";
    default:
      return "none";
  }
}

/**
 * True while any window could still be open for this routing: the earliest
 * routed_at is less than MAX_WINDOW_MINUTES ago. A surface ticks once a
 * second only then; afterwards nothing on it can change by the second.
 */
export function windowMayBeOpen(routing: { routedAt: string | null }[], now: number): boolean {
  const times = routing.map((r) => (r.routedAt ? Date.parse(r.routedAt) : Number.NaN)).filter((t) => !Number.isNaN(t));
  if (times.length === 0) return false;
  return now <= Math.min(...times) + MAX_WINDOW_MINUTES * 60_000;
}

/** Where a countdown stands, for the one-minute and closed announcements. */
export type RecallPhase = "open" | "minute" | "closed" | "other";

export function recallPhase(state: RecallState, now: number): RecallPhase {
  if (state.kind === "open") return state.endsAt - now < 60_000 ? "minute" : "open";
  if (state.kind === "closed" && state.endsAt !== null) return "closed";
  return "other";
}

/**
 * What to announce when the phase moves from `previous` to `next`: only a
 * crossing seen on screen. Never on mount (previous undefined), never twice.
 */
export function announcementFor(previous: RecallPhase | undefined, next: RecallPhase): "oneMinute" | "closed" | null {
  if (previous === undefined || previous === next) return null;
  if (next === "minute" && previous === "open") return "oneMinute";
  if (next === "closed" && (previous === "open" || previous === "minute")) return "closed";
  return null;
}

export function mayOfferRecall(state: { kind: RecallState["kind"] }, available: boolean): "recall" | "record" | null {
  if (!available) return null;
  if (state.kind === "open") return "recall";
  if (state.kind === "dispatched" || state.kind === "closed") return "record";
  return null;
}

// ---------------------------------------------------------------------------
// Countdown (advisory, the browser's clock: spec section 5, Q6).

/** m:ss left, rounded up, so it reads 0:00 exactly when the window closes. */
export function formatCountdown(msLeft: number): string {
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function countdown(endsAt: number, now: number) {
  const msLeft = endsAt - now;
  return {
    msLeft,
    text: formatCountdown(msLeft),
    underMinute: msLeft < 60_000,
    // The RPC's `now() > v_ends`: at the end itself it is still open.
    expired: msLeft < 0,
  };
}

// ---------------------------------------------------------------------------
// The answer.

export type RecallOutcome =
  | "recalled"
  | "after_window"
  | "after_window_no_window"
  | "after_dispatch"
  // 42501: no caller, wrong role, not found, another barangay (one answer).
  | "not-permitted"
  // 22023: bad severity or reason. The action checks first, so rare.
  | "invalid"
  // 55000: no longer recallable (recalled, reviewed, hand-routed, no open row).
  | "stale"
  // PGRST202 / 42883: the function is not deployed.
  | "unavailable"
  | "unreachable"
  | "session-expired"
  | "unknown";

/**
 * Maps the RPC's answer by result text or SQLSTATE alone. The function's
 * errors carry no DETAIL token (spec section 2), and its message names
 * tables: it never reaches the screen.
 */
export function mapRecallResult(answer: {
  data: unknown;
  error: { code?: string; message?: string; details?: string | null } | null;
  status: number;
}): RecallOutcome {
  const { data, error, status } = answer;
  if (error) {
    const code = error.code ?? "";
    if (status === 0) return "unreachable";
    if (status === 401 || code.startsWith("PGRST30")) return "session-expired";
    if (code === "42501") return "not-permitted";
    if (code === "22023") return "invalid";
    if (code === "55000") return "stale";
    if (code === "PGRST202" || code === "42883") return "unavailable";
    console.error("[recall] unexpected error", JSON.stringify({ status, code }));
    return "unknown";
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) return "unknown";
  const { result, window_minutes: windowMinutes } = data as { result?: unknown; window_minutes?: unknown };
  if (result === "recalled") return "recalled";
  if (result === "after_dispatch") return "after_dispatch";
  if (result === "after_window") return windowMinutes === null || windowMinutes === undefined ? "after_window_no_window" : "after_window";
  console.error("[recall] unexpected result", JSON.stringify({ result }));
  return "unknown";
}

/**
 * Answers after which /queue is revalidated: a recall moved the report back
 * to Emergency; 55000 means the screen is behind; an unknown answer may
 * follow a write. Info-only answers change no row (spec section 8).
 */
export function refreshesAfterRecall(outcome: RecallOutcome): boolean {
  return outcome === "recalled" || outcome === "stale" || outcome === "unknown";
}

/** The dialog stays open, with the typed text, only when a retry can work. */
export function closesRecallDialog(outcome: RecallOutcome): boolean {
  return outcome !== "invalid" && outcome !== "unreachable" && outcome !== "session-expired";
}

/** Info results are a recorded outcome: not an error, and not success green. */
export function recallToastTone(outcome: RecallOutcome): "success" | "info" | "danger" {
  if (outcome === "recalled") return "success";
  if (outcome === "after_window" || outcome === "after_window_no_window" || outcome === "after_dispatch") return "info";
  return "danger";
}

/** What the page remembers about a report after an info-only answer. */
export function localMarkAfter(outcome: RecallOutcome): "dispatched" | "closed" | null {
  if (outcome === "after_dispatch") return "dispatched";
  if (outcome === "after_window" || outcome === "after_window_no_window") return "closed";
  return null;
}

// ---------------------------------------------------------------------------
// Fail-closed reads.

type RpcAnswer = { data: unknown; error: { code?: string; message?: string } | null };
type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<RpcAnswer> };

/** report id -> responder unit. null when the read failed: "not known". */
export function respondersFrom(answer: RpcAnswer): Map<string, string> | null {
  if (answer.error || !Array.isArray(answer.data)) return null;
  const units = new Map<string, string>();
  for (const row of answer.data as { report_id?: unknown; unit_label?: unknown }[]) {
    if (typeof row?.report_id !== "string" || typeof row.unit_label !== "string") continue;
    const unit = row.unit_label.trim();
    if (unit) units.set(row.report_id, unit);
  }
  return units;
}

export async function readResponders(client: RpcClient, reportIds: string[]): Promise<Map<string, string> | null> {
  const ids = [...new Set(reportIds)].slice(0, RESPONDERS_MAX_IDS);
  if (ids.length === 0) return new Map();
  try {
    const answer = await client.rpc(RESPONDERS_RPC, { p_report_ids: ids });
    const units = respondersFrom(answer);
    if (units === null) console.error("[recall] responders read failed", answer.error?.code);
    return units;
  } catch (error) {
    console.error("[recall] responders read threw", error instanceof Error ? error.message : "");
    return null;
  }
}

/** Any answer without an error means the recall functions are there. */
export function recallAvailableFrom(answer: RpcAnswer): boolean {
  return !answer.error;
}

export async function probeRecallAvailable(client: RpcClient, reportId: string): Promise<boolean> {
  if (!UUID_SHAPE.test(reportId)) return false;
  try {
    const answer = await client.rpc(RECALL_PROBE_RPC, { p_report: reportId });
    const available = recallAvailableFrom(answer);
    if (!available) console.error("[recall] probe failed", answer.error?.code);
    return available;
  } catch (error) {
    console.error("[recall] probe threw", error instanceof Error ? error.message : "");
    return false;
  }
}

/** The ids of unread desk_report_auto_routed rows; null when unreadable. */
export function unreadIdsFrom(answer: RpcAnswer): string[] | null {
  if (answer.error || !Array.isArray(answer.data)) return null;
  return (answer.data as { id?: unknown }[])
    .map((row) => row?.id)
    .filter((id): id is string => typeof id === "string" && UUID_SHAPE.test(id));
}
