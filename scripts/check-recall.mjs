// Self-check for src/lib/recall.ts: the barangay Recall screen's pure rules
// (RECALL-UI, LipaAction docs/specs/2026-10-14-barangay-recall-screen-design.md).
// Covers the client mirror of recall_auto_routed_report()'s eligibility and
// window (window first, then dispatch, as the RPC), the countdown, the
// action's input checks, the mapping of the RPC's results and errors, and
// the fail-closed reads (responders_for_reports, the availability probe,
// the unread desk notifications). No database, no framework.
//
//   npm run check:recall
//
// Needs Node >= 22.18, which strips the module's TypeScript types on import.
// Exits 1 if any check fails.

const mod = await import(new URL("../src/lib/recall.ts", import.meta.url).href);
const {
  RECALL_RPC,
  RECALL_PROBE_RPC,
  RESPONDERS_RPC,
  RESPONDERS_MAX_IDS,
  DESK_AUTO_ROUTED_KIND,
  RECALL_SEVERITIES,
  RECALL_REASON_MAX,
  CLASS_WINDOW_MINUTES,
  RESPONDER_WINDOW_MINUTES,
  MAX_WINDOW_MINUTES,
  ROUTING_DISPATCH_COLUMNS,
  trimRecallReason,
  recallReasonLength,
  validateRecallInput,
  recallWindowMinutes,
  recallState,
  formatCountdown,
  countdown,
  mapRecallResult,
  refreshesAfterRecall,
  closesRecallDialog,
  recallToastTone,
  localMarkAfter,
  respondersFrom,
  readResponders,
  recallAvailableFrom,
  probeRecallAvailable,
  unreadIdsFrom,
  mayOfferRecall,
  timerNoticeApplies,
  recallDialogCopy,
  windowMayBeOpen,
  recallPhase,
  announcementFor,
  capIds,
} = mod;
const { readFileSync } = await import("node:fs");

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

// --- Contract names and constants (pinned to the migrations) ---------------
check("rpc name", RECALL_RPC, "recall_auto_routed_report");
check("probe rpc name", RECALL_PROBE_RPC, "recall_window_ends_at");
check("responders rpc name", RESPONDERS_RPC, "responders_for_reports");
check("responders cap (20261130090000:617)", RESPONDERS_MAX_IDS, 200);
check("notification kind (20261130120000:257)", DESK_AUTO_ROUTED_KIND, "desk_report_auto_routed");
check("severities (20261031090000:479)", [...RECALL_SEVERITIES], ["none", "safety_net_trip", "classifier_wrong", "agency_mismatch"]);
check("reason max (20261031090000:483)", RECALL_REASON_MAX, 500);
// 20261031090000_recall_window.sql:188 `when 'Critical' then 5 when 'High' then 15`
check("class window", CLASS_WINDOW_MINUTES, { Critical: 5, High: 15 });
// 20261130120000_responder_routing.sql recall_window_minutes_for_report
check("responder window", RESPONDER_WINDOW_MINUTES, { Critical: 5, other: 15 });
check("max window", MAX_WINDOW_MINUTES, 15);
check("routing select carries the dispatch columns", ["unit_assigned_at", "en_route_at", "on_scene_at", "in_progress_at", "escalated"].every((c) => ROUTING_DISPATCH_COLUMNS.split(",").map((s) => s.trim()).includes(c)), true);

// --- Window length: recall_window_minutes_for_report ------------------------
check("window: Critical", recallWindowMinutes("Critical", false, false), 5);
check("window: High", recallWindowMinutes("High", false, false), 15);
check("window: Medium none", recallWindowMinutes("Medium", false, false), null);
check("window: Low none", recallWindowMinutes("Low", false, false), null);
check("window: unscored none", recallWindowMinutes(null, false, false), null);
check("window: responder Critical", recallWindowMinutes("Critical", true, false), 5);
check("window: responder High", recallWindowMinutes("High", true, false), 15);
check("window: responder Medium", recallWindowMinutes("Medium", true, false), 15);
check("window: responder Low", recallWindowMinutes("Low", true, false), 15);
check("window: responder unscored", recallWindowMinutes(null, true, false), 15);
check("window: responder escalated keeps class rule (Medium)", recallWindowMinutes("Medium", true, true), null);
check("window: responder escalated keeps class rule (Critical)", recallWindowMinutes("Critical", true, true), 5);

