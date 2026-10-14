"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { updateReportStatus } from "@/app/actions/reports";
import { callAction } from "@/lib/callAction";
import { useT, type Translate } from "@/lib/i18n";
import { useCdrrmoDispatch } from "./CdrrmoDispatchContext";

export type Verdict = "validated" | "rejected";

/**
 * The statuses review_report() will still accept a decision on. Anything past
 * these has already been reviewed (or routed onward), and the RPC rejects it
 * with 42501.
 *
 * Kept in step with PENDING_STATUSES in src/lib/data/queue.ts. The Recent
 * validated tab renders the same ReportRow as the working tabs, so without
 * this check an official is offered Validate and Reject on a report that was
 * decided days ago — the click would simply fail.
 */
const REVIEWABLE_STATUSES = ["pending_priority", "prioritized"];

export function isReviewable(status: string): boolean {
  return REVIEWABLE_STATUSES.includes(status);
}

// incident_reports.status is free text from the backend; these are the values
// seen so far. Anything unrecognised falls through as-is rather than being
// hidden or guessed at. Shared so the row and the drawer can't show the same
// report as [Validated] in one place and [validated] in the other. Each known
// value has a message key, status.<value>.
const KNOWN_STATUSES = ["pending_priority", "prioritized", "validated", "rejected", "routed", "resolved"] as const;

function isKnownStatus(status: string): status is (typeof KNOWN_STATUSES)[number] {
  return (KNOWN_STATUSES as readonly string[]).includes(status);
}

export function statusLabel(status: string, t: Translate): string {
  return isKnownStatus(status) ? t(`status.${status}`) : status;
}

/**
 * The validate/reject flow, shared by the queue row and the detail drawer.
 *
 * Extracted so the two entry points cannot drift: both must require a reason
 * to reject, both must report the RPC's error message rather than a generic
 * failure, and both must agree on what happened. Whether a report has been
 * resolved is deliberately NOT held here — that lives in QueueClient, so a
 * report validated from the drawer is also struck through in the row behind
 * it. Two copies of this hook would each believe their own version.
 */
export function useReportReview(reportId: string, onResolved: (verdict: Verdict) => void) {
  const { showToast } = useToast();
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [isRejecting, setIsRejecting] = useState(false);
  const dispatch = useCdrrmoDispatch();

  // CDRRMO dispatch was switched on after this page loaded, and the backend
  // refused the old path for this Emergency report. Turning the page's copy
  // of the switch on swaps this report's buttons for the Validate flow.
  function failed(result: { message?: string; reason?: "cdrrmo-dispatch-active" }) {
    if (result.reason === "cdrrmo-dispatch-active") {
      dispatch.setActive(true);
      showToast(t("cdrrmo.useValidate"), "danger");
      return;
    }
    showToast(result.message ?? t("review.failed"), "danger");
  }

  function validate() {
    startTransition(async () => {
      const result = await callAction(() => updateReportStatus(reportId, "validated"));
      if (result === null) {
        showToast(t("common.noAnswer"), "danger");
        return;
      }
      if (result.success) {
        onResolved("validated");
        showToast(t("review.validatedToast", { id: reportId }), "success");
      } else {
        failed(result);
      }
    });
  }

  function reject(reason: string) {
    setIsRejecting(false);
    startTransition(async () => {
      const result = await callAction(() => updateReportStatus(reportId, "rejected", reason));
      if (result === null) {
        showToast(t("common.noAnswer"), "danger");
        return;
      }
      if (result.success) {
        onResolved("rejected");
        // Rejected reports leave the queue entirely — no tab shows them, by
        // design — so say where they went, or the official goes looking.
        showToast(t("review.rejectedToast", { id: reportId }), "danger");
      } else {
        failed(result);
      }
    });
  }

  return {
    isPending,
    isRejecting,
    openReject: () => setIsRejecting(true),
    cancelReject: () => setIsRejecting(false),
    validate,
    reject,
  };
}
