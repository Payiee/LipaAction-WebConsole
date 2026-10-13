"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { validateEmergencyReport } from "@/app/actions/cdrrmoDispatch";
import { callAction } from "@/lib/callAction";
import { isEmergencyDecisionDone, MOVED_REFUSALS, type EmergencyValidationOutcome } from "@/lib/cdrrmo-dispatch";
import { useT } from "@/lib/i18n";
import { useCdrrmoDispatch } from "./CdrrmoDispatchContext";
import type { Verdict } from "./useReportReview";

/**
 * Which confirmation Validate opens: "send" routes a report no agency holds
 * yet; "record" records the barangay's validation of a report that is
 * already with its agencies (auto-routed, or routed after CDRRMO validated).
 */
export type DispatchConfirm = "send" | "record";

// Answers worded as information, not as a failure: the write may well have
// happened, and the queue has been refreshed to show it.
const NEUTRAL: EmergencyValidationOutcome[] = ["validated_no_open_agency", "overridden", "saved-unknown", "unknown", "disabled"];

/**
 * The Validate / Reject flow for an Emergency report while CDRRMO dispatch
 * is on, shared by the queue row and the detail drawer like useReportReview.
 * Validate opens a confirmation (it routes, and can't be undone here);
 * Reject asks for a reason, as today. Both go to validate_emergency_report().
 *
 * The reject prompt stays open, with the reason in it, until the answer
 * arrives. It closes once the report is decided or has moved; it stays open
 * only where retrying makes sense, so nothing typed is lost. Every
 * answer is worded from its code (cdrrmo.outcome.*). A refusal that says
 * the switch is off turns this page back to the usual flow.
 */
export function useEmergencyValidation(reportId: string, onResolved: (verdict: Verdict) => void) {
  const { showToast } = useToast();
  const t = useT();
  const dispatch = useCdrrmoDispatch();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState<DispatchConfirm | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  function answer(outcome: EmergencyValidationOutcome) {
    const done = isEmergencyDecisionDone(outcome);
    // The report moved (or the switch is off): the prompt has nothing left
    // to decide, and the server action has refreshed the queue. Kept open,
    // with the reason, only for reason_required, transport failures and
    // unknown answers.
    if (done || outcome === "disabled" || MOVED_REFUSALS.includes(outcome)) setIsRejecting(false);
    if (outcome === "disabled") dispatch.setActive(false);
    if (done && outcome !== "overridden") onResolved(outcome === "rejected" ? "rejected" : "validated");
    const tone = NEUTRAL.includes(outcome)
      ? "info"
      : outcome === "rejected"
        ? "danger"
        : done
          ? "success"
          : "danger";
    showToast(t(`cdrrmo.outcome.${outcome}`, { id: reportId }), tone);
  }

  function run(decision: Verdict, reason?: string) {
    startTransition(async () => {
      const result = await callAction(() => validateEmergencyReport(reportId, decision, reason));
      setConfirming(null);
      if (result === null) {
        // Validating routes the report: never guess which way it went.
        showToast(t("common.noAnswer"), "danger");
        return;
      }
      answer(result.outcome);
    });
  }

  return {
    isPending,
    confirming,
    isRejecting,
    openSend: () => setConfirming("send"),
    openRecord: () => setConfirming("record"),
    cancelConfirm: () => setConfirming(null),
    openReject: () => setIsRejecting(true),
    cancelReject: () => setIsRejecting(false),
    validate: () => run("validated"),
    reject: (reason: string) => run("rejected", reason),
  };
}