// --- recallState: the client mirror of the RPC -----------------------------
const T0 = Date.parse("2026-10-14T10:00:00Z");
const min = 60_000;
const row = (over = {}) => ({
  agencyName: "BFP",
  autoRouted: true,
  routedAt: new Date(T0).toISOString(),
  resolvedAt: null,
  unitAssignedAt: null,
  enRouteAt: null,
  onSceneAt: null,
  inProgressAt: null,
  escalated: false,
  ...over,
});
const subject = (over = {}) => ({
  status: "routed",
  reviewedAt: null,
  priority: "Critical",
  responder: false,
  routing: [row()],
  ...over,
});
const kind = (s, now, mark) => recallState(s, now, mark).kind;
const endsCrit = T0 + 5 * min;
const endsHigh = T0 + 15 * min;

check("state: Critical at end -1s is open", kind(subject(), endsCrit - 1000), "open");
check("state: Critical at end exactly is open (RPC: now() > ends)", kind(subject(), endsCrit), "open");
check("state: Critical at end +1s is closed", kind(subject(), endsCrit + 1000), "closed");
check("state: open carries endsAt", recallState(subject(), T0).endsAt, endsCrit);
check("state: High at end -1s open", kind(subject({ priority: "High" }), endsHigh - 1000), "open");
check("state: High at end +1s closed", kind(subject({ priority: "High" }), endsHigh + 1000), "closed");
check("state: Medium has no window -> closed", recallState(subject({ priority: "Medium" }), T0), { kind: "closed", endsAt: null, escalated: false });
check("state: Low has no window -> closed", kind(subject({ priority: "Low" }), T0), "closed");
check("state: responder Medium -> open 15 min", recallState(subject({ priority: "Medium", responder: true }), T0 + 14 * min).kind, "open");
check("state: responder Medium end", recallState(subject({ priority: "Medium", responder: true }), T0).endsAt, endsHigh);

check("none: status validated", kind(subject({ status: "validated" }), T0), "none");
check("none: status resolved", kind(subject({ status: "resolved" }), T0), "none");
check("none: reviewed", kind(subject({ reviewedAt: new Date(T0).toISOString() }), T0), "none");
check("none: no rows", kind(subject({ routing: [] }), T0), "none");
check("none: a manual row", kind(subject({ routing: [row(), row({ autoRouted: false })] }), T0), "none");
check("none: every row closed", kind(subject({ routing: [row({ resolvedAt: new Date(T0).toISOString() })] }), T0), "none");
check("none: null subject", recallState(null, T0).kind, "none");

for (const col of ["unitAssignedAt", "enRouteAt", "onSceneAt", "inProgressAt"]) {
  check(`dispatched: ${col} on an open row`, kind(subject({ routing: [row({ [col]: new Date(T0).toISOString() })] }), T0 + min), "dispatched");
  check(
    `open: ${col} on a closed row only`,
    kind(subject({ routing: [row(), row({ [col]: new Date(T0).toISOString(), resolvedAt: new Date(T0).toISOString(), agencyName: "PNP" })] }), T0 + min),
    "open"
  );
}
const twoAgencies = subject({ routing: [row({ agencyName: "BFP" }), row({ agencyName: "PNP", unitAssignedAt: new Date(T0).toISOString() })] });
check("dispatched: two agencies, one dispatched", kind(twoAgencies, T0 + min), "dispatched");
check("dispatched: names the dispatched agency", recallState(twoAgencies, T0 + min).agency, "PNP");
check("closed: dispatched after the window (window first)", kind(twoAgencies, endsCrit + 1000), "closed");
check("window from the earliest routed_at", recallState(subject({ routing: [row({ routedAt: new Date(T0 + 2 * min).toISOString() }), row({ agencyName: "PNP" })] }), T0).endsAt, endsCrit);
check("closed: unparseable routed_at fails closed", recallState(subject({ routing: [row({ routedAt: null })] }), T0), { kind: "closed", endsAt: null, escalated: false });
check("escalated flag carried", recallState(subject({ routing: [row({ escalated: true })] }), T0).escalated, true);
check("escalated: responder report escalated uses the class window", recallState(subject({ priority: "Medium", responder: true, routing: [row({ escalated: true })] }), T0).kind, "closed");

