/**
 * CDRRMO dispatch v2, the barangay desk's side (backend spec
 * docs/specs/2026-10-14-cdrrmo-dispatch-v2-design.md, section 5 row D).
 *
 * With the backend's switch on, an Emergency report is no longer validated
 * and then routed by hand here. The desk validates or rejects it through one
 * function, validate_emergency_report(), and the database sends it to its
 * default agencies (the category's mapping plus CDRRMO, always). The desk
 * never picks or unticks agencies for an Emergency report; CDRRMO alone adds.
 * Other-reports are unchanged: the desk still picks their agencies.
 *
 * Everything the console needs to know about the switch lives in this one
 * file, and nothing here imports from the app, so scripts/check-cdrrmo-
 * dispatch.mjs can check it under plain Node.
 *
 * THE CONTRACT (backend PR A binding items 7, 13, 18 and 19; verified
 * against SuryaZZDev/LipaAction#347 at 23d7dfe, migration
 * 20261129090000_cdrrmo_dispatch.sql):
 * - cdrrmo_dispatch_enabled(): no arguments, returns a boolean. The console
 *   reads it once per page load and FAILS CLOSED: an error, a function not
 *   deployed yet (PGRST202) or anything but a literal true is OFF, and the
 *   console behaves exactly as before. PGRST202 means OFF for this read only.
 * - validate_emergency_report(p_report, p_decision, p_reason) RETURNS its
 *   outcome as text: 'routed', 'recorded', 'validated_no_open_agency',
 *   'rejected' or 'overridden'.
 * - Every refusal RAISES SQLSTATE 55000 with DETAIL = a token (REFUSAL_TOKENS
 *   below) and message '<function>: <token>'. The token is read from DETAIL
 *   only, exactly. The switch-off refusal is DETAIL cdrrmo_dispatch_disabled.
 * - Permission failures stay 42501.
 * - The old path (review_report(), a direct agency_routing insert or status
 *   update for an Emergency report) refuses with 42501 and a message that
 *   starts "cdrrmo_dispatch_active:". 42501 also means three other things,
 *   so that one branches on the prefix, never on the code.
 *
 * NOT YET DEPLOYED: neither function exists on prod until the backend's
 * CDRRMO-DISPATCH migration (PR A, 20261129090000) is pushed.
 */

export const CDRRMO_DISPATCH_ENABLED_RPC = "cdrrmo_dispatch_enabled";
export const VALIDATE_EMERGENCY_RPC = "validate_emergency_report";

/** The message prefix of the old path's refusal while the switch is on. */
export const CDRRMO_DISPATCH_ACTIVE_PREFIX = "cdrrmo_dispatch_active:";

/** The DETAIL of a dispatch function's refusal while the switch is off. */
export const CDRRMO_DISPATCH_DISABLED_DETAIL = "cdrrmo_dispatch_disabled";

/** PostgREST's answer for a function it can't find: not deployed yet. */
const FUNCTION_NOT_DEPLOYED = "PGRST202";

/** The shape of a PostgREST error, as far as this file reads it. */
export interface RpcError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/**
 * The gate, from one cdrrmo_dispatch_enabled() answer. True only for a
 * successful call that returned the boolean true: an error, a missing
 * function, null, "true" as text or any other value is OFF.
 */
export function dispatchEnabledFrom(result: { data: unknown; error: unknown }): boolean {
  return !result.error && result.data === true;
}

/** The smallest client this file needs: anything with supabase-js's rpc(). */
interface RpcCaller {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
}

/**
 * Reads the switch once. Never throws: a thrown call is OFF, like every
 * other failure. The function not being deployed is expected until the
 * backend migration is on prod, so only other failures are logged.
 */
export async function readCdrrmoDispatchEnabled(supabase: RpcCaller): Promise<boolean> {
  try {
    const result = await supabase.rpc(CDRRMO_DISPATCH_ENABLED_RPC);
    if (result.error && result.error.code !== FUNCTION_NOT_DEPLOYED) {
      console.error("[cdrrmo-dispatch] switch read failed, treated as off", result.error.code);
    }
    return dispatchEnabledFrom(result);
  } catch (error) {
    console.error("[cdrrmo-dispatch] switch read threw, treated as off", error);
    return false;
  }
}

