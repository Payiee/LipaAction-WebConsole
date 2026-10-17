"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PriorityBadge } from "@/components/ui/Badge";
import { useT } from "@/lib/i18n";
import { useNow } from "@/lib/useNow";
import { mayOfferRecall, recallPhase, windowMayBeOpen, type RecallState } from "@/lib/recall";
import { RecallCountdown } from "./RecallCountdown";
import { useRecall } from "./RecallContext";
import { isEscalated, openAgencyNames, recallStateOf, useRecallAnnouncement } from "./recallView";
import type { QueueReport } from "@/types";

type Listed = { report: QueueReport; state: Exclude<RecallState, { kind: "none" }> };

/**
 * The Emergency tab's list of reports routed without a review here: a
 * responder's report, or one the Critical escalation timer sent (RECALL-UI
 * spec section 4, item 1; owner's test 2026-10-14: such a report was invisible
 * to the desk). A strip, not a fifth tab (spec Q1), so QueueTabId is
 * unchanged.
 *
 * Reports whose recall window is open come first, soonest to close first,
 * each with its countdown and Recall. The rest (window closed, or a unit
 * already sent) are listed under a collapsed summary, so a backlog of old
 * automatic routings can't push live emergencies down the page; their
 * Record recall lives in the drawer, one entry point per surface.
 *
 * One clock for the whole strip, once a second only while some window could
 * still be open (windowMayBeOpen), every 30 seconds otherwise.
 * One polite live region announces only the one-minute mark and the close.
 */
export function RecallStrip({
  reports,
  unavailable,
  capped,
  onOpenDetails,
}: {
  reports: QueueReport[];
  // The auto-routed read failed.
  unavailable: boolean;
  // The read hit its cap: older ones exist that this list doesn't show.
  capped: boolean;
  onOpenDetails: (report: QueueReport) => void;
}) {
  const t = useT();
  const recall = useRecall();
  const [fast, setFast] = useState(true);
  const tick = useNow(fast ? 1000 : 30_000);
  useEffect(() => {
    setFast(tick === null || reports.some((r) => windowMayBeOpen(r.details.routing, tick)));
  }, [tick, reports]);

  const { open, rest } = useMemo(() => {
    if (tick === null) return { open: [] as Listed[], rest: [] as Listed[] };
    const listed = reports
      .map((report) => ({ report, state: recallStateOf(report, tick, recall.marks[report.id] ?? null) }))
      .filter((item): item is Listed => item.state.kind !== "none");
    return {
      open: listed
        .filter((item) => item.state.kind === "open")
        .sort((a, b) => (a.state.endsAt ?? 0) - (b.state.endsAt ?? 0)),
      rest: listed.filter((item) => item.state.kind !== "open"),
    };
  }, [reports, tick, recall.marks]);

  // One polite live region: the one-minute mark and the close, only when
  // seen crossing (never on mount).
  const announcement = useRecallAnnouncement(
    tick === null ? [] : [...open, ...rest].map(({ report, state }) => ({ id: report.id, phase: recallPhase(state, tick) }))
  );

  if (unavailable) {
    return (
      <p role="status" className="mb-3 text-xs text-priority-medium">
        {t("recall.strip.unavailable")}
      </p>
    );
  }
  if (open.length === 0 && rest.length === 0) return null;

  return (
    <section
      id="recall-strip"
      // The header badge moves focus here.
      tabIndex={-1}
      aria-labelledby="recall-strip-title"
      className="mb-3 rounded-card border border-priority-medium/30 bg-priority-mediumBg/40 px-4 py-3 shadow-panel"
    >
      <h2 id="recall-strip-title" className="text-sm font-semibold text-ink-900">
        {t("recall.strip.title")} &middot; {capped ? `${open.length + rest.length}+` : open.length + rest.length}
      </h2>
      <p className="mb-2 text-xs text-ink-700">{t("recall.strip.body")}</p>
      {capped && <p className="mb-2 text-xs text-ink-500">{t("recall.strip.capped", { count: reports.length })}</p>}
      {recall.unavailable && <p className="mb-2 text-xs text-ink-500">{t("recall.strip.recallUnavailable")}</p>}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {open.length > 0 && (
        <ul className="divide-y divide-ink-100 rounded-md border border-ink-100 bg-white">
          {open.map(({ report, state }) => (
            <StripItem key={report.id} report={report} state={state} now={tick ?? 0} onOpenDetails={onOpenDetails} />
          ))}
        </ul>
      )}

      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="flex min-h-11 cursor-pointer items-center text-xs font-medium text-ink-700">
            {t(open.length > 0 ? "recall.strip.closedSummary" : "recall.strip.closedSummaryOnly", { count: rest.length })}
          </summary>
          <ul className="divide-y divide-ink-100 rounded-md border border-ink-100 bg-white">
            {rest.map(({ report, state }) => (
              <StripItem key={report.id} report={report} state={state} now={tick ?? 0} onOpenDetails={onOpenDetails} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function StripItem({
  report,
  state,
  now,
  onOpenDetails,
}: {
  report: QueueReport;
  state: Listed["state"];
  now: number;
  onOpenDetails: (report: QueueReport) => void;
}) {
  const t = useT();
  const recall = useRecall();
  const offer = mayOfferRecall(state, recall.available);
  const agencies = openAgencyNames(report);
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2">
      <div className="min-w-0">
        <div className="mb-0.5 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-ink-500">{report.id}</span>
          <PriorityBadge priority={report.priority} />
          <span className="text-sm text-ink-900">{report.category}</span>
          {report.details.responderUnit && (
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
              {t("recall.responder", { unit: report.details.responderUnit })}
            </span>
          )}
        </div>
        <p className="text-xs text-ink-700">
          {t(isEscalated(report) ? "recall.escalatedTo" : "recall.routedTo", { agencies })}
          {" · "}
          {state.kind === "open" ? (
            <RecallCountdown endsAt={state.endsAt} now={now} />
          ) : state.kind === "dispatched" ? (
            t("recall.dispatchedNote", { agency: state.agency ?? t("recall.anAgency") })
          ) : state.endsAt === null ? (
            t("recall.noWindow")
          ) : (
            t("recall.windowClosed")
          )}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => onOpenDetails(report)} aria-label={t("row.viewDetails", { id: report.id })}>
          {t("recall.details")}
        </Button>
        {offer === "recall" && (
          <Button
            variant="danger"
            size="sm"
            disabled={recall.isPending}
            onClick={() => recall.open(report.id)}
            aria-label={t("recall.buttonFor", { id: report.id })}
          >
            {t("recall.button")}
          </Button>
        )}
      </div>
    </li>
  );
}