// Local marks after an info-only result (spec section 8).
check("mark dispatched overrides open", kind(subject(), T0, "dispatched"), "dispatched");
check("mark closed overrides open", kind(subject(), T0, "closed"), "closed");
check("mark never revives none", kind(subject({ status: "validated" }), T0, "dispatched"), "none");
check("mark dispatched does not reopen closed", kind(subject(), endsCrit + 1000, "dispatched"), "closed");

// Who sees a button.
check("offer: open + available", mayOfferRecall({ kind: "open" }, true), "recall");
check("offer: dispatched -> record", mayOfferRecall({ kind: "dispatched" }, true), "record");
check("offer: closed -> record (T04, Q2)", mayOfferRecall({ kind: "closed" }, true), "record");
check("offer: none -> nothing", mayOfferRecall({ kind: "none" }, true), null);
check("offer: unavailable -> nothing (fail closed)", mayOfferRecall({ kind: "open" }, false), null);

// --- Countdown ---------------------------------------------------------------
check("format 5:00", formatCountdown(5 * min), "5:00");
check("format 4:59.2 -> 5:00 (ceil)", formatCountdown(5 * min - 800), "5:00");
check("format 0:59", formatCountdown(59_000), "0:59");
check("format 0:01 at 1 ms", formatCountdown(1), "0:01");
check("format 0:00 at 0", formatCountdown(0), "0:00");
check("format negative clamps", formatCountdown(-5000), "0:00");
check("format 14:05", formatCountdown(14 * min + 5000), "14:05");
check("countdown open", countdown(endsCrit, T0), { msLeft: 5 * min, text: "5:00", underMinute: false, expired: false });
check("countdown under a minute", countdown(endsCrit, endsCrit - 30_000).underMinute, true);
check("countdown at end not expired", countdown(endsCrit, endsCrit).expired, false);
check("countdown past end expired", countdown(endsCrit, endsCrit + 1).expired, true);

// --- Input checks (before any call) ----------------------------------------
const ID = "0b6f2a4e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
check("trim: spaces, tabs, newlines", trimRecallReason("\n\t  why  \r\n"), "why");
check("trim: keeps a non-breaking space (server trims only \\s\\t\\r\\n)", trimRecallReason(" x "), " x ");
check("length counts code points", recallReasonLength("\u{1F600}a"), 2);
check("valid", validateRecallInput(ID, "none", "  ok  "), { ok: true, reportId: ID, severity: "none", reason: "ok" });
for (const s of RECALL_SEVERITIES) check(`valid severity ${s}`, validateRecallInput(ID, s, "x").ok, true);
check("bad id", validateRecallInput("24-2024-1", "none", "x").ok, false);
check("id not a string", validateRecallInput(42, "none", "x").ok, false);
check("unknown severity", validateRecallInput(ID, "minor", "x").ok, false);
check("severity case matters", validateRecallInput(ID, "None", "x").ok, false);
check("severity null", validateRecallInput(ID, null, "x").ok, false);
check("blank reason", validateRecallInput(ID, "none", "  \n\t ").ok, false);
check("reason not a string", validateRecallInput(ID, "none", 5).ok, false);
check("501 chars after trim refused", validateRecallInput(ID, "none", "a".repeat(501)).ok, false);
const fiveHundred = "a".repeat(500);
check("500 chars with surrounding newlines sent trimmed", validateRecallInput(ID, "none", `\n\n${fiveHundred}\r\n`), { ok: true, reportId: ID, severity: "none", reason: fiveHundred });

