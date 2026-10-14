"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { PriorityBadge } from "@/components/ui/Badge";
import { useT } from "@/lib/i18n";
import { useNow } from "@/lib/useNow";
import { countdown, mayOfferRecall, type RecallState } from "@/lib/recall";
import { RecallCountdown } from "./RecallCountdown";
import { useRecall } from "./RecallContext";
import { isEscalated, openAgencyNames, recallStateOf } from "./recallView";
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
 * One clock for the whole strip, once a second while any window is open.
 * One polite live region announces only the one-minute mark and the close.
 */
export function RecallStrip({
  reports,
  unavailable,
  onOpenDetails,
}: {
  reports: QueueReport[];
  // The auto-routed read failed.
  unavailable: boolean;
  onOpenDetails: (report: QueueReport) => void;
}) {
  const t = useT();
  const recall = useRecall();
  const anyCandidate = reports.length > 0;
  const tick = useNow(anyCandidate ? 1000 : 60_000);

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

  // Announce crossing the one-minute mark and the close, once each.
  const [announcement, setAnnouncement] = useState("");
  const phase = useRef(new Map<string, "open" | "minute" | "closed">());
  useEffect(() => {
    if (tick === null) return;
    const seen = phase.current;
    let message = "";
    for (const { report, state } of open) {
      const next = countdown(state.endsAt ?? 0, tick).underMinute ? "minute" : "open";
      if (next === "minute" && seen.get(report.id) === "open") message = t("recall.live.oneMinute", { id: report.id });
      seen.set(report.id, next);
    }
    const stillOpen = new Set(open.map((item) => item.report.id));
    for (const [id, was] of seen) {
      if (was !== "closed" && !stillOpen.has(id)) {
        if (rest.some((item) => item.report.id === id && item.state.kind === "closed")) {
          message = t("recall.live.closed", { id });
        }
        seen.set(id, "closed");
      }
    }
    if (message) setAnnouncement(message);
  }, [open, rest, tick, t]);

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
        {t("recall.strip.title")} &middot; {open.length + rest.length}
      </h2>
      <p className="mb-2 text-xs text-ink-700">{t("recall.strip.body")}</p>
      {!recall.available && <p className="mb-2 text-xs text-ink-500">{t("recall.strip.recallUnavailable")}</p>}
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
            {t("recall.strip.closedSummary", { count: rest.length })}
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
            <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700">
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
