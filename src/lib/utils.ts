export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

// Role names are interface text: see role.* in src/lib/messages.ts.

/**
 * An official's name as it should appear on screen.
 *
 * `fullName ?? "Unnamed official"` is not enough: `??` only catches null and
 * undefined, so an empty or whitespace-only profiles.full_name fell through
 * and rendered as a blank name with a blank avatar. This console can't write
 * such a value — updateDisplayName rejects it — but `profiles` is shared with
 * the mobile app and the other dashboard, and rows are also inserted by hand.
 */
export function displayName(fullName: string | null | undefined): string {
  // Sanitised on read as well as on write: profiles.full_name can also be set
  // by other surfaces sharing the project, or directly through PostgREST.
  const cleaned = sanitizeName(fullName ?? "");
  return cleaned.length > 0 ? cleaned : "Unnamed official";
}

// Characters that render as nothing, or reorder the text around them, but
// still make two names compare unequal: C0/C1 controls, soft hyphen, the
// zero-width family, bidirectional overrides and isolates, and the BOM. A
// display name is an identity on this console — it's the [Validating
// official] on every decision and in the CSV — so [Shan] and [Shan] with a
// zero-width space must not be two different people, and a right-to-left
// override must not be able to make a name read as someone else's.
const INVISIBLE_OR_REORDERING =
  /[\u0000-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

/**
 * Normalises a person's display name: NFKC (so full-width and compatibility
 * forms collapse to one spelling), invisible and bidi characters removed,
 * runs of whitespace collapsed, ends trimmed. Pure and safe on any string.
 */
export function sanitizeName(name: string): string {
  return name.normalize("NFKC").replace(INVISIBLE_OR_REORDERING, "").replace(/\s+/g, " ").trim();
}

// Shape only — eight-four-four-four-twelve hex — not an RFC 4122 version
// check. Server Actions are public POST endpoints: a report id arrives as
// whatever the caller sent, and must be proven a string of this shape before
// it reaches a query, a log line, or a loop.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The longest rejection reason accepted — by the reject prompt's textarea and
// by updateReportStatus, which re-checks it because the action is a public
// endpoint. Stops a caller storing a megabyte of text as a reason.
export const MAX_REASON_LENGTH = 1000;

/**
 * True when the reporter answered the safety-net question with [No, it
 * already resolved]. The mobile app stores that as 'no_resolved' (the column
 * allows only 'yes', 'no_resolved' and 'unsure'; confirmed by the backend
 * owner 2026-09-29). Such a report keeps its score and is never routed
 * automatically, so the desk marks it for review.
 */
export function reportsAlreadyResolved(safetyNetConfirmation: string | null): boolean {
  return safetyNetConfirmation === "no_resolved";
}

// The longest display name accepted, for the same two places.
export const MAX_NAME_LENGTH = 80;

// The paper's rejection categories (A.3.2: wrong category, already resolved,
// mistaken identity, not an emergency, duplicate), plus Other from the recall
// sheet's list (A.2.4). review_report() takes one free-text reason and the
// schema has no reason-code column, so the category travels inside that text
// as a stable prefix — `[duplicate] same incident as …` — and is parsed back
// out for display. A reason without a known prefix (rejections from before
// this, or from the other dashboard sharing the database) is shown as it
// stands and never guessed into a category.
export const REJECT_REASON_CODES = [
  "wrong_category",
  "already_resolved",
  "mistaken_identity",
  "not_an_emergency",
  "duplicate",
  "other",
] as const;

export type RejectReasonCode = (typeof REJECT_REASON_CODES)[number];

// English names: the dictionary's English column, and the CSV export, which
// stays English whatever the interface language.
export const REJECT_REASON_LABELS: Record<RejectReasonCode, string> = {
  wrong_category: "Wrong category",
  already_resolved: "Already resolved",
  mistaken_identity: "Mistaken identity",
  not_an_emergency: "Not an emergency",
  duplicate: "Duplicate",
  other: "Other",
};

// The note after the prefix, kept short enough that the longest prefix still
// fits inside MAX_REASON_LENGTH.
export const MAX_REJECT_NOTE_LENGTH = 900;

export function isRejectReasonCode(value: unknown): value is RejectReasonCode {
  return typeof value === "string" && (REJECT_REASON_CODES as readonly string[]).includes(value);
}

export function composeRejectReason(code: RejectReasonCode, note: string): string {
  const trimmed = note.trim();
  return trimmed.length > 0 ? `[${code}] ${trimmed}` : `[${code}]`;
}

const REJECT_REASON_PREFIX = /^\[([a-z_]+)\](?:\s+([\s\S]*))?$/;

export function parseRejectReason(reason: string): { code: RejectReasonCode | null; note: string } {
  const text = reason.trim();
  const match = REJECT_REASON_PREFIX.exec(text);
  if (match && isRejectReasonCode(match[1])) return { code: match[1], note: (match[2] ?? "").trim() };
  return { code: null, note: text };
}

/**
 * How a reporter is described on every surface. The paper's wording (A.3.2,
 * A.3.3): a withheld report still comes from a verified account — the system
 * has no anonymous path — so it reads [Verified reporter, identity withheld]
 * rather than a bare [Identity withheld], which suggested an unknown sender.
 * Shared by the three loaders so the queue, Cluster Explorer and Validation
 * History (and its CSV) can't drift. Never a name, withheld or not.
 */
export function reporterLabel(identityWithheld: boolean): string {
  return identityWithheld ? "Verified reporter, identity withheld" : "Verified reporter";
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_SHAPE.test(value);
}

/**
 * One CSV cell, safe to open in a spreadsheet.
 *
 * RFC 4180 quoting alone is not enough: Excel, LibreOffice and Sheets decide
 * formula-versus-text after unquoting, so a quoted cell that starts with
 * `=`, `+`, `-`, `@` (or a tab or carriage return, which some of them skip
 * first) is still evaluated. Three exported columns carry text other people
 * typed — the rejection reason, the validating official's display name, and
 * the category — so any of them could arrive as `=HYPERLINK(...)`. A leading
 * apostrophe makes the cell text in all three programs; the cost is that a
 * reason genuinely starting with a dash exports with an apostrophe in front.
 * Full-width lookalikes are included because NFKC-folding spreadsheets treat
 * them the same.
 */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  const inert = /^[\t\r]|^\s*[=+\-@＝＋－＠]/.test(text) ? `'${text}` : text;
  return `"${inert.replace(/"/g, '""')}"`;
}

