import type { ChatMessage, ChatThread } from "@/lib/reportChat";

/**
 * The report chat v2's seen markers (REPORT_CHAT_V2): who has opened a
 * thread, and how far each participant has read. Pure, no React, so it can
 * be checked on its own.
 *
 * The backend keeps one report_chat_seen row per thread and participant:
 * the resident, the barangay desk as one side, and each agency as its own
 * side. No row names a person. A row exists once that participant has
 * opened the thread; seen_through is the created_at of the newest message
 * it had then, and a message is seen by it when created_at <= seen_through
 * (the backend's contract, section 5).
 */

/** Every column of report_chat_seen; it holds no user id. */
export const SEEN_COLUMNS = "id, report_id, thread, side, agency_id, opened_at, seen_at, seen_through";

export interface SeenRow {
  id: string;
  reportId: string;
  thread: ChatThread;
  side: "resident" | "barangay" | "agency";
  // Set on an agency's row, null on the others.
  agencyId: string | null;
  // The first time this participant opened the thread: "opened by".
  openedAt: string;
  // The newest message it had seen; null when the thread was empty then.
  seenThrough: string | null;
}

/** One row, from a select or a Realtime payload; null for anything else. */
export function toSeenRow(row: unknown): SeenRow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.report_id !== "string") return null;
  if (r.thread !== "group" && r.thread !== "desk") return null;
  if (r.side !== "resident" && r.side !== "barangay" && r.side !== "agency") return null;
  if (r.side === "agency" && typeof r.agency_id !== "string") return null;
  if (typeof r.opened_at !== "string") return null;
  return {
    id: r.id,
    reportId: r.report_id,
    thread: r.thread,
    side: r.side,
    agencyId: r.side === "agency" ? (r.agency_id as string) : null,
    openedAt: r.opened_at,
    seenThrough: typeof r.seen_through === "string" ? r.seen_through : null,
  };
}

/**
 * An instant in microseconds. Postgres keeps six decimals and a JavaScript
 * Date only three, and seen_through is compared with created_at exactly:
 * two messages in the same millisecond must not both read as seen.
 */
export function toMicros(iso: string): number {
  const fraction = /\.(\d+)/.exec(iso);
  const ms = Date.parse(fraction ? iso.replace(fraction[0], "") : iso);
  const micros = fraction ? Number(fraction[1].padEnd(6, "0").slice(0, 6)) : 0;
  return ms * 1000 + micros;
}

/** Someone other than the desk who can be drawn as a small avatar. */
export interface Seer {
  // Stable across renders: "resident", or "agency:<id>".
  key: string;
  side: "resident" | "agency";
  agencyId: string | null;
}

function seerOf(row: SeenRow): Seer | null {
  if (row.side === "resident") return { key: "resident", side: "resident", agencyId: null };
  if (row.side === "agency" && row.agencyId) return { key: `agency:${row.agencyId}`, side: "agency", agencyId: row.agencyId };
  // The desk is the viewer here: its own marker is not drawn.
  return null;
}

/**
 * How far the resident has read the group thread, for a resident whose app
 * still marks read the v1 way and leaves no seen row. Their
 * mark_report_messages_read() stamps read_at on the desk's messages only
 * (an agency message's read_at can be the desk's own stamp), so the newest
 * read_at on a desk message is a moment the resident had the thread open:
 * every message created by then was on their screen.
 */
function residentReadFromV1(messages: ChatMessage[]): string | null {
  let best: string | null = null;
  for (const m of messages) {
    if (m.side !== "barangay" || m.readAt === null) continue;
    if (best === null || toMicros(m.readAt) > toMicros(best)) best = m.readAt;
  }
  return best;
}

/**
 * Where each participant's avatar goes, the way a messenger draws it:
 * under the newest message it has seen. Keys are message ids. A participant
 * that has seen none of the messages shown is left out here; the header's
 * "opened by" row still names it.
 *
 * `messages` is oldest first, as sortMessages returns it.
 */
