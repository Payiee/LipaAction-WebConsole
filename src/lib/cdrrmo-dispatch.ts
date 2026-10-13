/**
 * CDRRMO dispatch v2, the barangay desk's side (backend spec
 * docs/specs/2026-10-14-cdrrmo-dispatch-design.md, section 5 row D).
 *
 * With the backend's switch on, an Emergency report is no longer validated
 * and then routed by hand here. The desk validates or rejects it through one
 * function, validate_emergency_report(), and the database sends it to its
 * default agencies (the category's mapping plus CDRRMO, always). The desk
 * never picks or unticks agencies for an Emergency report; CDRRMO alone adds.
 * Other-reports are unchanged: the desk still picks their agencies.
 *
 * Everything the console needs to know about the switch lives in this one
 * file, and nothing here imports from the app, so it can be checked on its
 * own (the PR runs it under plain Node):
 *
 * - THE GATE. cdrrmo_dispatch_enabled() returns a boolean. The console reads
 *   it once per page load and FAILS CLOSED: an error, a missing function
 *   (PGRST202 / 42883, before the backend migration is on prod) or anything
 *   but a literal true means OFF, and the console behaves exactly as before.
 * - THE OLD-PATH REFUSAL. With the switch on, review_report() and a direct
 *   agency_routing insert or status update for an Emergency report raise
 *   42501 with a message starting "cdrrmo_dispatch_active:". 42501 is also
 *   the answer for three other refusals, so this branches on the prefix,
 *   never on the code.
 * - THE VALIDATE RESULT. validate_emergency_report(p_report, p_decision,
 *   p_reason) returns 'validated' | 'rejected', and the spec's state table
 *   names refusals by token. Whether a refusal comes back as the returned
 *   text or as a raised error is not pinned yet, so both are read, by token.
 *   With the switch off it raises 55000 with DETAIL cdrrmo_dispatch_disabled.
 *
 * NOT YET DEPLOYED: neither function exists on prod until the backend's
 * CDRRMO-DISPATCH migration (PR A, 20261129090000) is pushed. Signatures are
 * from the spec's section 3.4 and the PR A binding additions, items 7 and 13.
 */

export const CDRRMO_DISPATCH_ENABLED_RPC = "cdrrmo_dispatch_enabled";
export const VALIDATE_EMERGENCY_RPC = "validate_emergency_report";

/** The message prefix of the old path's refusal while the switch is on. */
export const CDRRMO_DISPATCH_ACTIVE_PREFIX = "cdrrmo_dispatch_active:";

/** The DETAIL of a dispatch function's refusal while the switch is off. */
export const CDRRMO_DISPATCH_DISABLED_DETAIL = "cdrrmo_dispatch_disabled";

/** The shape of a PostgREST error, as far as this file reads it. */
export interface RpcError {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}

/** PostgREST's answer for a function it can't find, and Postgres's own. */
const FUNCTION_MISSING = new Set(["PGRST202", "42883"]);

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
 * other failure. A missing function is expected until the backend migration
 * is on prod, so only other failures are logged.
 */
