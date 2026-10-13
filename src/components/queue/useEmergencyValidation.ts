"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { validateEmergencyReport } from "@/app/actions/cdrrmoDispatch";
import { callAction } from "@/lib/callAction";
import { isEmergencyDecisionDone, type EmergencyValidationOutcome } from "@/lib/cdrrmo-dispatch";
import { useT } from "@/lib/i18n";
import { useCdrrmoDispatch } from "./CdrrmoDispatchContext";
import type { Verdict } from "./useReportReview";

/**
 * The Validate / Reject flow for an Emergency report while CDRRMO dispatch
 * is on, shared by the queue row and the detail drawer like useReportReview.
 * Validate opens a confirmation (it routes, and can't be undone here);
 * Reject asks for a reason, as today. Both go to validate_emergency_report().
 *
 * Every answer is worded from its code (cdrrmo.outcome.*). A refusal that
 * says the switch is off turns this page back to the usual flow.
 */
export function useEmergencyValidation(reportId: string, onResolved: (verdict: Verdict) => void) {
  const { showToast } = useToast();
  const t = useT();
  const dispatch = useCdrrmoDispatch();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  function report(outcome: EmergencyValidationOutcome) {
    if (isEmergencyDecisionDone(outcome)) {
      onResolved(outcome === "rejected" ? "rejected" : "validated");
      const tone = outcome === "validated" ? "success" : outcome === "rejected" ? "danger" : "info";
      showToast(t(`cdrrmo.outcome.${outcome}`, { id: reportId }), tone);
      return;
    }
    if (outcome === "disabled") dispatch.setActive(false);
    showToast(t(`cdrrmo.outcome.${outcome}`), outcome === "disabled" ? "info" : "danger");
  }

  function run(decision: Verdict, reason?: string) {
    startTransition(async () => {
      const result = await callAction(() => validateEmergencyReport(reportId, decision, reason));
      setIsConfirming(false);
      if (result === null) {
        // Validating routes the report: never guess which way it went.
        showToast(t("common.noAnswer"), "danger");
        return;
      }
      report(result.outcome);
    });
  }

  return {
    isPending,
    isConfirming,
    isRejecting,
    openConfirm: () => setIsConfirming(true),
    cancelConfirm: () => setIsConfirming(false),
    openReject: () => setIsRejecting(true),
    cancelReject: () => setIsRejecting(false),
    validate: () => run("validated"),
    reject: (reason: string) => {
      setIsRejecting(false);
      run("rejected", reason);
    },
  };
}
