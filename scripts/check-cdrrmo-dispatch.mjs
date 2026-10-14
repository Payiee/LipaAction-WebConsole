// Self-check for src/lib/cdrrmo-dispatch.ts: the CDRRMO dispatch switch
// check (fails closed), the old-path prefix check, and the mapping of
// validate_emergency_report()'s answers under the final contract (backend
// PR A binding items 18-19). No database, no framework.
//
//   npm run check:cdrrmo
//
// Needs Node >= 22.18, which strips the module's TypeScript types on import.
// Exits 1 if any check fails.

const mod = await import(new URL("../src/lib/cdrrmo-dispatch.ts", import.meta.url).href);
const {
  dispatchEnabledFrom,
  readCdrrmoDispatchEnabled,
  isCdrrmoDispatchActiveError,
  mapValidateEmergencyResult,
  isEmergencyDecisionDone,
  refreshesQueue,
  canRecordBarangayValidation,
  partyDecisionsByReport,
  REFUSAL_TOKENS,
  DESK_REFUSALS,
  CLOSES_PROMPT,
  REPORT_VALIDATIONS_READABLE,
  REPORT_VALIDATIONS_DECISIONS_SELECT,
  REPORT_VALIDATIONS_HISTORY_SELECT,
  isReviewStampedByCdrrmo,
} = mod;

// The module logs unexpected answers on purpose; keep the run output clean.
console.error = () => {};

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (same) pass += 1;
  else fail += 1;
  console.log(`${same ? "ok  " : "FAIL"} ${name}${same ? "" : `: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`}`);
}

// --- The switch check fails closed -----------------------------------------
check("switch: true", dispatchEnabledFrom({ data: true, error: null }), true);
check("switch: false", dispatchEnabledFrom({ data: false, error: null }), false);
check("switch: null", dispatchEnabledFrom({ data: null, error: null }), false);
check("switch: 'true' as text", dispatchEnabledFrom({ data: "true", error: null }), false);
check("switch: 1", dispatchEnabledFrom({ data: 1, error: null }), false);
check("switch: true with an error", dispatchEnabledFrom({ data: true, error: { code: "XX000" } }), false);

const client = (answer) => ({ rpc: async () => answer });
check("read: on", await readCdrrmoDispatchEnabled(client({ data: true, error: null })), true);
check("read: off", await readCdrrmoDispatchEnabled(client({ data: false, error: null })), false);
check(
  "read: not deployed (PGRST202)",
  await readCdrrmoDispatchEnabled(client({ data: null, error: { code: "PGRST202", message: "Could not find the function" } })),
  false
);
check("read: permission denied", await readCdrrmoDispatchEnabled(client({ data: null, error: { code: "42501" } })), false);
check("read: rpc throws", await readCdrrmoDispatchEnabled({ rpc: () => { throw new Error("boom"); } }), false);
check("read: rpc rejects", await readCdrrmoDispatchEnabled({ rpc: () => Promise.reject(new Error("net")) }), false);

// --- The old path's refusal: prefix, never the SQLSTATE alone --------------
check(
  "prefix: 42501 + prefix",
  isCdrrmoDispatchActiveError({ code: "42501", message: "cdrrmo_dispatch_active: emergency reports are validated through CDRRMO" }),
  true
);
check("prefix: 42501 without it", isCdrrmoDispatchActiveError({ code: "42501", message: "not authorized" }), false);
check("prefix: RLS denial", isCdrrmoDispatchActiveError({ code: "42501", message: "new row violates row-level security policy" }), false);
check("prefix: only mid-message", isCdrrmoDispatchActiveError({ code: "42501", message: "see cdrrmo_dispatch_active: x" }), false);
check("prefix: null", isCdrrmoDispatchActiveError(null), false);

// --- Outcomes: returned text -----------------------------------------------
const ok = (data) => mapValidateEmergencyResult({ data, error: null, status: 200 });
for (const outcome of ["routed", "recorded", "validated_no_open_agency", "rejected", "overridden"]) {
  check(`return: ${outcome}`, ok(outcome), outcome);
  check(`return: ${outcome} is done`, isEmergencyDecisionDone(ok(outcome)), true);
}
check("return: unknown text is saved-unknown", ok("validated"), "saved-unknown");
check("return: null is saved-unknown", ok(null), "saved-unknown");
check("return: saved-unknown refreshes", refreshesQueue("saved-unknown"), true);
check("return: saved-unknown is not done", isEmergencyDecisionDone("saved-unknown"), false);