/**
 * Renders a minute count at a scale a person can read at a glance.
 *
 * A backlog measured in minutes stops being legible fast — a report sitting
 * for nine days reads as "13242 min", which no one parses as over a week.
 * Minutes stay exact under an hour, where the difference actually matters
 * for triage.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainderMinutes = minutes % 60;
    return remainderMinutes === 0 ? `${hours}h` : `${hours}h ${remainderMinutes}m`;
  }

  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  return remainderHours === 0 ? `${days}d` : `${days}d ${remainderHours}h`;
}

/**
 * [5m ago] from an exact timestamp. English on purpose, like every other
 * value formatted from report data. `now` is a parameter so the queue can
 * re-render ages on its own clock: ages formatted on the server froze at the
 * last fetch, and a live queue with nothing changing doesn't fetch, so a
 * report that arrived [just now] still said so minutes later, beside a
 * 5-minute SLA. A clock behind the database reads as [just now], not as a
 * negative age.
 */
export function timeAgo(isoString: string, now: number = Date.now()): string {
  const diffMin = Math.floor((now - new Date(isoString).getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

/** Median age, in whole minutes, of the given timestamps; 0 when there are none. */
export function medianAgeMinutes(isoStrings: string[], now: number = Date.now()): number {
  if (isoStrings.length === 0) return 0;
  const ages = isoStrings
    .map((iso) => Math.floor((now - new Date(iso).getTime()) / 60000))
    .sort((a, b) => a - b);
  const mid = Math.floor(ages.length / 2);
  return ages.length % 2 !== 0 ? ages[mid] : Math.round((ages[mid - 1] + ages[mid]) / 2);
}
// Philippine Standard Time, fixed at UTC+8 — the country observes no DST, so
// a constant offset is exact, not an approximation.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Midnight at the start of today in Manila, as an instant.
 *
 * Every "today" in this console means the officials' day, not the machine's.
 * Server code runs in whatever zone the host is set to (UTC once deployed),
 * and client code runs in whatever zone the official's laptop is set to;
 * `new Date().setHours(0, 0, 0, 0)` would give a different boundary in each,
 * and a UTC boundary rolls the day over at 8am Manila — mid-shift.
 *
 * Shared by the queue's [Validated today] count (server) and Validation
 * History's Today filter (client), so the two can never disagree about which
 * day a review belongs to. Takes `now` as a parameter only for testability.
 */
export function startOfManilaDay(now: number = Date.now()): Date {
  const shifted = now + MANILA_OFFSET_MS;
  return new Date(Math.floor(shifted / DAY_MS) * DAY_MS - MANILA_OFFSET_MS);
}

/**
 * Every distinct category among a duplicate group's members, in the order the
 * members come, display form. Shared by the queue and Cluster Explorer
 * loaders so both pages describe a group the same way.
 */
export function distinctCategories(categories: string[]): string[] {
  return [...new Set(categories)];
}

/**
 * Turns a category key into something readable: `medical_emergency` becomes
 * `Medical emergency`.
 *
 * incident_reports.category holds the canonical snake_case key — the same
 * value category_agency_routing is keyed on — so it reached every screen as
 * `crime_in_progress`. This is display only, and applied in the data modules
 * so that what an official searches, exports, and reads all agree. The raw
 * key is never lost: routeReport re-reads it from the database server-side,
 * so the agency lookup is unaffected by anything done here.
 *
 * Values that are already prose pass through with only their first letter
 * capitalised.
 */
export function categoryLabel(category: string): string {
  const words = category.trim().replace(/[_-]+/g, " ");
  if (words.length === 0) return "Uncategorised";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * A lookup that only answers for the record's own keys. The label maps for
 * values the backend stores (a method, a role, a cause) are plain objects,
 * and a stored value of [toString] or [constructor] would otherwise find
 * something on every object and be handed on as if it were a label. An
 * unknown value gets undefined, and is then shown as itself.
 */
export function ownValue<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;
}

/**
 * The instant a Manila calendar day starts, from `YYYY-MM-DD` as a date input
 * or a URL sends it, or null when that isn't a real day. The round trip
 * catches days that don't exist: some engines roll 2026-02-31 over to March
 * instead of refusing it.
 */
export function manilaDayStart(day: unknown): number | null {
  if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  // No day of this system is before 2000, and a bound that old is one the
  // database refuses instead of ignoring.
  if (Number(day.slice(0, 4)) < 2000) return null;
  const start = Date.parse(`${day}T00:00:00+08:00`);
  if (Number.isNaN(start)) return null;
  return new Date(start + MANILA_OFFSET_MS).toISOString().slice(0, 10) === day ? start : null;
}

/**
 * A calendar date in Manila, `Oct 2, 2026`, for values where the day is what
 * matters and the hour would only add noise. Manila like every other time on
 * the console; an unparseable value passes through rather than becoming
 * [Invalid Date].
 */
export function manilaDate(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return parsed.toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * A date and time for the screen, in Manila: [Oct 17, 2026, 14:05]. Pinned to
 * Manila even in the browser: Validation History formats the same instants
 * on the server in Asia/Manila, and an official whose laptop is set to
 * another zone would otherwise see the two disagree.
 */
export function manilaDateTime(isoString: string): string {
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return isoString;
  return parsed.toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * An exact timestamp in Manila, keeping its offset: `2026-09-16T15:54:43+08:00`.
 *
 * For files that leave the console. Everything on screen is Manila (see
 * startOfManilaDay), but the CSV used to carry the raw column value, which
 * Supabase returns in UTC — so a row shown as 15:54 was exported as 07:54,
 * and a DPO reading the export would have put the access eight hours earlier
 * than the official who made it. Keeping the +08:00 offset means the value
 * is still unambiguous and still sorts correctly, unlike a bare local time.
 */
export function manilaTimestamp(isoString: string): string {
  const parsed = new Date(isoString);
  // An unparseable value passes through rather than becoming [Invalid Date].
  if (Number.isNaN(parsed.getTime())) return isoString;

  const shifted = new Date(parsed.getTime() + MANILA_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}+08:00`
  );
}
