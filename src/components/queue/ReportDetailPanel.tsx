"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { logReportView } from "@/app/actions/audit";
import { callAction } from "@/lib/callAction";
import { reportsAlreadyResolved } from "@/lib/utils";
import { useT, type Translate } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ReporterChip } from "@/components/ui/ReporterChip";
import { ReasonPromptModal } from "@/components/ui/ReasonPromptModal";
import { useDismissOnEscape } from "@/components/ui/useDismissOnEscape";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { isReviewable, statusLabel, useReportReview, type Verdict } from "./useReportReview";
import { LocationPreview } from "./LocationPreview";
import { useReportRouting } from "./useReportRouting";
import { useEmergencyValidation } from "./useEmergencyValidation";
import { useCdrrmoDispatch, usesDispatch } from "./CdrrmoDispatchContext";
import { AgencyPickerModal } from "./AgencyPickerModal";
import { useBarangayResolve } from "./useBarangayResolve";
import { ResolveNoteModal } from "./ResolveNoteModal";
import { ReportChatSection } from "./ReportChatSection";
import { ReportChatThreads } from "./ReportChatThreads";
import { REPORT_CHAT_LIVE, REPORT_CHAT_V2 } from "@/lib/features";
import { useNow } from "@/lib/useNow";
import { mayOfferRecall, recallPhase, windowMayBeOpen, type RecallState } from "@/lib/recall";
import { useRecall } from "./RecallContext";
import { RecallCountdown } from "./RecallCountdown";
import { isEscalated, recallStateOf, useRecallAnnouncement } from "./recallView";
import { isChatOffered } from "@/lib/reportChat";
import {
  agencyProgressLabel,
  canResolveAtBarangay,
  dispatchDefaultSet,
  dispatchPastReview,
  dispatchValidateCopy,
  everyAgencyReturned,
  isAutoRouted,
  isReturnedToBarangay,
  rerouteCopy,
  chooseCopy,
  routeConfirmCopy,
  routingState,
  splitRouting,
  type RoutingState,
} from "./routing";
import type { AgencyRouting, QueueReport, RoutingPlanEntry } from "@/types";

// Tailwind's md breakpoint: from here the chat and the details sit side by
// side; below it they are two tabs.
const DESKTOP_QUERY = "(min-width: 768px)";

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(DESKTOP_QUERY);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0">
      <p className="shrink-0 text-xs font-medium text-ink-500">{label}</p>
      <div className="text-right text-sm text-ink-900">{value}</div>
    </div>
  );
}

/**
 * Everything the barangay knows about one report, so an official can judge it
 * before deciding. The queue row shows category, priority, and a truncated
 * line; that is not enough to validate an emergency on.
 *
 * Free-text answers from the mobile app (severity, injuries, safety-net
 * confirmation) are printed verbatim. Their wording belongs to the app, and
 * restating them in this console's own words would misrepresent what the
 * resident actually said.
 */
