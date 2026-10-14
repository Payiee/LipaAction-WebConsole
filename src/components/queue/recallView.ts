import type { QueueReport } from "@/types";
import { recallState, type RecallState, type RecallSubject } from "@/lib/recall";
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
