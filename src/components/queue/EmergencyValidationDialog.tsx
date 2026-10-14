"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useT } from "@/lib/i18n";
import { AgencyPickerModal } from "./AgencyPickerModal";
import { useCdrrmoDispatch } from "./CdrrmoDispatchContext";
import { agencyChecklist, dispatchChecklistCopy, dispatchNoChecklistCopy, dispatchRecordCopy } from "./routing";
import type { EmergencyValidation } from "./useEmergencyValidation";
import type { QueueReport } from "@/types";

/**
 * The step an Emergency report's Validate opens while CDRRMO dispatch is on,
 * shared by the queue row and the detail drawer so the two can't drift:
 * - send (no agency holds it yet): the agency checklist, as for any report
 *   (owner decision Q4, the barangay checklist wins). The ticks go to
 *   validate_emergency_report() in tick order, and CDRRMO always goes too.
 *   With no list to offer (agencyChecklist's options null or empty), a plain
 *   confirmation instead: validating without ticks sends it to CDRRMO alone.
 * - record (already with its agencies): a plain confirmation, no list.
 */
export function EmergencyValidationDialog({
  report,
  emergency,
}: {
  report: QueueReport;
  emergency: EmergencyValidation;
}) {
  const t = useT();
  const { cdrrmoAgency } = useCdrrmoDispatch();

  if (emergency.confirming === null) return null;

  if (emergency.confirming === "record") {
    return (
      <ConfirmModal
        {...dispatchRecordCopy(report, t)}
        busy={emergency.isPending}
        onCancel={emergency.cancelConfirm}
        onConfirm={emergency.validate}
      />
    );
  }

  const checklist = agencyChecklist(report);
  if (!checklist.options || checklist.options.length === 0) {
    return (
      <ConfirmModal
        {...dispatchNoChecklistCopy(report, cdrrmoAgency, t)}
        busy={emergency.isPending}
        onCancel={emergency.cancelConfirm}
        onConfirm={emergency.validate}
      />
    );
  }

  return (
    <AgencyPickerModal
      {...dispatchChecklistCopy(report, checklist, cdrrmoAgency, t)}
      options={checklist.options}
      recommended={checklist.recommended}
      busy={emergency.isPending}
      onCancel={emergency.cancelConfirm}
      onConfirm={emergency.validateWith}
    />
  );
}