export function ReportDetailPanel({
  report,
  onClose,
  onResolved,
  focusChat = false,
}: {
  report: QueueReport;
  onClose: () => void;
  onResolved: (verdict: Verdict) => void;
  // Opened from a row's [Chat] button: land on the thread's composer. The
  // header's Validate and Reject are the same ones the row has.
  focusChat?: boolean;
}) {
  const { isPending, isRejecting, openReject, cancelReject, validate, reject } = useReportReview(
    report.id,
    (verdict) => {
      onResolved(verdict);
      onClose();
    }
  );

  // Unlike a decision, routing leaves the pop-up open: the report stays in
  // this barangay's view afterwards, and the official can watch the agency
  // rows appear. QueueClient hands the drawer the freshest copy of the
  // report after each refresh, so this re-renders from the server's answer.
  const routing = useReportRouting(report.id);
  const routeState = routingState(report);
  // Resolving at the barangay closes the drawer, like a decision: the report
  // leaves every queue tab, and the copy held here would still offer the
  // buttons.
  const barangayResolve = useBarangayResolve(report.id, onClose);
  const mayResolve = canResolveAtBarangay(report, routeState);
  // CDRRMO dispatch (src/lib/cdrrmo-dispatch.ts): with the backend's switch
  // on, an Emergency report is validated or rejected through one function
  // that also routes it. Off, viaDispatch is false and the drawer is
  // exactly what it was. A decision closes the drawer, as a review does.
  const dispatch = useCdrrmoDispatch();
  const viaDispatch = usesDispatch(dispatch.active, report);
  const emergency = useEmergencyValidation(report.id, (verdict) => {
    onResolved(verdict);
    onClose();
  });
  const { showToast } = useToast();
  const t = useT();

  // RECALL-UI: the countdown and the Recall / Record recall button for a
  // report routed without a review here (src/lib/recall.ts). The dialog is
  // the queue page's (RecallContext); this only opens it. A clock once a
  // second only while a window could still be open (windowMayBeOpen).
  const recall = useRecall();
  const [recallFast, setRecallFast] = useState(() => report.details.status === "routed");
  const recallTick = useNow(recallFast ? 1000 : 30_000);
  useEffect(() => {
    setRecallFast(
      recallTick === null ||
        (report.details.status === "routed" && windowMayBeOpen(report.details.routing, recallTick))
    );
  }, [recallTick, report.details.status, report.details.routing]);
  const recallNow = recallTick ?? 0;
  const recallAt = recallTick === null ? ({ kind: "none" } as const) : recallStateOf(report, recallNow, recall.marks[report.id] ?? null);
  const recallOffer = mayOfferRecall(recallAt, recall.available);
  const recallOpenHere = recall.openFor === report.id;
  // Announces only a crossing seen while the drawer is open, never on mount.
  const recallAnnouncement = useRecallAnnouncement(
    recallTick === null ? [] : [{ id: report.id, phase: recallPhase(recallAt, recallNow) }]
  );

  // Disabled while a prompt is stacked on top — the reject reason or the
  // routing confirmation — so Escape backs out one layer at a time, and
  // while a write is in flight.
  // The expanded location map is one more layer on top.
  const [mapExpanded, setMapExpanded] = useState(false);
  // So is a chat photo or video at full size (REPORT_CHAT_MEDIA).
  const [chatViewerOpen, setChatViewerOpen] = useState(false);
  const stacked =
    isRejecting ||
    routing.isConfirming ||
    barangayResolve.isPrompting ||
    emergency.confirming !== null ||
    emergency.isRejecting ||
    mapExpanded ||
    chatViewerOpen ||
    recallOpenHere;
  const writing =
    isPending ||
    routing.isPending ||
    barangayResolve.isPending ||
    emergency.isPending ||
    (recallOpenHere && recall.isPending);
  useDismissOnEscape(onClose, !stacked && !writing);

  // The scrim and the close button honour the same rule as Escape: not while
  // a write is in flight. Closing mid-write unmounted the hook that owned the
  // result, so the official never saw whether it landed.
  const closeUnlessWriting = () => {
    if (!writing) onClose();
  };
  // Same stacking rule for Tab: whichever prompt is up owns focus.
  const dialogRef = useFocusTrap<HTMLElement>(!stacked);

  // The access trail is written here, on mount, rather than where the row is
  // clicked: opening this panel is the moment the reporter's own account of
  // the incident reaches an official's screen, and that is the event the DPA
  // trail exists to record.
  //
  // Exactly once per opening. log_report_view() appends a row on every call,
  // so React StrictMode's deliberate double-run of effects in development
  // would write the view twice — the ref survives that double-run and stops
  // the second. Closing and reopening the drawer unmounts the component, so a
  // genuine second look does get its own row.
  //
  // Never blocks the read: an official must not be locked out of a report
  // because the logger is down. A failure isn't hidden either — an access
  // trail with a silent gap is worse than one with a visible complaint.
  const loggedReportId = useRef<string | null>(null);
  useEffect(() => {
    if (loggedReportId.current === report.id) return;
    loggedReportId.current = report.id;
    // callAction: a rejected promise here used to be an unhandled rejection —
    // a missed access-log entry with no trace on screen at all.
    void callAction(() => logReportView(report.id)).then((result) => {
      const outcome = result ?? "failed";
      if (outcome === "logged") return;
      showToast(t(outcome === "session-expired" ? "drawer.sessionExpired" : "drawer.notLogged"), "danger");
    });
    // Switching language changes t and re-runs this effect; the ref above
    // turns that rerun into a no-op, so the view is still logged once.
  }, [report.id, showToast, t]);

  const d = report.details;
  const chatOffered = isChatOffered(REPORT_CHAT_LIVE, d.discreetReporting);

  // Below md the two columns become two tabs. Only the visible one is
  // mounted: the chat marks the reporter's messages read when it appears, and
  // that must mean an official can see them. A report that is still to be
  // judged opens on Details, since that is what the decision rests on; the
  // row's [Chat] button and every decided report open on Chat.
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState<"chat" | "details">(
    focusChat || !isReviewable(d.status) ? "chat" : "details"
  );
  const showChat = chatOffered && (isDesktop || tab === "chat");
  const showDetails = isDesktop || !chatOffered || tab === "details";

  // The same actions the drawer's footer held, now at the top right: the
  // review pair before a decision, routing and resolving after it. A decided
  // report can't be reviewed again (review_report() refuses it with 42501), so
  // review buttons never show for one.
  // An Emergency report past review while CDRRMO dispatch is on: what the
  // desk may still do with it (see dispatchPastReview). null when off.
  const dispatchNext = viaDispatch && !isReviewable(d.status) ? dispatchPastReview(report, routeState) : null;
  const actions = isReviewable(d.status) && viaDispatch ? (
    <>
      <Button variant="primary" size="sm" disabled={writing} onClick={emergency.openSend}>
        {t("review.validate")}
      </Button>
      <Button variant="secondary" size="sm" disabled={writing} onClick={emergency.openReject}>
        {t("review.reject")}
      </Button>
    </>
  ) : dispatchNext === "send" ? (
    // Validated the old way and never sent anywhere: validating routes it.
    <Button variant="primary" size="sm" disabled={writing} onClick={emergency.openSend}>
      {t("cdrrmo.validateConfirm")}
    </Button>
  ) : dispatchNext === "record" ? (
    // Already with its agencies, without this barangay's validation.
    <Button variant="primary" size="sm" disabled={writing} onClick={emergency.openRecord}>
      {t("review.validate")}
    </Button>
  ) : dispatchNext === "partial" || dispatchNext === "handedBack" ? (
    <p className="max-w-xs text-xs text-ink-500">
      {t(dispatchNext === "partial" ? "cdrrmo.legacyPartial" : "cdrrmo.handedBack")}
    </p>
  ) : isReviewable(d.status) ? (
    <>
      <Button variant="primary" size="sm" disabled={isPending} onClick={validate}>
        {t("review.validate")}
      </Button>
      <Button variant="secondary" size="sm" disabled={isPending} onClick={openReject}>
        {t("review.reject")}
      </Button>
    </>
  ) : routeState.kind === "choose" && routeState.options && routeState.options.length > 0 ? (
    // The official ticks the agencies; the category's are marked Recommended.
    <>
      <Button variant="primary" size="sm" disabled={writing} onClick={routing.openConfirm}>
        {t("routing.routeToAgency")}
      </Button>
      {mayResolve && (
        <Button variant="secondary" size="sm" disabled={writing} onClick={barangayResolve.openPrompt}>
          {t("resolve.button")}
        </Button>
      )}
    </>
  ) : routeState.kind === "incomplete" ? (
    <>
      <Button variant="primary" size="sm" disabled={writing} onClick={routing.openConfirm}>
        {t("routing.finish")}
      </Button>
      {mayResolve && (
        <Button variant="secondary" size="sm" disabled={writing} onClick={barangayResolve.openPrompt}>
          {t("resolve.button")}
        </Button>
      )}
    </>
  ) : mayResolve ? (
    // The agency list didn't load: resolving is the one action left.
    <Button variant="primary" size="sm" disabled={writing} onClick={barangayResolve.openPrompt}>
      {t("resolve.button")}
    </Button>
  ) : routeState.kind === "returned" && routeState.options && routeState.options.length > 0 ? (
    <Button variant="primary" size="sm" disabled={routing.isPending} onClick={routing.openConfirm}>
      {t("routing.routeElsewhere")}
    </Button>
  ) : (
    <p className="max-w-xs text-xs text-ink-500">{footerNote(routeState, t)}</p>
  );

  const details = (
    <>
      {/* Routed, then rejected by CDRRMO (CDRRMO dispatch). Said first: the
          agency rows below read differently once it is. */}
      {routeState.kind === "rejectedByCdrrmo" && (
        <p
          role="note"
          className="mb-4 rounded-md border border-priority-medium/30 bg-priority-mediumBg px-3 py-2 text-sm text-priority-medium"
        >
          <span className="font-semibold">{t("cdrrmo.rejectedByCdrrmo")}.</span> {t("cdrrmo.rejectedByCdrrmoBody")}
        </p>
      )}
      {/* First thing in the details, above everything the official reads
          before acting: discreet reporting is always on for domestic
          violence, where a call or a text can reach the wrong person. The
          backend owner asked for this wording (2026-09-29). */}
      {d.discreetReporting && (
        <p
          role="note"
          className="mb-4 flex items-start gap-2 rounded-md border border-priority-medium/30 bg-priority-mediumBg px-3 py-2 text-sm font-semibold text-priority-medium"
        >
          <Icon name="no-contact" className="mt-0.5" />
          {t("drawer.discreetBanner")}
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={report.priority} />
        <span className="text-xs text-ink-500">{t(`drawer.tier.${d.entryTier}`)}</span>
        {isReviewable(d.status) && reportsAlreadyResolved(d.safetyNetConfirmation) && (
          <span className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-[11px] font-semibold text-priority-medium">
            {t("row.alreadyResolved")}
          </span>
        )}
      </div>

      <p className="mb-5 whitespace-pre-wrap text-sm text-ink-900">
        {d.description ?? <span className="text-ink-500">{t("drawer.noDescription")}</span>}
      </p>

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {t("drawer.section.reporterSaid")}
      </p>
      <div className="mb-5">
        <Row label={t("drawer.severity")} value={d.severitySelfRating ?? <NotProvided />} />
        <Row label={t("drawer.anyoneHurt")} value={d.anyoneHurt ?? <NotProvided />} />
        <Row
          label={t("drawer.ongoing")}
          value={d.isOngoing === null ? <NotProvided /> : t(d.isOngoing ? "drawer.yes" : "drawer.no")}
        />
        <Row label={t("drawer.safetyNet")} value={d.safetyNetConfirmation ?? <NotProvided />} />
        <Row label={t("drawer.attachments")} value={attachmentSummary(d.hasPhoto, d.hasVideo, t)} />
      </div>

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {t("drawer.section.triage")}
      </p>
      <div className="mb-5">
        <Row
          label={t("drawer.priority")}
          value={
            report.priority === null
              ? <span className="text-ink-500">{t("drawer.notScoredYet")}</span>
              : d.priorityScore === null
                ? report.priority
                : t("drawer.score", { priority: report.priority, score: d.priorityScore })
          }
        />
        {/* Only Other-reports carry one; an empty row on every emergency
            would say nothing. */}
        {d.subCategory && <Row label={t("drawer.subCategory")} value={d.subCategory} />}
        <Row label={t("drawer.confidence")} value={d.confidenceBand ?? <NotProvided />} />
        <Row
          label={t("drawer.status")}
          value={routeState.kind === "rejectedByCdrrmo" ? t("cdrrmo.rejectedByCdrrmo") : statusLabel(d.status, t)}
        />
        {d.clusterId && (
          <Row label={t("drawer.cluster")} value={<span className="font-mono text-xs">{d.clusterId}</span>} />
        )}
      </div>

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {t("drawer.section.submission")}
      </p>
      <div>
        <Row label={t("field.reporter")} value={<ReporterChip reporter={report.reporter} />} />
        <Row label={t("drawer.submitted")} value={formatTimestamp(d.submittedAt)} />
      </div>

      {/* A map, not an address: incident_reports stores a point (geom),
          and nothing decodes it into street text. Never shown for an
          identity-withheld or discreet report. */}
      <p className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {t("drawer.section.location")}
      </p>
      <LocationPreview position={d.position} onExpandedChange={setMapExpanded} />

      {/* Before the decision: where this report would go once validated.
          Read-only — routing stays a separate, confirmed step. */}
      {isReviewable(d.status) && (
        <>
          <p className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            {t("drawer.section.routing")}
          </p>
          {viaDispatch && !everyAgencyReturned(d.routing) ? (
            <DispatchPreview text={dispatchDefaultSet(d.routingPlan, dispatch.cdrrmoAgency, t)} />
          ) : (
            <RoutingPreview plan={d.routingPlan} routing={d.routing} />
          )}
        </>
      )}

      {routeState.kind !== "none" && (
        <>
          <p className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
            {t("drawer.section.routing")}
          </p>
          <RoutingSection
            state={routeState}
            viaDispatch={viaDispatch}
            escalated={isEscalated(report)}
            responderUnit={d.responderUnit ?? null}
            recallAt={recallAt}
            now={recallNow}
          />
          <p aria-live="polite" className="sr-only">
            {recallAnnouncement}
          </p>
        </>
      )}
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center md:items-center md:p-6">
      <button
        aria-label={t("drawer.close")}
        className="absolute inset-0 bg-ink-900/40 motion-safe:animate-scrimIn"
        onClick={closeUnlessWriting}
      />

      <aside
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-detail-title"
        // A centred pop-up, not an edge drawer: the report and its thread sit
        // side by side the way a web messenger does. Full screen below md.
        className="relative flex h-full max-h-full w-full flex-col overflow-hidden bg-white shadow-panel focus:outline-none md:h-[85vh] md:max-w-[1200px] md:rounded-card"
      >
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-ink-100 bg-white px-4 py-3 md:px-5">
          <div className="min-w-0">
            <p id="report-detail-title" className="text-sm font-semibold text-ink-900">
              {report.category}
            </p>
            <p className="truncate font-mono text-xs text-ink-500">{report.id}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {recallOffer && (
              <Button
                variant={recallOffer === "recall" ? "danger" : "secondary"}
                size="sm"
                disabled={writing || recall.isPending}
                onClick={() => recall.open(report.id)}
                aria-label={t(recallOffer === "recall" ? "recall.buttonFor" : "recall.recordFor", { id: report.id })}
              >
                {t(recallOffer === "recall" ? "recall.button" : "recall.record")}
              </Button>
            )}
            {actions}
            <Button variant="ghost" size="sm" className="min-w-11" onClick={closeUnlessWriting} aria-label={t("common.close")}>
              <Icon name="close" />
            </Button>
          </div>
        </header>

        {chatOffered && (
          <div role="tablist" aria-label={t("popup.tabsLabel")} className="flex border-b border-ink-100 md:hidden">
            {(["chat", "details"] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`min-h-11 flex-1 text-sm font-medium ${
                  tab === id ? "border-b-2 border-brand-500 text-ink-900" : "text-ink-500"
                }`}
              >
                {t(id === "chat" ? "popup.tab.chat" : "popup.tab.details")}
              </button>
            ))}
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          {showChat && (
            <div className="flex min-w-0 flex-1 flex-col">
              {REPORT_CHAT_V2 ? (
                <ReportChatThreads
                  reportId={report.id}
                  routedToAgency={report.details.routing.length > 0}
                  focusComposer={focusChat}
                  onViewerChange={setChatViewerOpen}
                />
              ) : (
                <ReportChatSection reportId={report.id} focusComposer={focusChat} />
              )}
            </div>
          )}
          {showDetails && (
            <div
              className={
                chatOffered
                  ? "min-w-0 flex-1 overflow-y-auto px-5 py-4 md:w-[380px] md:flex-none md:border-l md:border-ink-100"
                  : "min-w-0 flex-1 overflow-y-auto px-5 py-4"
              }
            >
              {/* No thread exists for a discreet report (the backend refuses
                  it), and none is offered while REPORT_CHAT_LIVE is off:
                  details alone, kept to a readable width. */}
              <div className={chatOffered ? "" : "mx-auto max-w-2xl"}>{details}</div>
            </div>
          )}
        </div>
      </aside>

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

      {emergency.confirming && (
        <ConfirmModal
          {...dispatchValidateCopy(report, dispatch.cdrrmoAgency, emergency.confirming, t)}
          busy={emergency.isPending}
          onCancel={emergency.cancelConfirm}
          onConfirm={emergency.validate}
        />
      )}

      {routing.isConfirming && routeState.kind === "incomplete" && (
        <ConfirmModal
          {...routeConfirmCopy(report, routeState.plan, true, t)}
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

      {routing.isConfirming &&
        routeState.kind === "choose" &&
        routeState.options &&
        routeState.options.length > 0 && (
          <AgencyPickerModal
            {...chooseCopy(report, routeState, t)}
            options={routeState.options}
            recommended={routeState.recommended}
            busy={routing.isPending}
            onCancel={routing.cancelConfirm}
            onConfirm={routing.routeTo}
          />
        )}

      {routing.isConfirming &&
        routeState.kind === "returned" &&
        routeState.options &&
        routeState.options.length > 0 && (
          <AgencyPickerModal
            {...rerouteCopy(report, routeState, t)}
            options={routeState.options}
            busy={routing.isPending}
            onCancel={routing.cancelConfirm}
            onConfirm={routing.reroute}
          />
        )}
    </div>
  );
}

function footerNote(state: RoutingState, t: Translate): string {
  switch (state.kind) {
    case "choose":
      // Shown only when there is no button and no resolve: the agency list
      // didn't load, or names no agency at all.
      return t(state.options === null ? "drawer.footer.optionsUnavailable" : "drawer.footer.noMapping");
    case "returned":
      // Shown only when there is no button: the agency list didn't load, or
      // every agency has already had the report.
      return t(state.options === null ? "drawer.footer.optionsUnavailable" : "drawer.footer.noOtherAgency");
    case "downstream":
      // Every agency sent it back as out of scope: it is the barangay's
      // again, and saying the agencies own it would be false.
      return t(isReturnedToBarangay(state) ? "drawer.footer.returned" : "drawer.footer.downstream");
    case "rejectedByCdrrmo":
      return t("cdrrmo.rejectedByCdrrmo");
    default:
      return t("drawer.footer.reviewed");
  }
}

/**
 * What the drawer shows about agencies. Before routing: where it would go.
 * After: each agency and how far it has got, read from agency_routing's
 * timestamps (there is no status column there). The desk can't change any
 * of it — agency roles do.
 *
 * Agencies that sent the report back before it was routed elsewhere are
 * listed apart, under [Returned earlier], so the agencies holding it now
 * aren't read as the ones that returned it.
 *
 * Finishing a part-way routing keeps exactly the agencies already holding
 * it (routeReport), so the category mapping is never where finishing sends
 * it.
 */
function RoutingSection({
  state,
  viaDispatch,
  escalated = false,
  responderUnit = null,
  recallAt = { kind: "none" },
  now = 0,
}: {
  state: ReturnType<typeof routingState>;
  // An Emergency report while CDRRMO dispatch is on: CDRRMO dispatch routes
  // it, so nothing here says where finishing or routing would send it.
  viaDispatch: boolean;
  // RECALL-UI: the timer sent it; the responder unit behind it (the unit
  // only); where its recall window stands, and the clock that reads it.
  escalated?: boolean;
  responderUnit?: string | null;
  recallAt?: RecallState;
  now?: number;
}) {
  const t = useT();
  if (viaDispatch) {
    if (state.kind === "choose") {
      return <p className="text-sm text-ink-700">{t("cdrrmo.pastReview")}</p>;
    }
    if (state.kind === "incomplete" || state.kind === "returned") {
      const { current, earlier } = splitRouting(state.routing);
      return (
        <div>
          <p className="mb-2 text-xs text-priority-medium">
            {t(state.kind === "returned" ? "cdrrmo.handedBack" : "cdrrmo.legacyPartial")}
          </p>
          <AgencyList rows={current} />
          <EarlierList rows={earlier} />
        </div>
      );
    }
  }
  switch (state.kind) {
    case "choose":
      // Nothing is decided yet: the mapping is a recommendation, not where
      // the report will go.
      return <ChooseNote plan={state.plan} body={t("drawer.choose.body")} />;
    case "incomplete": {
      const { current, earlier } = splitRouting(state.routing);
      return (
        <div>
          <p className="mb-2 text-xs text-priority-medium">
            {t("drawer.incomplete")}
          </p>
          <AgencyList rows={current} />
          <EarlierList rows={earlier} />
          {/* Finishing keeps the agencies above; it adds none. */}
          <p className="text-xs text-ink-700">{t("drawer.plan.finishingHeld")}</p>
        </div>
      );
    }
    case "returned": {
      const { current, earlier } = splitRouting(state.routing);
      return (
        <div>
          <p className="mb-2 text-xs text-priority-medium">{t("drawer.returned")}</p>
          <AgencyList rows={current} />
          <EarlierList rows={earlier} />
        </div>
      );
    }
    case "downstream": {
      if (state.routing.length === 0) {
        return <p className="text-sm text-ink-500">{t("drawer.downstreamMissing")}</p>;
      }
      const { current, earlier } = splitRouting(state.routing);
      return (
        <div>
          {isAutoRouted(state) && (
            <p className="mb-2 text-xs text-ink-500">{t(escalated ? "drawer.escalated" : "drawer.autoRouted")}</p>
          )}
          {responderUnit && <p className="mb-2 text-xs text-ink-700">{t("recall.responder", { unit: responderUnit })}</p>}
          {recallAt.kind === "open" ? (
            <RecallCountdown endsAt={recallAt.endsAt} now={now} className="mb-2 block" />
          ) : recallAt.kind === "dispatched" ? (
            <p className="mb-2 text-xs text-ink-700">
              {t("recall.dispatchedNote", { agency: recallAt.agency ?? t("recall.anAgency") })}
            </p>
          ) : recallAt.kind === "closed" ? (
            <p className="mb-2 text-xs text-ink-700">
              {t(recallAt.endsAt === null ? "recall.noWindow" : "recall.windowClosed")}
            </p>
          ) : null}
          <AgencyList rows={current} />
          <EarlierList rows={earlier} />
        </div>
      );
    }
    case "rejectedByCdrrmo": {
      // Each agency's row says how it ended: closed with the rejection, or
      // still open at an agency that was already responding.
      const { current, earlier } = splitRouting(state.routing);
      return (
        <div>
          <AgencyList rows={current} />
          <EarlierList rows={earlier} />
        </div>
      );
    }
    case "none":
      return null;
  }
}

/**
 * Where CDRRMO dispatch will send an Emergency report once validated: the
 * category's mapped agencies plus CDRRMO, read only. The database decides
 * the final list; the barangay can't change it (backend spec 3.4, owner
 * answers a-c).
 */
function DispatchPreview({ text }: { text: string }) {
  const t = useT();
  return (
    <div>
      <p className="mb-1 text-xs text-ink-500">{t("cdrrmo.preview")}:</p>
      <p className="mb-1 text-sm text-ink-900">{text}</p>
      <p className="text-[11px] text-ink-500">{t("cdrrmo.previewNote")}</p>
    </div>
  );
}

/**
 * Where routing would send a report that hasn't been decided yet, from the
 * same category mapping routeReport uses — the paper's [you're confirming,
 * not choosing] (p.186). Nothing is sent from here: an official still
 * validates, then routes with its own confirmation.
 *
 * The exception is a report back for review after an automatic routing that
 * every agency sent back. Its mapping names exactly the agencies that
 * returned it, so there is nothing to preview: the drawer lists them, and
 * says the next agency is chosen after validation.
 */
function RoutingPreview({ plan, routing }: { plan: RoutingPlanEntry[] | null; routing: AgencyRouting[] }) {
  const t = useT();
  if (everyAgencyReturned(routing)) {
    const { current, earlier } = splitRouting(routing);
    return (
      <div>
        <p className="mb-2 text-xs text-priority-medium">{t("drawer.returnedPending")}</p>
        <AgencyList rows={current} />
        <EarlierList rows={earlier} />
      </div>
    );
  }
  // After validation the official ticks the agencies; the mapping is only a
  // recommendation.
  return <ChooseNote plan={plan} body={t("drawer.preview.choose")} />;
}

/**
 * The agency list's recommendation, in the drawer. A category that maps to
 * no agency says none is recommended; a mapping that couldn't be loaded
 * says that instead of claiming there is none.
 */
function ChooseNote({ plan, body }: { plan: RoutingPlanEntry[] | null; body: string }) {
  const t = useT();
  return (
    <div>
      <p className="mb-2 text-xs text-ink-700">{body}</p>
      {plan === null ? (
        <p className="text-xs text-ink-500">{t("drawer.unavailable")}</p>
      ) : plan.length > 0 ? (
        <PlanList plan={plan} lead={t("drawer.choose.recommended")} />
      ) : (
        <p className="text-xs text-ink-700">{t("drawer.choose.noRecommendation")}</p>
      )}
    </div>
  );
}

function PlanList({ plan, lead }: { plan: RoutingPlanEntry[]; lead: string }) {
  const t = useT();
  return (
    <div>
      <p className="mb-1 text-xs text-ink-500">{lead}:</p>
      <ul className="text-sm text-ink-900">
        {plan.map((p, i) => (
          <li key={`${i}-${p.agencyName}`} className="py-0.5">
            {p.agencyName}
            {p.isPrimary && <span className="ml-1.5 text-xs text-ink-500">{t("routing.lead")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Not the shared Row: that keeps its label from shrinking, which suits short
// field names, while agency names run long enough to push the value off the
// drawer.
function AgencyList({ rows }: { rows: AgencyRouting[] }) {
  const t = useT();
  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={`${i}-${r.agencyName}`}
          className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0"
        >
          <p className="min-w-0 text-sm text-ink-900">
            {r.agencyName}
            {r.isPrimary && <span className="ml-1.5 text-xs text-ink-500">{t("routing.lead")}</span>}
          </p>
          <p className="shrink-0 text-right text-sm text-ink-900">
            {agencyProgressLabel(r, t)}
            <span className="block text-[11px] text-ink-500">{stageTime(r, t)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

function EarlierList({ rows }: { rows: AgencyRouting[] }) {
  const t = useT();
  if (rows.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs text-ink-500">{t("drawer.returnedEarlier")}:</p>
      <AgencyList rows={rows} />
    </div>
  );
}

// When the agency reached the stage it's shown at, so the desk can see how
// long an acknowledgement has taken.
function stageTime(r: AgencyRouting, t: Translate): string {
  if (r.resolvedAt) return t("drawer.stage.closed", { time: formatTimestamp(r.resolvedAt) });
  if (r.inProgressAt) return t("drawer.stage.inProgress", { time: formatTimestamp(r.inProgressAt) });
  if (r.acknowledgedAt) return t("drawer.stage.acknowledged", { time: formatTimestamp(r.acknowledgedAt) });
  if (r.routedAt) return t("drawer.stage.routed", { time: formatTimestamp(r.routedAt) });
  return "";
}

function NotProvided() {
  const t = useT();
  return <span className="text-ink-500">{t("drawer.notProvided")}</span>;
}

function attachmentSummary(hasPhoto: boolean, hasVideo: boolean, t: Translate): string {
  if (hasPhoto && hasVideo) return t("drawer.attach.both");
  if (hasPhoto) return t("drawer.attach.photo");
  if (hasVideo) return t("drawer.attach.video");
  // Not "None" — a description can arrive from the app as the literal string
  // "None", and the two sat three rows apart meaning different things.
  return t("drawer.attach.none");
}

// Pinned to Manila even though this runs in the browser: Validation History
// formats the same instants on the server in Asia/Manila, and an official
// whose laptop is set to another zone would otherwise see the two disagree.
function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
