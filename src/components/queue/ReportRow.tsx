"use client";

import { PriorityBadge, priorityBar } from "@/components/ui/Badge";
import { ReporterChip } from "@/components/ui/ReporterChip";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ReasonPromptModal } from "@/components/ui/ReasonPromptModal";
import { CopyIdButton } from "@/components/ui/CopyIdButton";
import { cx, manilaDateTime, reportsAlreadyResolved, timeAgo } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { REPORT_CHAT_LIVE } from "@/lib/features";
import { isChatOffered } from "@/lib/reportChat";
import { isReviewable, statusLabel, useReportReview, type Verdict } from "./useReportReview";
import { useReportRouting } from "./useReportRouting";
import { useEmergencyValidation } from "./useEmergencyValidation";
import { useCdrrmoDispatch, usesDispatch } from "./CdrrmoDispatchContext";
import { AgencyPickerModal } from "./AgencyPickerModal";
import { EmergencyValidationDialog } from "./EmergencyValidationDialog";
import { useBarangayResolve } from "./useBarangayResolve";
import { ResolveNoteModal } from "./ResolveNoteModal";
import {
  canResolveAtBarangay,
  dispatchPastReview,
  downstreamSummary,
  everyAgencyReturned,
  isAutoRouted,
  rerouteCopy,
  chooseCopy,
  returnedSummary,
  routeConfirmCopy,
  routingState,
} from "./routing";
import { useRecall } from "./RecallContext";
import { isEscalated, recallStateOf, wasRecalled } from "./recallView";
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
  // RECALL-UI chips, read on the page's 30-second clock (null before mount:
  // no chip until then, so the server's HTML matches).
  const recall = useRecall();
  const escalated = isAutoRouted(state) && isEscalated(report);
  const recallOpen = now !== null && recallStateOf(report, now, recall.marks[report.id] ?? null).kind === "open";
  const barangayResolve = useBarangayResolve(report.id);
  // CDRRMO dispatch (src/lib/cdrrmo-dispatch.ts): with the backend's switch
  // on, an Emergency report is validated or rejected through one function
  // that also routes it, to the agencies the desk ticks as it validates
  // (owner decision Q4). Off, this is false and the row is exactly what it
  // was.
  const dispatch = useCdrrmoDispatch();
  const viaDispatch = usesDispatch(dispatch.active, report);
  const emergency = useEmergencyValidation(report.id, onResolved);
  const t = useT();
  // One write at a time: routing and resolving both end the report's stay
  // in this list, and neither can be undone.
  const busy = routing.isPending || barangayResolve.isPending || emergency.isPending;

  // An Other-report the desk may close itself, beside the routing action it
  // can take instead.
  const resolveButton = (variant: "primary" | "secondary") =>
    canResolveAtBarangay(report, state) && (
      <Button variant={variant} disabled={busy} onClick={barangayResolve.openPrompt}>
        {t("resolve.button")}
      </Button>
    );

  if (resolvedAs) {
    return (
      <div
        className={cx(
          "flex items-center justify-between gap-4 rounded-card border border-l-4 border-ink-100 bg-ink-50 px-5 py-3 text-sm text-ink-500 motion-safe:animate-settle",
          priorityBar(report.priority)
        )}
      >
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
    if (viaDispatch) {
      // An Emergency report while CDRRMO dispatch is on: the desk validates,
      // the database routes (see dispatchPastReview for each case).
      const next = dispatchPastReview(report, state);
      if (next === "send") {
        return (
          <>
            <span className="max-w-[14rem] text-right text-xs text-ink-500">{t("cdrrmo.pastReview")}</span>
            <Button variant="primary" disabled={busy} onClick={emergency.openSend}>
              {t("cdrrmo.validateConfirm")}
            </Button>
          </>
        );
      }
      if (next === "record" && state.kind === "downstream") {
        return (
          <>
            <span className="max-w-[16rem] text-right text-xs text-ink-700">
              {downstreamSummary(state, t)}
              <span className="block text-priority-medium">{t("cdrrmo.notValidatedHere")}</span>
            </span>
            <Button variant="primary" disabled={busy} onClick={emergency.openRecord}>
              {t("review.validate")}
            </Button>
          </>
        );
      }
      if (next === "partial" || next === "handedBack") {
        return (
          <span className="max-w-[16rem] text-right text-xs font-medium text-priority-medium">
            {t(next === "partial" ? "cdrrmo.legacyPartial" : "cdrrmo.handedBack")}
          </span>
        );
      }
    }
    switch (state.kind) {
      case "incomplete":
        return (
          <>
            <span className="text-xs font-medium text-priority-medium">{t("row.routingIncomplete")}</span>
            <Button
              variant="primary"

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
        // Every report goes where the official says: the button opens the
        // agency list, with the category's agencies marked Recommended and
        // nothing ticked. A Standard intake report may be resolved here
        // instead.
        return state.options === null ? (
          <>
            <span className="max-w-[10rem] text-right text-xs text-ink-500">{t("row.returnedUnavailable")}</span>
            {resolveButton("primary")}
          </>
        ) : (
          <>
            {resolveButton("secondary")}
            {state.options.length > 0 && (
              <Button variant="primary" disabled={busy} onClick={routing.openConfirm}>
                {t("routing.routeToAgency")}
              </Button>
            )}
          </>
        );
      case "downstream":
        return (
          <span className="max-w-[16rem] text-right text-xs text-ink-700">
            {downstreamSummary(state, t)}
          </span>
        );
      case "rejectedByCdrrmo":
        // Routed, then rejected by CDRRMO. Final: nothing to do here.
        return (
          <span title={t("cdrrmo.rejectedByCdrrmoBody")} className="text-xs font-medium text-priority-medium">
            {t("cdrrmo.rejectedByCdrrmo")}
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
      {/* One card per report, in the order the reviewer feedback of October
          2026 asked for: priority and category first, then where the report
          stands, what it says, when it came in and who sent it, and the id
          last, where it no longer outshouts the rest. */}
      <div
        className={cx(
          "rounded-card border border-l-4 border-ink-100 bg-white shadow-panel",
          priorityBar(report.priority),
          // The tint fades out on its own; with reduced motion it simply
          // holds until QueueClient drops the flag. Either way the New chip
          // below carries the same fact in words, so nothing is said by
          // colour alone.
          justArrived && "motion-safe:animate-arrival motion-reduce:bg-brand-100"
        )}
      >
        <div className="flex flex-col gap-4 px-4 pb-3 pt-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
        {/* The whole summary block opens the detail drawer. A report is
            reviewed on the strength of what it says, and the row only shows a
            truncated line of it. */}
        <button
          type="button"
          onClick={onOpenDetails}
          className="min-w-0 flex-1 text-left"
          aria-label={t("row.viewDetails", { id: report.id })}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={report.priority} score={report.details.priorityScore} />
            <span className="text-base font-semibold text-ink-900">{report.category}</span>
            <span
              className={cx(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                report.details.status === "resolved" ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-700"
              )}
            >
              {statusLabel(report.details.status, t)}
            </span>
            {justArrived && (
              <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
                {t("row.new")}
              </span>
            )}
            {/* The reporter said it already resolved (the paper's FR-04). It
                keeps its score and is never routed automatically, so without
                the mark it reads as an ordinary open emergency. */}
            {isReviewable(report.details.status) && reportsAlreadyResolved(report.details.safetyNetConfirmation) && (
              <span
                title={t("row.alreadyResolvedTitle")}
                className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-xs font-semibold text-priority-medium"
              >
                {t("row.alreadyResolved")}
              </span>
            )}
            {/* Back in the queue after an automatic routing that every agency
                sent back: its age and score would otherwise make it look like
                any other report waiting for a first look. */}
            {isReviewable(report.details.status) && everyAgencyReturned(report.details.routing) && (
              <span className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-xs font-semibold text-priority-medium">
                {t("row.returnedChip")}
              </span>
            )}
            {/* Back in the queue because this barangay recalled it from the
                agencies (RECALL-UI). */}
            {isReviewable(report.details.status) && wasRecalled(report) && (
              <span className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-xs font-semibold text-priority-medium">
                {t("row.recalledChip")}
              </span>
            )}
            {/* Routed with no review at the desk. Without the mark it would
                sit among the desk's own routings as if someone here had
                validated it. [Escalated] when the Critical escalation timer
                sent it. */}
            {isAutoRouted(state) && (
              <span
                title={t(escalated ? "drawer.escalated" : "drawer.autoRouted")}
                className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700"
              >
                {t(escalated ? "row.escalated" : "row.autoRouted")}
              </span>
            )}
            {/* The countdown and the button live in the strip and the
                drawer; the row only says the window is open. */}
            {recallOpen && (
              <span className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-xs font-semibold text-priority-medium">
                {t("row.recallOpen")}
              </span>
            )}
            {report.details.responderUnit && (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold text-ink-700">
                {t("recall.responder", { unit: report.details.responderUnit })}
              </span>
            )}
            {/* Visible before the decision, not only inside the drawer. */}
            {report.details.discreetReporting && (
              <span
                title={t("drawer.discreetBanner")}
                className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-xs font-semibold text-priority-medium"
              >
                {t("row.discreet")}
              </span>
            )}
          </div>
          <p className="mb-2 line-clamp-2 text-sm text-ink-900">{report.summary}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
            {report.location && (
              <>
                <span>{report.location}</span>
                <span aria-hidden>·</span>
              </>
            )}
            <span>{now === null ? report.timestamp : timeAgo(report.details.submittedAt, now)}</span>
            <span aria-hidden>·</span>
            <time dateTime={report.details.submittedAt}>{manilaDateTime(report.details.submittedAt)}</time>
            <span aria-hidden>·</span>
            <ReporterChip reporter={report.reporter} />
          </div>
        </button>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          {/* The Recent validated tab renders this same row. A report already
              past review shows its routing state instead of review buttons
              that would only fail — and leaving no [data-validate-button]
              behind is also what keeps [Validate next] from landing on a
              decided report. */}
          {isReviewable(report.details.status) && (
            <>
              {/* Reject stands apart from Chat and Validate, after a divider:
                  it is the negative choice, and a hand reaching for Validate
                  should not find it next door. With CDRRMO dispatch on, an
                  Emergency report's Reject goes to validate_emergency_report(). */}
              <Button
                variant="danger"
                disabled={isPending || emergency.isPending}
                onClick={viaDispatch ? emergency.openReject : openReject}
              >
                {t("review.reject")}
              </Button>
              <span aria-hidden className="mx-2 hidden h-8 w-px bg-ink-100 sm:block" />
            </>
          )}
          {/* Chat stays on the row after validation: the conversation with
              the reporter goes on while agencies handle the report, and the
              staff-only Desk thread exists only once it has been routed.
              Hidden for a discreet report, as everywhere. */}
          {isChatOffered(REPORT_CHAT_LIVE, report.details.discreetReporting) && (
            <Button
              variant="secondary"
              disabled={isPending || busy}
              onClick={onOpenChat}
              aria-label={t("row.chatLabel", { id: report.id })}
            >
              {t("row.chat")}
            </Button>
          )}
          {isReviewable(report.details.status) ? (
            // data-validate-button: QueueClient's [Validate next] finds the
            // first one of these to scroll to and focus. With CDRRMO dispatch
            // on, an Emergency report's Validate opens the agency checklist
            // (it routes the report too).
            <Button
              variant="primary"
              data-validate-button
              data-report-id={report.id}
              disabled={isPending || emergency.isPending}
              onClick={viaDispatch ? emergency.openSend : validate}
            >
              {t("review.validate")}
            </Button>
          ) : (
            renderPastReview()
          )}
        </div>
        </div>
        <div className="flex items-center gap-2 border-t border-ink-100 pl-4 pr-2 sm:pl-5">
          <span className="shrink-0 text-xs text-ink-500">{t("row.reportId")}</span>
          <span className="min-w-0 truncate font-mono text-xs text-ink-500">{report.id}</span>
          <CopyIdButton id={report.id} />
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

      {emergency.isRejecting && (
        <ReasonPromptModal
          title={t("review.rejectTitle", { id: report.id })}
          description={t("review.rejectDescription")}
          confirmLabel={t("review.rejectConfirm")}
          busy={emergency.isPending}
          onCancel={emergency.cancelReject}
          onConfirm={emergency.reject}
        />
      )}

      <EmergencyValidationDialog report={report} emergency={emergency} />

      {routing.isConfirming && state.kind === "incomplete" && (
        <ConfirmModal
          {...routeConfirmCopy(report, state.plan, true, t)}
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
          recommended={state.recommended}
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