// --- Refusals: 55000 + exact DETAIL ----------------------------------------
const refuse = (details, code = "55000") =>
  mapValidateEmergencyResult({ data: null, error: { code, message: `validate_emergency_report: ${details}`, details }, status: 400 });
for (const token of DESK_REFUSALS) check(`refusal: ${token}`, refuse(token), token);
for (const token of ["override_window_closed", "nothing_added", "not_routable", "predates_dispatch"]) {
  check(`refusal (CDRRMO-only): ${token}`, refuse(token), "refused");
}
check("refusal: every contract token is mapped", REFUSAL_TOKENS.every((tk) => refuse(tk) !== "unknown"), true);
check("refusal: already_resolved has desk copy", refuse("already_resolved"), "already_resolved");
// A never raises other_party_validated (PR A at 23d7dfe); it is not a token.
check("not a token: other_party_validated", refuse("other_party_validated"), "unknown");
check("off: 55000 + cdrrmo_dispatch_disabled", refuse("cdrrmo_dispatch_disabled"), "disabled");
// PGRST202 is OFF only for the switch read. From validate_emergency_report
// (the page already read the switch as on) it is unknown: refresh, neutral
// message, no flip back to the old flow.
check("not off: PGRST202 from validate", mapValidateEmergencyResult({ data: null, error: { code: "PGRST202" }, status: 404 }), "unknown");
check("PGRST202 from validate refreshes", refreshesQueue(mapValidateEmergencyResult({ data: null, error: { code: "PGRST202" }, status: 404 })), true);
check("not off: 42883", mapValidateEmergencyResult({ data: null, error: { code: "42883" }, status: 404 }), "unknown");
check("exact DETAIL only: token in message", mapValidateEmergencyResult({ data: null, error: { code: "55000", message: "x: already_validated", details: null }, status: 400 }), "unknown");
check("exact DETAIL only: padded", refuse(" already_validated"), "unknown");
check("exact DETAIL only: token with another code", refuse("already_validated", "P0001"), "unknown");
check("exact DETAIL only: bare 'disabled'", refuse("disabled"), "unknown");
check("exact DETAIL only: token in HINT", mapValidateEmergencyResult({ data: null, error: { code: "55000", hint: "handed_back" }, status: 400 }), "unknown");
check("42501: not permitted", mapValidateEmergencyResult({ data: null, error: { code: "42501", message: "denied" }, status: 403 }), "not-permitted");
check("unknown error refreshes", refreshesQueue("unknown"), true);
check("transport: status 0", mapValidateEmergencyResult({ data: null, error: { code: "", message: "fetch failed" }, status: 0 }), "unreachable");
check("transport: 401", mapValidateEmergencyResult({ data: null, error: { code: "42501" }, status: 401 }), "session-expired");
check("transport: PGRST301", mapValidateEmergencyResult({ data: null, error: { code: "PGRST301" }, status: 401 }), "session-expired");
check("no refresh: invalid input", refreshesQueue("invalid"), false);
check("no refresh: session expired", refreshesQueue("session-expired"), false);

// --- Which answers close the reject prompt (the report moved) -------------
for (const token of ["already_routed", "cdrrmo_validated", "already_validated", "already_rejected", "already_resolved", "cdrrmo_rejected", "handed_back", "not_found", "not_emergency", "nothing_added"]) {
  check(`prompt closes: ${token}`, CLOSES_PROMPT.includes(refuse(token)), true);
}
for (const kept of ["reason_required", "not-permitted", "saved-unknown", "unreachable", "session-expired", "unknown"]) {
  check(`prompt stays open: ${kept}`, CLOSES_PROMPT.includes(kept), false);
}

