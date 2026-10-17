"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDismissOnEscape } from "@/components/ui/useDismissOnEscape";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { useT } from "@/lib/i18n";
import { useNow } from "@/lib/useNow";
import {
  RECALL_REASON_MAX,
  RECALL_SEVERITIES,
  recallDialogCopy,
  recallReasonLength,
  timerNoticeApplies,
  trimRecallReason,
  type RecallSeverity,
} from "@/lib/recall";
import { RecallCountdown } from "./RecallCountdown";
import { openAgencyNames, recallStateOf, type RecallMark } from "./recallView";
import type { QueueReport } from "@/types";

/**
 * The confirm step for Recall and Record recall (RECALL-UI spec section 6).
 * One instance, owned by the queue page and keyed by report id, so it
 * outlives the strip item that opened it: when the window runs out while it
 * is open, or a refresh shows a unit was sent, it keeps the chosen severity
 * and the typed reason and switches its wording in place. The wording always
 * follows the report's state at render time, so a click at 0:00 is never
 * labelled Recall; the server still decides.
 *
 * `report` is the freshest copy the page holds, null once it has left every
 * list (someone recalled it, every agency closed it).
 */
export function RecallModal({
  reportId,
  report,
  mark,
  busy,
  onCancel,
  onConfirm,
}: {
  reportId: string;
  report: QueueReport | null;
  mark: RecallMark | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (severity: RecallSeverity, reason: string) => void;
}) {
  const t = useT();
  // One clock for this dialog, once a second (spec section 5). Before it
  // mounts (null), Date.now() at render is the same reading.
  const tick = useNow(1000);
  const now = tick ?? Date.now();
  const [severity, setSeverity] = useState<RecallSeverity | null>(null);
  const [reason, setReason] = useState("");
  useDismissOnEscape(onCancel, !busy);
  const dialogRef = useFocusTrap<HTMLFormElement>();

  const state = recallStateOf(report, now, mark);
  const trimmedLength = recallReasonLength(trimRecallReason(reason));
  const canSubmit =
    !busy && state.kind !== "none" && severity !== null && trimmedLength > 0 && trimmedLength <= RECALL_REASON_MAX;

  // A closed window is this browser's reading only: its copy never claims the
  // outcome (src/lib/recall.ts recallDialogCopy). Any recall of a Critical
  // report ends the escalation timer's safety net (timerNoticeApplies).
  let description: string;
  switch (recallDialogCopy(state)) {
    case "open":
      description = t("recall.desc.open", { agencies: report ? openAgencyNames(report) : "" });
      break;
    case "dispatched":
      description = t("recall.desc.dispatched", {
        agency: (state.kind === "dispatched" && state.agency) || t("recall.anAgency"),
      });
      break;
    case "closedAt":
      description = t("recall.desc.closed", {
        minutes: state.kind === "closed" && state.endsAt !== null ? Math.max(0, Math.floor((now - state.endsAt) / 60_000)) : 0,
      });
      break;
    case "mayHaveClosed":
      description = t("recall.desc.mayHaveClosed");
      break;
    default:
      description = t("recall.desc.none");
  }
  if (
    report &&
    timerNoticeApplies({ priority: report.priority, entryTier: report.details.entryTier, kind: state.kind, mark })
  ) {
    description += ` ${t("recall.desc.timer")}`;
  }
  const confirmLabel = state.kind === "open" ? t("recall.button") : t("recall.record");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit && severity) onConfirm(severity, trimRecallReason(reason));
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4">
      <button
        type="button"
        aria-label={t("common.cancel")}
        className="absolute inset-0 bg-ink-900/40"
        onClick={onCancel}
        disabled={busy}
      />
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recall-title"
        aria-describedby="recall-description"
        className="relative max-h-full w-full max-w-md overflow-y-auto rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none"
      >
        <p id="recall-title" className="mb-1 text-sm font-semibold text-ink-900">
          {t("recall.title", { id: reportId })}
        </p>
        <p id="recall-description" className="mb-2 text-xs text-ink-700">
          {description}
        </p>
        {state.kind === "open" && <RecallCountdown endsAt={state.endsAt} now={now} className="mb-3 block" />}

        <fieldset className="mb-3" disabled={busy}>
          <legend className="mb-1 text-xs font-medium text-ink-700">{t("recall.severityLegend")}</legend>
          {RECALL_SEVERITIES.map((value) => (
            <label key={value} className="flex min-h-11 items-center gap-2 text-sm text-ink-900">
              <input
                type="radio"
                name="recall-severity"
                value={value}
                checked={severity === value}
                onChange={() => setSeverity(value)}
                className="h-4 w-4 accent-brand-500"
              />
              {t(`recall.severity.${value}`)}
            </label>
          ))}
        </fieldset>

        <label className="mb-1 block text-xs font-medium text-ink-700" htmlFor="recall-reason">
          {t("recall.reasonLabel")}
        </label>
        <textarea
          id="recall-reason"
          required
          maxLength={RECALL_REASON_MAX}
          rows={3}
          value={reason}
          disabled={busy}
          onChange={(e) => setReason(e.target.value)}
          aria-describedby="recall-reason-count"
          className="w-full resize-none rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
        />
        <p id="recall-reason-count" className="mb-4 text-right text-xs text-ink-500">
          {t("recall.reasonCount", { n: trimmedLength })}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant={state.kind === "open" ? "danger" : "secondary"} size="sm" type="submit" disabled={!canSubmit}>
            {busy ? t("common.saving") : confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