// --- Results and errors ------------------------------------------------------
const okData = (data) => mapRecallResult({ data, error: null, status: 200 });
check("recalled", okData({ result: "recalled", window_minutes: 5 }), "recalled");
check("after_window with a window", okData({ result: "after_window", window_minutes: 5 }), "after_window");
check("after_window without a window", okData({ result: "after_window", window_minutes: null }), "after_window_no_window");
check("after_dispatch", okData({ result: "after_dispatch", window_minutes: 5 }), "after_dispatch");
check("unknown result text", okData({ result: "maybe" }), "unknown");
check("null data", okData(null), "unknown");
check("string data", okData("recalled"), "unknown");
const err = (code, status = 400, extra = {}) => mapRecallResult({ data: null, error: { code, message: "recall_auto_routed_report: secret table name", ...extra }, status });
check("42501", err("42501", 403), "not-permitted");
check("22023", err("22023"), "invalid");
check("55000", err("55000"), "stale");
check("PGRST202 (not deployed)", err("PGRST202", 404), "unavailable");
check("42883 (no such function)", err("42883", 404), "unavailable");
check("status 0", err("", 0), "unreachable");
check("401", err("42501", 401), "session-expired");
check("PGRST301", err("PGRST301", 401), "session-expired");
check("PGRST303 at 403", err("PGRST303", 403), "session-expired");
check("other code", err("XX000", 500), "unknown");
check("P0001", err("P0001"), "unknown");
// The backend's message never decides anything.
check("message ignored", mapRecallResult({ data: null, error: { code: "XX000", message: "55000" }, status: 500 }), "unknown");
check("details ignored", mapRecallResult({ data: null, error: { code: "XX000", details: "recalled" }, status: 500 }), "unknown");

for (const o of ["recalled", "stale", "unknown"]) check(`refresh: ${o}`, refreshesAfterRecall(o), true);
for (const o of ["after_window", "after_window_no_window", "after_dispatch", "invalid", "not-permitted", "unreachable", "session-expired", "unavailable"]) {
  check(`no refresh: ${o}`, refreshesAfterRecall(o), false);
}
for (const o of ["recalled", "after_window", "after_window_no_window", "after_dispatch", "stale", "not-permitted", "unknown", "unavailable"]) {
  check(`dialog closes: ${o}`, closesRecallDialog(o), true);
}
// Typed text is kept when the official can fix it or retry.
for (const o of ["invalid", "unreachable", "session-expired"]) check(`dialog stays: ${o}`, closesRecallDialog(o), false);
check("tone recalled", recallToastTone("recalled"), "success");
for (const o of ["after_window", "after_window_no_window", "after_dispatch"]) check(`tone ${o} is info, not success`, recallToastTone(o), "info");
for (const o of ["stale", "not-permitted", "invalid", "unreachable", "session-expired", "unknown", "unavailable"]) check(`tone ${o}`, recallToastTone(o), "danger");
check("mark after_dispatch", localMarkAfter("after_dispatch"), "dispatched");
check("mark after_window", localMarkAfter("after_window"), "closed");
check("mark after_window_no_window", localMarkAfter("after_window_no_window"), "closed");
check("no mark after recalled", localMarkAfter("recalled"), null);
check("no mark after stale", localMarkAfter("stale"), null);

// --- Fail-closed reads -------------------------------------------------------
const R1 = "11111111-1111-4111-8111-111111111111";
check("responders: rows", [...respondersFrom({ data: [{ report_id: R1, unit_label: "Tanod, Brgy. Tambo" }], error: null })], [[R1, "Tanod, Brgy. Tambo"]]);
check("responders: blank unit dropped", respondersFrom({ data: [{ report_id: R1, unit_label: "  " }], error: null }).size, 0);
check("responders: extra columns never kept", [...respondersFrom({ data: [{ report_id: R1, unit_label: "U", display_name: "Juan", phone: "639" }], error: null }).values()], ["U"]);
check("responders: error -> null", respondersFrom({ data: null, error: { code: "PGRST202" } }), null);
check("responders: not an array -> null", respondersFrom({ data: { report_id: R1 }, error: null }), null);
const rpcClient = (answer) => ({ rpc: async () => answer });
check("read responders: none asked", (await readResponders(rpcClient({ data: [], error: null }), [])).size, 0);
check("read responders: missing function", await readResponders(rpcClient({ data: null, error: { code: "PGRST202" } }), [R1]), null);
check("read responders: 42883", await readResponders(rpcClient({ data: null, error: { code: "42883" } }), [R1]), null);
check("read responders: throws", await readResponders({ rpc: () => { throw new Error("boom"); } }, [R1]), null);
check("read responders: network rejects", await readResponders({ rpc: () => Promise.reject(new Error("net")) }, [R1]), null);
let asked = null;
await readResponders({ rpc: async (_n, args) => { asked = args.p_report_ids.length; return { data: [], error: null }; } }, Array.from({ length: 250 }, () => R1));
check("read responders: deduped ids", asked, 1);
let askedMany = null;
await readResponders(
  { rpc: async (_n, args) => { askedMany = args.p_report_ids.length; return { data: [], error: null }; } },
  Array.from({ length: 250 }, (_, i) => `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`)
);
check("read responders: capped at 200", askedMany, 200);