/**
 * True when a refusal from review_report() or the routing writes means the
 * switch is on and this Emergency report must go through Validate instead.
 * The prefix decides, never the SQLSTATE.
 */
export function isCdrrmoDispatchActiveError(error: { message?: string } | null | undefined): boolean {
  return typeof error?.message === "string" && error.message.trimStart().startsWith(CDRRMO_DISPATCH_ACTIVE_PREFIX);
}

/** What validate_emergency_report() returns when it did something. */
export const SUCCESS_OUTCOMES = ["routed", "recorded", "validated_no_open_agency", "rejected", "overridden"] as const;
export type EmergencySuccess = (typeof SUCCESS_OUTCOMES)[number];

/**
 * Every refusal token the dispatch functions raise (PR A at 23d7dfe), as
 * DETAIL. not_routable and nothing_added come from cdrrmo_add_agencies
 * only; override_window_closed and predates_dispatch from CDRRMO's calls.
 */
export const REFUSAL_TOKENS = [
  "already_validated",
  "already_rejected",
  "already_resolved",
  "cdrrmo_validated",
  "cdrrmo_rejected",
  "already_routed",
  "handed_back",
  "override_window_closed",
  "cdrrmo_dispatch_disabled",
  "nothing_added",
  "not_routable",
  "not_emergency",
  "not_found",
  "reason_required",
  "predates_dispatch",
] as const;
export type RefusalToken = (typeof REFUSAL_TOKENS)[number];

/**
 * Refusals the barangay desk can meet and has its own words for. The rest
 * (override_window_closed, nothing_added, not_routable, predates_dispatch)
 * answer CDRRMO's calls only; if one ever reached the desk it reads as
 * "refused".
 */
export const DESK_REFUSALS = [
  "already_validated",
  "already_rejected",
  "already_resolved",
  "cdrrmo_validated",
  "cdrrmo_rejected",
  "already_routed",
  "handed_back",
  "not_emergency",
  "not_found",
  "reason_required",
] as const;
export type DeskRefusal = (typeof DESK_REFUSALS)[number];

/**
 * How one validate_emergency_report() call ended. A code, not a sentence:
 * the page words it in the official's language (cdrrmo.outcome.* in
 * src/lib/messages.ts).
 *
 * - the five success outcomes: done.
 * - saved-unknown: the call succeeded with text this console doesn't know.
 *   Something was written; the page refreshes and says so neutrally.
 * - a desk refusal: the report is not where the desk thought it was.
 * - refused: a contract token the desk never expects (CDRRMO-only).
 * - disabled: the switch is off (55000 + cdrrmo_dispatch_disabled). The
 *   desk's usual Validate and Route apply again.
 * - not-permitted: a 42501.
 * - unknown: any other error. Whether anything was written isn't known, so
 *   the page refreshes and says so neutrally, never "something went wrong".
 */
export type EmergencyValidationOutcome =
  | EmergencySuccess
  | "saved-unknown"
  | DeskRefusal
  | "refused"
  | "disabled"
  | "not-permitted"
  | "invalid"
  | "session-expired"
  | "unreachable"
  | "unknown";

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Reads one validate_emergency_report() answer. Pure: it takes the
 * PostgREST result and the HTTP status, so it can be checked without a
 * database.
 *
 * Order matters. A transport failure is read before any meaning (as
 * reports.ts does); then a 55000 refusal by its exact DETAIL; then 42501.
 * Anything else, a missing function (PGRST202) included, is "unknown".
 */
