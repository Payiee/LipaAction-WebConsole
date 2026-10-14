import { useEffect, useRef, useState } from "react";
import type { QueueReport } from "@/types";
import { useT } from "@/lib/i18n";
import {
  announcementFor,
  recallState,
  type RecallPhase,
  type RecallState,
  type RecallSubject,
} from "@/lib/recall";
import { splitRouting } from "./routing";

export type RecallMark = "dispatched" | "closed";

/** What src/lib/recall.ts reads from a queue report. */
export function recallSubjectOf(report: QueueReport): RecallSubject {
  const d = report.details;
  return {
    status: d.status,
    reviewedAt: d.reviewedAt,
    priority: report.priority,
    responder: Boolean(d.responderUnit),
    routing: d.routing.map((r) => ({
      agencyName: r.agencyName,
      autoRouted: r.autoRouted,
      routedAt: r.routedAt,
      resolvedAt: r.resolvedAt,
      unitAssignedAt: r.unitAssignedAt ?? null,
      enRouteAt: r.enRouteAt ?? null,
      onSceneAt: r.onSceneAt ?? null,
      inProgressAt: r.inProgressAt,
      escalated: Boolean(r.escalated),
    })),
  };
}

export function recallStateOf(report: QueueReport | null, now: number, mark: RecallMark | null = null): RecallState {
  return report ? recallState(recallSubjectOf(report), now, mark) : { kind: "none" };
}

/** The agencies still holding the report, lead first, for the copy. */
export function openAgencyNames(report: QueueReport): string {
  const open = splitRouting(report.details.routing).current.filter((r) => !r.resolvedAt);
  return (open.length > 0 ? open : report.details.routing).map((r) => r.agencyName).join(", ");
}

/** True when any current agency row came from the Critical escalation timer. */
export function isEscalated(report: QueueReport): boolean {
  return splitRouting(report.details.routing).current.some((r) => r.escalated);
}

/** A pending report the desk took back: it carries a closed 'recalled' row. */
export function wasRecalled(report: QueueReport): boolean {
  return report.details.routing.some((r) => r.resolutionOutcome === "recalled");
}

/**
 * The text of one polite live region per surface (RECALL-UI spec section
 * 11): it changes only when a report's window is seen crossing the one-minute
 * mark or closing while the surface is on screen. Never on mount: a report
 * first seen already closed or under a minute announces nothing. Pass the
 * phases from src/lib/recall.ts recallPhase.
 */
export function useRecallAnnouncement(entries: { id: string; phase: RecallPhase }[]): string {
  const t = useT();
  const seen = useRef(new Map<string, RecallPhase>());
  const [message, setMessage] = useState("");
  const key = entries.map((e) => `${e.id}:${e.phase}`).join("|");
  useEffect(() => {
    let next = "";
    for (const { id, phase } of entries) {
      const said = announcementFor(seen.current.get(id), phase);
      if (said === "oneMinute") next = t("recall.live.oneMinute", { id });
      if (said === "closed") next = t("recall.live.closed", { id });
      seen.current.set(id, phase);
    }
    if (next) setMessage(next);
    // entries is read through key: a new array each render must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, t]);
  return message;
}
