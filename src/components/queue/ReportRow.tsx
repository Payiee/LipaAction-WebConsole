"use client";

import { PriorityBadge } from "@/components/ui/Badge";
import { ReporterChip } from "@/components/ui/ReporterChip";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ReasonPromptModal } from "@/components/ui/ReasonPromptModal";
import { cx, reportsAlreadyResolved, timeAgo } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { REPORT_CHAT_LIVE } from "@/lib/features";
import { isChatOffered } from "@/lib/reportChat";
import { isReviewable, statusLabel, useReportReview, type Verdict } from "./useReportReview";
import { useReportRouting } from "./useReportRouting";
import { AgencyPickerModal } from "./AgencyPickerModal";
import { useBarangayResolve } from "./useBarangayResolve";
import { ResolveNoteModal } from "./ResolveNoteModal";
import {
  canResolveAtBarangay,
  downstreamSummary,
  everyAgencyReturned,
  isAutoRouted,
  rerouteCopy,
  chooseCopy,
  returnedSummary,
  routeConfirmCopy,
  routingState,
} from "./routing";
import type { QueueReport } from "@/types";

export function ReportRow({
  report,
  // Owned by QueueClient, not by this row: the same report can also be
  // resolved from the detail drawer, and the row has to reflect that.
  resolvedAs,
  // True for a few seconds after this report turned up on its own. Owned by
  // QueueClient, which is the only place that can tell a new report from one
  // that was already on screen.
  justArrived = false,
  // QueueClient's clock, so the age keeps moving while nothing refreshes;
  // null on the first render, which shows the server's own string.
  now = null,
  onResolved,
  onOpenDetails,
  onOpenChat,
}: {
  report: QueueReport;
  resolvedAs?: Verdict;
  justArrived?: boolean;
  now?: number | null;
  onResolved: (verdict: Verdict) => void;
  onOpenDetails: () => void;
  // Opens the detail drawer on the chat, where Validate and Reject are also
  // offered.
  onOpenChat: () => void;
}) {
  const { isPending, isRejecting, openReject, cancelReject, validate, reject } = useReportReview(
    report.id,
    onResolved
  );
  const routing = useReportRouting(report.id);
  const state = routingState(report);
  const barangayResolve = useBarangayResolve(report.id);
  const t = useT();
  // One write at a time: routing and resolving both end the report's stay
  // in this list, and neither can be undone.
  const busy = routing.isPending || barangayResolve.isPending;

  // An Other-report the desk may close itself, beside the routing action it
  // can take instead.
  const resolveButton = (variant: "primary" | "secondary") =>
    canResolveAtBarangay(report, state) && (
      <Button variant={variant} size="sm" disabled={busy} onClick={barangayResolve.openPrompt}>
        {t("resolve.button")}
      </Button>
    );

  if (resolvedAs) {
    return (
      <div className="flex items-center justify-between gap-4 border-b border-ink-100 bg-ink-50/60 px-4 py-3 text-sm text-ink-500 last:border-0">
        <span className="font-mono text-xs">{report.id}</span>
        <span>
          {resolvedAs === "validated" ? t("row.resolvedValidated") : t("status.rejected")}
        </span>
      </div>
    );
  }

  // Past review, the row's action is routing. A report that has been
  // validated but not routed has reached no agency at all — nothing routes
  // on its own — so the button sits exactly where Validate was.
  function renderPastReview() {
    switch (state.kind) {
      case "ready":
        return (
          <>
            {resolveButton("secondary")}
            <Button variant="primary" size="sm" disabled={busy} onClick={routing.openConfirm}>
              {t("routing.routeToAgency")}
            </Button>
          </>
        );
      case "incomplete":
        return (
          <>
            <span className="text-xs font-medium text-priority-medium">{t("row.routingIncomplete")}</span>
            <Button
              variant="primary"
              size="sm"
              disabled={routing.isPending}
              onClick={routing.openConfirm}
            >
              {t("routing.finish")}
            </Button>
          </>
        );
      case "returned":
        // Every agency sent it back. The next agency is the official's
        // choice, so the button opens the picker rather than a confirmation.
        return (
          <>
            <span className="max-w-[14rem] text-right text-xs font-medium text-priority-medium">
              {returnedSummary(state, t)}
            </span>
            {state.options === null ? (
              <span className="max-w-[10rem] text-right text-xs text-ink-500">{t("row.returnedUnavailable")}</span>
            ) : (
              state.options.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  disabled={routing.isPending}
                  onClick={routing.openConfirm}
                >
                  {t("routing.routeElsewhere")}
                </Button>
              )
            )}
          </>
        );
      case "choose":
        // An Other-report goes where the official says: the button opens the
        // agency picker, with the mapped agencies ticked in advance.
        return state.options === null ? (
          <>
            <span className="max-w-[10rem] text-right text-xs text-ink-500">{t("row.returnedUnavailable")}</span>
            {resolveButton("primary")}
          </>
        ) : (
          <>
            {resolveButton("secondary")}
            {state.options.length > 0 && (
              <Button variant="primary" size="sm" disabled={busy} onClick={routing.openConfirm}>
                {t("routing.routeToAgency")}
              </Button>
            )}
          </>
        );
      case "no-mapping":
        return (
          <>
            <span className="max-w-[14rem] text-right text-xs font-medium text-priority-medium">
              {t("row.noMapping")}
            </span>
            {/* With no agency to send it to, resolving is the one action. */}
            {resolveButton("primary")}
          </>
        );
      case "unavailable":
        return (
          <span className="max-w-[14rem] text-right text-xs text-ink-500">
            {t("row.routingUnavailable")}
          </span>
        );
      case "downstream":
        return (
          <span className="max-w-[16rem] text-right text-xs text-ink-700">
            {downstreamSummary(state, t)}
          </span>
        );
      case "none":
        return (
          <span className="text-xs font-medium text-ink-500">
            {statusLabel(report.details.status, t)}
          </span>
        );
    }
  }

  return (
    <>
      <div
        className={cx(
          "flex items-start justify-between gap-4 border-b border-ink-100 px-4 py-3 last:border-0 hover:bg-ink-50/60",
          // The tint fades out on its own; with reduced motion it simply
          // holds until QueueClient drops the flag. Either way the New chip
          // below carries the same fact in words, so nothing is said by
          // colour alone.
          justArrived && "motion-safe:animate-arrival motion-reduce:bg-brand-100"
        )}
      >
        {/* The whole summary block opens the detail drawer. A report is
            reviewed on the strength of what it says, and the row only shows a
            truncated line of it. */}
        <button
          type="button"
          onClick={onOpenDetails}
          className="min-w-0 flex-1 text-left"
          aria-label={t("row.viewDetails", { id: report.id })}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-ink-500">{report.id}</span>
            {justArrived && (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                {t("row.new")}
              </span>
            )}
            <PriorityBadge priority={report.priority} score={report.details.priorityScore} />
            {/* The reporter said it already resolved (the paper's FR-04). It
                keeps its score and is never routed automatically, so without
                the mark it reads as an ordinary open emergency. */}
            {isReviewable(report.details.status) && reportsAlreadyResolved(report.details.safetyNetConfirmation) && (
              <span
                title={t("row.alreadyResolvedTitle")}
                className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-[11px] font-semibold text-priority-medium"
              >
                {t("row.alreadyResolved")}
              </span>
            )}
            {/* Back in the queue after an automatic routing that every agency
                sent back: its age and score would otherwise make it look like
                any other report waiting for a first look. */}
            {isReviewable(report.details.status) && everyAgencyReturned(report.details.routing) && (
              <span className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-[11px] font-semibold text-priority-medium">
                {t("row.returnedChip")}
              </span>
            )}
            {/* Routed with no review at the desk. Without the mark it would
                sit among the desk's own routings as if someone here had
                validated it. */}
            {isAutoRouted(state) && (
              <span
                title={t("drawer.autoRouted")}
                className="rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700"
              >
                {t("row.autoRouted")}
              </span>
            )}
            {/* Visible before the decision, not only inside the drawer. */}
            {report.details.discreetReporting && (
              <span
                title={t("drawer.discreetBanner")}
                className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-[11px] font-semibold text-priority-medium"
              >
                {t("row.discreet")}
              </span>
            )}
            <span className="text-xs font-medium text-ink-700">{report.category}</span>
          </div>
          <p className="mb-1.5 truncate text-sm text-ink-900">{report.summary}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
            {report.location && (
              <>
                <span>{report.location}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{now === null ? report.timestamp : timeAgo(report.details.submittedAt, now)}</span>
            <span aria-hidden>·</span>
            <ReporterChip reporter={report.reporter} />
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {/* The Recent validated tab renders this same row. A report already
              past review shows its routing state instead of review buttons
              that would only fail — and leaving no [data-validate-button]
              behind is also what keeps [Validate next] from landing on a
              decided report. */}
          {/* Chat stays on the row after validation: the conversation with
              the reporter goes on while agencies handle the report, and the
              staff-only Desk thread exists only once it has been routed.
              Hidden for a discreet report, as everywhere. */}
          {isChatOffered(REPORT_CHAT_LIVE, report.details.discreetReporting) && (
            <Button
              variant="secondary"
              size="sm"
              disabled={isPending || busy}
              onClick={onOpenChat}
              aria-label={t("row.chatLabel", { id: report.id })}
            >
              {t("row.chat")}
            </Button>
          )}
          {isReviewable(report.details.status) ? (
            <>
              <Button variant="secondary" size="sm" disabled={isPending} onClick={openReject}>
                {t("review.reject")}
              </Button>
              {/* data-validate-button: QueueClient's [Validate next] finds the
                  first one of these to scroll to and focus. */}
              <Button
                variant="primary"
                size="sm"
                data-validate-button
                data-report-id={report.id}
                disabled={isPending}
                onClick={validate}
              >
                {t("review.validate")}
              </Button>
            </>
          ) : (
            renderPastReview()
          )}
        </div>
      </div>

      {isRejecting && (
        <ReasonPromptModal
          title={t("review.rejectTitle", { id: report.id })}
          description={t("review.rejectDescription")}
          confirmLabel={t("review.rejectConfirm")}
          onCancel={cancelReject}
          onConfirm={reject}
        />
      )}

      {routing.isConfirming && (state.kind === "ready" || state.kind === "incomplete") && (
        <ConfirmModal
          {...routeConfirmCopy(report, state.plan, state.kind === "incomplete", t)}
          busy={routing.isPending}
          onCancel={routing.cancelConfirm}
          onConfirm={routing.route}
        />
      )}

      {barangayResolve.isPrompting && (
        <ResolveNoteModal
          reportId={report.id}
          busy={barangayResolve.isPending}
          onCancel={barangayResolve.cancelPrompt}
          onConfirm={barangayResolve.resolve}
        />
      )}

      {routing.isConfirming && state.kind === "choose" && state.options && state.options.length > 0 && (
        <AgencyPickerModal
          {...chooseCopy(report, state, t)}
          options={state.options}
          initial={state.suggested}
          busy={routing.isPending}
          onCancel={routing.cancelConfirm}
          onConfirm={routing.routeTo}
        />
      )}

      {routing.isConfirming && state.kind === "returned" && state.options && state.options.length > 0 && (
        <AgencyPickerModal
          {...rerouteCopy(report, state, t)}
          options={state.options}
          busy={routing.isPending}
          onCancel={routing.cancelConfirm}
          onConfirm={routing.reroute}
        />
      )}
    </>
  );
}