// --- Recording the barangay's validation of a routed report (B1) -----------
const none = { barangay: null, cdrrmo: null };
check("record: auto-routed, unreviewed", canRecordBarangayValidation("routed", null, none), true);
check("record: auto-routed, rows unknown", canRecordBarangayValidation("routed", null, null), true);
check("record: routed after CDRRMO validated", canRecordBarangayValidation("routed", "2026-10-14T00:00:00Z", { barangay: null, cdrrmo: "validated" }), true);
check("record: already validated here", canRecordBarangayValidation("routed", "2026-10-14T00:00:00Z", { barangay: "validated", cdrrmo: "validated" }), false);
check("record: legacy routed by the desk", canRecordBarangayValidation("routed", "2026-10-14T00:00:00Z", none), false);
check("record: reviewed, rows unknown", canRecordBarangayValidation("routed", "2026-10-14T00:00:00Z", null), false);
check("record: not routed", canRecordBarangayValidation("validated", null, none), false);
check("record: CDRRMO rejected", canRecordBarangayValidation("routed", null, { barangay: null, cdrrmo: "rejected" }), false);

const folded = partyDecisionsByReport([
  { incident_report_id: "a", party: "barangay", decision: "validated" },
  { incident_report_id: "a", party: "cdrrmo", decision: "rejected" },
  { incident_report_id: "b", party: "cdrrmo", decision: "validated" },
  { incident_report_id: "c", party: "someone", decision: "validated" },
]);
check("fold: both parties", folded.get("a"), { barangay: "validated", cdrrmo: "rejected" });
check("fold: CDRRMO only", folded.get("b"), { barangay: null, cdrrmo: "validated" });
check("fold: unknown party ignored", folded.has("c"), false);

// --- Whose review stamp History may name (isReviewStampedByCdrrmo) --------
// true means History shows [Your barangay], not reviewed_by's name.
const at = (minute) => `2026-10-14T10:${String(minute).padStart(2, "0")}:00Z`;
check(
  "stamp: CDRRMO validated first, desk records later -> Your barangay",
  isReviewStampedByCdrrmo({ decision: "validated", created_at: at(5) }, { decision: "validated", created_at: at(1) }),
  true
);
check(
  "stamp: desk validated first, CDRRMO records later -> desk's name",
  isReviewStampedByCdrrmo({ decision: "validated", created_at: at(1) }, { decision: "validated", created_at: at(5) }),
  false
);
check(
  "stamp: override (desk rejected, CDRRMO validated later) -> Your barangay",
  isReviewStampedByCdrrmo({ decision: "rejected", created_at: at(1) }, { decision: "validated", created_at: at(5) }),
  true
);
check(
  "stamp: reject after route (desk validated, CDRRMO rejected later) -> Your barangay",
  isReviewStampedByCdrrmo({ decision: "validated", created_at: at(1) }, { decision: "rejected", created_at: at(5) }),
  true
);
check("stamp: desk only -> desk's name", isReviewStampedByCdrrmo({ decision: "validated", created_at: at(1) }, null), false);
check(
  "stamp: same instant counts as CDRRMO first",
  isReviewStampedByCdrrmo({ decision: "validated", created_at: at(1) }, { decision: "validated", created_at: at(1) }),
  true
);
check("grant: history select reads created_at", REPORT_VALIDATIONS_HISTORY_SELECT.includes("created_at"), true);

// --- report_validations reads stay inside the granted columns -------------
// PR A at 81768ff grants SELECT on (id, incident_report_id, party, decision,
// reason, created_at) only; naming `actor` fails the whole read.
check(
  "grant: readable columns pinned",
  [...REPORT_VALIDATIONS_READABLE],
  ["id", "incident_report_id", "party", "decision", "reason", "created_at"]
);
for (const [name, select] of [
  ["queue decisions", REPORT_VALIDATIONS_DECISIONS_SELECT],
  ["history", REPORT_VALIDATIONS_HISTORY_SELECT],
]) {
  const cols = select.split(",").map((c) => c.trim());
  check(`grant: ${name} select uses granted columns only`, cols.every((c) => REPORT_VALIDATIONS_READABLE.includes(c)), true);
  check(`grant: ${name} select never names actor`, cols.includes("actor"), false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