export async function readCdrrmoDispatchEnabled(supabase: RpcCaller): Promise<boolean> {
  try {
    const result = await supabase.rpc(CDRRMO_DISPATCH_ENABLED_RPC);
    if (result.error && !FUNCTION_MISSING.has(result.error.code ?? "")) {
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

/**
 * The refusals the spec's state table names (section 3.4). Each one means
 * the report is not where the desk thought it was; none is an error.
 */
export const EMERGENCY_REFUSAL_TOKENS = [
  "already_validated",
  "already_rejected",
  "cdrrmo_validated",
  "cdrrmo_rejected",
  "already_routed",
  "handed_back",
  "override_window_closed",
] as const;

export type EmergencyRefusal = (typeof EMERGENCY_REFUSAL_TOKENS)[number];

/**
 * How one validate_emergency_report() call ended. A code, not a sentence:
 * the page words it in the official's language (cdrrmo.outcome.* in
 * src/lib/messages.ts).
 *
 * - validated / rejected: done.
 * - validated_no_open_agency: the validation was recorded, but every default
 *   agency had already sent the report back, so it stopped at 'validated'
 *   and CDRRMO routes it. Done, with a warning.
 * - disabled: the switch is off (or the function isn't deployed). The desk's
 *   usual Validate and Route apply again.
 * - stale: a 55000 without a token. The report changed under the desk.
 * - not-permitted: a 42501 (wrong barangay, wrong role, report not found).
 * - invalid: a 22023 (bad decision or reason).
 */
export type EmergencyValidationOutcome =
  | "validated"
  | "rejected"
  | "validated_no_open_agency"
  | EmergencyRefusal
  | "disabled"
  | "stale"
  | "not-permitted"
  | "invalid"
  | "session-expired"
  | "unreachable"
  | "failed";

// Longest first, so no token is read inside a longer one; the boundary check
// below makes that impossible anyway, the order only makes intent plain.
const TOKENS_BY_LENGTH: readonly string[] = [...EMERGENCY_REFUSAL_TOKENS, "validated_no_open_agency"].sort(
  (a, b) => b.length - a.length
);

/**
 * The first known token in a text, as a whole word: a token inside a longer
 * identifier (cdrrmo_dispatch_disabled holds "disabled") is not that token.
 */
export function findToken(text: string | null | undefined, tokens: readonly string[] = TOKENS_BY_LENGTH): string | null {
  if (typeof text !== "string" || text.length === 0) return null;
  for (const token of tokens) {
    if (new RegExp(`(?:^|[^a-z0-9_])${token}(?:$|[^a-z0-9_])`).test(text)) return token;
  }
  return null;
}

function hasWord(text: string | null | undefined, word: string): boolean {
  return findToken(text, [word]) !== null;
}

/**
 * Reads one validate_emergency_report() answer. Pure: it takes the
 * PostgREST result and the HTTP status, so it can be checked without a
 * database.
 *
 * Order matters. A transport failure is read before any meaning (as
 * reports.ts does); then the switch-off refusal; then a token, wherever it
 * sits (the returned text, DETAIL, message, HINT); then the bare codes.
 */
export function mapValidateEmergencyResult(result: {
  data: unknown;
  error: RpcError | null;
  status: number;
}): EmergencyValidationOutcome {
  const { data, error, status } = result;

  if (!error) {
    const text = typeof data === "string" ? data.trim() : null;
    if (text === "validated" || text === "rejected") return text;
    if (text === "disabled") return "disabled";
    const token = findToken(text);
    if (token) return token as EmergencyValidationOutcome;
    // A success with an answer this console doesn't know. Not claimed as
    // done: the page refreshes and shows where the report stands.
    console.error("[validate_emergency_report] unknown answer", JSON.stringify(data));
    return "failed";
  }

  if (status === 0) return "unreachable";
  if (status === 401 || (error.code ?? "").startsWith("PGRST30")) return "session-expired";
  if (FUNCTION_MISSING.has(error.code ?? "")) return "disabled";

  const fields = [error.details, error.message, error.hint];
  if (fields.some((field) => typeof field === "string" && field.includes(CDRRMO_DISPATCH_DISABLED_DETAIL))) {
    return "disabled";
  }
  for (const field of fields) {
    const token = findToken(field);
    if (token) return token as EmergencyValidationOutcome;
  }
  if (hasWord(error.details, "disabled")) return "disabled";

  if (error.code === "42501") return "not-permitted";
  if (error.code === "22023") return "invalid";
  if (error.code === "55000") return "stale";
  console.error("[validate_emergency_report] unexpected", error.code, error.message);
  return "failed";
}

/** Outcomes after which the report has left the desk's pending queue. */
export function isEmergencyDecisionDone(outcome: EmergencyValidationOutcome): boolean {
  return outcome === "validated" || outcome === "rejected" || outcome === "validated_no_open_agency";
}