check("probe: a time", recallAvailableFrom({ data: "2026-10-14T10:05:00+00:00", error: null }), true);
check("probe: null (no window / not eligible)", recallAvailableFrom({ data: null, error: null }), true);
check("probe: PGRST202", recallAvailableFrom({ data: null, error: { code: "PGRST202" } }), false);
check("probe: 42883", recallAvailableFrom({ data: null, error: { code: "42883" } }), false);
check("probe: 42501", recallAvailableFrom({ data: null, error: { code: "42501" } }), false);
check("probe call: throws", await probeRecallAvailable({ rpc: () => { throw new Error("x"); } }, R1), false);
check("probe call: rejects", await probeRecallAvailable({ rpc: () => Promise.reject(new Error("x")) }, R1), false);
check("probe call: ok", await probeRecallAvailable(rpcClient({ data: null, error: null }), R1), true);
check("probe call: bad id never calls", await probeRecallAvailable({ rpc: () => { throw new Error("called"); } }, "nope"), false);

check("unread: ids", unreadIdsFrom({ data: [{ id: R1 }, { id: "x" }], error: null }), [R1]);
check("unread: error -> null", unreadIdsFrom({ data: null, error: { code: "42501" } }), null);
check("unread: not an array -> null", unreadIdsFrom({ data: {}, error: null }), null);

// --- Fix round 1 (review of #14) -------------------------------------------
// N1: timer rule i (20261127090000_critical_escalation_timer.sql:54) ends the
// safety net on ANY recall of a Critical report, escalated or not.
const notice = (over = {}) => timerNoticeApplies({ priority: "Critical", entryTier: "emergency", kind: "open", mark: null, ...over });
check("timer notice: Critical open", notice(), true);
check("timer notice: Critical closed (server may still recall)", notice({ kind: "closed" }), true);
check("timer notice: Critical dispatched (never a recall)", notice({ kind: "dispatched" }), false);
check("timer notice: Critical none", notice({ kind: "none" }), false);
check("timer notice: High open (the timer never handles it)", notice({ priority: "High" }), false);
check("timer notice: unscored", notice({ priority: null }), false);
// Not circular: the subject's own priority and state, with no escalated row.
// A responder's Critical route is never escalated, and still gets the notice.
const responderCrit = subject({ responder: true });
const responderState = recallState(responderCrit, T0);
check("timer notice: responder subject is open and not escalated", [responderState.kind, responderState.escalated], ["open", false]);
check(
  "timer notice: responder Critical route, not escalated",
  notice({ priority: responderCrit.priority, kind: responderState.kind }),
  true
);
const escalatedCrit = subject({ routing: [row({ escalated: true })] });
check("timer notice: escalated Critical route", notice({ priority: escalatedCrit.priority, kind: recallState(escalatedCrit, T0).kind }), true);
// Follow-up 1: rule e (20261127090000_critical_escalation_timer.sql:49) - Emergency intake only.
check("timer notice: Other-report Critical", notice({ entryTier: "other_reports" }), false);
check("timer notice: unknown tier", notice({ entryTier: "" }), false);
// Follow-up 2: the server already answered after_window for this report.
check("timer notice: after_window already answered", notice({ kind: "closed", mark: "closed" }), false);
check("timer notice: after_window mark wins over an open reading", notice({ kind: "open", mark: "closed" }), false);
check("timer notice: after_dispatch mark is dispatched (no notice)", notice({ kind: recallState(subject(), T0, "dispatched").kind, mark: "dispatched" }), false);

// Follow-up 3: [N+] only when more than the cap exist (read limit + 1).
const idsOf = (n) => Array.from({ length: n }, (_, i) => `id-${i}`);
check("cap: under", capIds(idsOf(49), 50), { ids: idsOf(49), capped: false });
check("cap: exactly the limit is not capped", capIds(idsOf(50), 50).capped, false);
check("cap: limit + 1 is capped", capIds(idsOf(51), 50).capped, true);
check("cap: limit + 1 shows the limit", capIds(idsOf(51), 50).ids.length, 50);
check("cap: keeps the newest first", capIds(idsOf(51), 50).ids[0], "id-0");
check("cap: none", capIds([], 50), { ids: [], capped: false });