export function mapValidateEmergencyResult(result: {
  data: unknown;
  error: RpcError | null;
  status: number;
}): EmergencyValidationOutcome {
  const { data, error, status } = result;

  if (!error) {
    if (isOneOf(SUCCESS_OUTCOMES, data)) return data;
    console.error("[validate_emergency_report] unknown answer", JSON.stringify(data));
    return "saved-unknown";
  }

  if (status === 0) return "unreachable";
  if (status === 401 || (error.code ?? "").startsWith("PGRST30")) return "session-expired";
  // PGRST202 means OFF only for the switch read. Here the page already read
  // the switch as on, so a missing function is unexpected: treating it as
  // off would flip the buttons back and forth between the two flows.
  if (error.code === FUNCTION_NOT_DEPLOYED) {
    console.error("[validate_emergency_report] function not found while the switch reads on", error.code);
    return "unknown";
  }

  if (error.code === "55000") {
    const token = error.details ?? null;
    if (token === CDRRMO_DISPATCH_DISABLED_DETAIL) return "disabled";
    if (isOneOf(DESK_REFUSALS, token)) return token;
    if (isOneOf(REFUSAL_TOKENS, token)) return "refused";
  }
  if (error.code === "42501") return "not-permitted";

  console.error("[validate_emergency_report] unexpected", error.code, error.details, error.message);
  return "unknown";
}

/** Outcomes after which the report has left the desk's pending queue. */
export function isEmergencyDecisionDone(outcome: EmergencyValidationOutcome): boolean {
  return isOneOf(SUCCESS_OUTCOMES, outcome);
}

/**
 * Answers that close the reject prompt: refusals meaning the report has
 * moved since the page loaded (the queue refreshes), plus "refused", a
 * CDRRMO-only token that leaves nothing for the desk to retry. Everything
 * else that isn't done or "disabled" (reason_required, not-permitted,
 * saved-unknown, unknown and the transport failures) keeps the prompt open
 * with its reason.
 */
export const CLOSES_PROMPT: readonly EmergencyValidationOutcome[] = [
  "already_routed",
  "cdrrmo_validated",
  "already_validated",
  "already_rejected",
  "already_resolved",
  "cdrrmo_rejected",
  "handed_back",
  "not_found",
  "not_emergency",
  "refused",
];

/**
 * Whether the page must refresh after this answer: whenever something may
 * have been written or the report moved. Only an answer given before any
 * write (bad input, no session) leaves the queue as it is.
 */
export function refreshesQueue(outcome: EmergencyValidationOutcome): boolean {
  return outcome !== "invalid" && outcome !== "session-expired";
}

/** One report's report_validations rows, as far as the desk reads them. */
export interface PartyDecisions {
  barangay: "validated" | "rejected" | null;
  cdrrmo: "validated" | "rejected" | null;
}

/**
 * Whether the desk may record its own validation of a ROUTED Emergency
 * report (state table: auto-routed unreviewed, or routed after a CDRRMO
 * validation, both "record only"). Needs no barangay decision on it, and
 * either no review stamp at all (auto-routed by CARD or CRIT-ESC) or a
 * CDRRMO validation, whose stamp is CDRRMO's. decisions is null when the
 * rows couldn't be read: then only the missing stamp can show it.
 */
export function canRecordBarangayValidation(
  status: string,
  reviewedAt: string | null,
  decisions: PartyDecisions | null
): boolean {
  if (status !== "routed") return false;
  if (decisions === null) return reviewedAt === null;
  if (decisions.barangay !== null || decisions.cdrrmo === "rejected") return false;
  return reviewedAt === null || decisions.cdrrmo === "validated";
}

/** Folds report_validations rows into one PartyDecisions per report. */
export function partyDecisionsByReport(
  rows: { incident_report_id: string; party: string; decision: string }[]
): Map<string, PartyDecisions> {
  const out = new Map<string, PartyDecisions>();
  for (const row of rows) {
    if (row.party !== "barangay" && row.party !== "cdrrmo") continue;
    if (row.decision !== "validated" && row.decision !== "rejected") continue;
    const entry = out.get(row.incident_report_id) ?? { barangay: null, cdrrmo: null };
    entry[row.party] = row.decision;
    out.set(row.incident_report_id, entry);
  }
  return out;
}