export function seenAvatarsByMessage(
  thread: ChatThread,
  messages: ChatMessage[],
  rows: SeenRow[]
): Map<string, Seer[]> {
  const through = new Map<string, { seer: Seer; at: number }>();
  for (const row of rows) {
    if (row.thread !== thread || row.seenThrough === null) continue;
    const seer = seerOf(row);
    if (seer) through.set(seer.key, { seer, at: toMicros(row.seenThrough) });
  }
  if (thread === "group") {
    const v1 = residentReadFromV1(messages);
    const current = through.get("resident");
    if (v1 !== null && (!current || toMicros(v1) > current.at)) {
      through.set("resident", { seer: { key: "resident", side: "resident", agencyId: null }, at: toMicros(v1) });
    }
  }

  const placed = new Map<string, Seer[]>();
  through.forEach(({ seer, at }) => {
    let last: ChatMessage | null = null;
    for (const m of messages) {
      if (toMicros(m.createdAt) <= at) last = m;
      else break;
    }
    if (!last) return;
    const list = placed.get(last.id) ?? [];
    list.push(seer);
    placed.set(last.id, list);
  });
  // The resident first, then agencies in a fixed order, so avatars don't
  // swap places when a marker moves.
  placed.forEach((list) => list.sort((a, b) => (a.side === b.side ? a.key.localeCompare(b.key) : a.side === "resident" ? -1 : 1)));
  return placed;
}

/** An agency that has opened a thread, for the header's "opened by" row. */
export interface Opener {
  agencyId: string;
  openedAt: string;
  // Whether it has seen the newest message shown.
  caughtUp: boolean;
}

/**
 * The agencies that have opened this thread, first opened first. The
 * backend shows an agency's row only while the agency still holds the
 * report, so one that was recalled drops out of this list by itself.
 */
export function openedBy(thread: ChatThread, messages: ChatMessage[], rows: SeenRow[]): Opener[] {
  const newest = messages.length > 0 ? toMicros(messages[messages.length - 1].createdAt) : null;
  return rows
    .filter((r): r is SeenRow & { agencyId: string } => r.thread === thread && r.side === "agency" && r.agencyId !== null)
    .map((r) => ({
      agencyId: r.agencyId,
      openedAt: r.openedAt,
      caughtUp: newest === null || (r.seenThrough !== null && toMicros(r.seenThrough) >= newest),
    }))
    .sort((a, b) => toMicros(a.openedAt) - toMicros(b.openedAt) || a.agencyId.localeCompare(b.agencyId));
}

// The most letters an agency's avatar holds (ChatAvatar).
export const AGENCY_LABEL_MAX = 6;

/**
 * The avatar label of each agency the city has, keyed by its code in the
 * agencies table. One table, the same on every surface (this console, the
 * agency console, the app): city_health is CHO, the City Health Office's
 * own short name, not HEALTH.
 */
export const AGENCY_AVATAR_LABELS: ReadonlyMap<string, string> = new Map([
  ["pnp", "PNP"],
  ["bfp", "BFP"],
  ["cdrrmo", "CDRRMO"],
  ["cswdo", "CSWDO"],
  ["ceo", "CEO"],
  ["city_health", "CHO"],
]);

/**
 * The short label on an agency's avatar, at most six letters so it fits the
 * small avatar. A code in AGENCY_AVATAR_LABELS (matched ignoring case and
 * surrounding spaces) gets its label from there: pnp PNP, bfp BFP,
 * cdrrmo CDRRMO, cswdo CSWDO, ceo CEO, city_health CHO.
 *
 * Any other code falls back to a rule:
 * - a one-word code is the agency's acronym, whole;
 * - a compound code names the office's work in its last word (cutting the
 *   code to four letters would print CDRR and CITY); if that word is longer
 *   than six letters, the parts' first letters.
 *
 * With no code, the first letters of the name. Agencies, not people: a
 * resident's avatar is an icon, never initials.
 */
export function agencyInitials(code: string | null | undefined, name: string | null | undefined): string {
  const known = AGENCY_AVATAR_LABELS.get((code ?? "").trim().toLowerCase());
  if (known) return known;
  const parts = (code ?? "").trim().split(/[\s_-]+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, AGENCY_LABEL_MAX).toUpperCase();
  if (parts.length > 1) {
    const last = parts[parts.length - 1];
    const label = last.length <= AGENCY_LABEL_MAX ? last : parts.map((w) => w[0]).join("");
    return label.slice(0, AGENCY_LABEL_MAX).toUpperCase();
  }
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 3).map((w) => w[0]).join("");
  return letters ? letters.toUpperCase() : "?";
}