// N2: a closed window is the browser's reading; the copy never claims the outcome.
check("copy: open", recallDialogCopy(recallState(subject(), T0)), "open");
check("copy: dispatched", recallDialogCopy(recallState(twoAgencies, T0 + min)), "dispatched");
check("copy: closed with a time -> closedAt (server decides)", recallDialogCopy(recallState(subject(), endsCrit + 1000)), "closedAt");
check("copy: no window known -> mayHaveClosed", recallDialogCopy(recallState(subject({ priority: "Medium" }), T0)), "mayHaveClosed");
check("copy: undated row -> mayHaveClosed", recallDialogCopy(recallState(subject({ routing: [row({ routedAt: null })] }), T0)), "mayHaveClosed");
check("copy: none", recallDialogCopy({ kind: "none" }), "none");

const messagesSrc = readFileSync(new URL("../src/lib/messages.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
// One entry's body, single-line or multi-line, never running into the next key.
const entry = (key) =>
  messagesSrc.match(new RegExp(`\\n  "${key.replace(/[.]/g, "\\.")}": \\{([\\s\\S]*?)\\},?\\n  (?:"|\\})`))?.[1] ?? "";
check("copy N2: mayHaveClosed says the server decides", /server/.test(entry("recall.desc.mayHaveClosed")), true);
check("copy N2: mayHaveClosed claims no outcome", /keep the report|nothing is recalled|only recorded/.test(entry("recall.desc.mayHaveClosed")), false);
check("copy N2: closedAt says the server decides", /server/.test(entry("recall.desc.closed")), true);
check("copy N1: timer notice wording", /will not send this report again/.test(entry("recall.desc.timer")), true);
check("copy N1: timer notice has tl", /tl:\s*"/.test(entry("recall.desc.timer")), true);
// N4: an unknown answer may follow a write; never say it wasn't recalled.
check("copy N4: unknown says couldn't confirm", /Couldn't confirm the recall/.test(entry("recall.result.unknown")), true);
check("copy N4: unknown never says wasn't recalled", /wasn't recalled/.test(entry("recall.result.unknown")), false);
check("copy N8: badge tl", /naipasa nang hindi dumaan sa inyo/.test(entry("recall.badge")), true);

// N6: the 1-second tick stops once no window can still be open.
check("tick: routed now", windowMayBeOpen([{ routedAt: new Date(T0).toISOString() }], T0), true);
check("tick: at 15 min exactly", windowMayBeOpen([{ routedAt: new Date(T0).toISOString() }], T0 + 15 * min), true);
check("tick: past 15 min", windowMayBeOpen([{ routedAt: new Date(T0).toISOString() }], T0 + 15 * min + 1), false);
check("tick: earliest row counts", windowMayBeOpen([{ routedAt: new Date(T0 + 10 * min).toISOString() }, { routedAt: new Date(T0).toISOString() }], T0 + 16 * min), false);
check("tick: no dated rows", windowMayBeOpen([{ routedAt: null }], T0), false);
check("tick: no rows", windowMayBeOpen([], T0), false);

// N3: announce only a crossing seen on screen, never on mount.
check("announce: mount in minute", announcementFor(undefined, "minute"), null);
check("announce: mount closed", announcementFor(undefined, "closed"), null);
check("announce: open -> minute", announcementFor("open", "minute"), "oneMinute");
check("announce: minute -> closed", announcementFor("minute", "closed"), "closed");
check("announce: open -> closed", announcementFor("open", "closed"), "closed");
check("announce: closed -> closed", announcementFor("closed", "closed"), null);
check("announce: minute -> minute", announcementFor("minute", "minute"), null);
check("announce: other -> closed", announcementFor("other", "closed"), null);
check("phase: open", recallPhase(recallState(subject(), T0), T0), "open");
check("phase: minute", recallPhase(recallState(subject(), T0), endsCrit - 30_000), "minute");
check("phase: closed", recallPhase(recallState(subject(), endsCrit + 1), endsCrit + 1), "closed");
check("phase: no window", recallPhase(recallState(subject({ priority: "Medium" }), T0), T0), "other");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
