"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, MAX_REASON_LENGTH, parseRejectReason } from "@/lib/utils";
import {
  checklistAgencyIds,
  mapValidateEmergencyResult,
  refreshesQueue,
  validateEmergencyArgs,
  VALIDATE_EMERGENCY_RPC,
  type EmergencyValidationOutcome,
} from "@/lib/cdrrmo-dispatch";

/**
 * Validates or rejects an Emergency report through CDRRMO dispatch
 * (validate_emergency_report, see src/lib/cdrrmo-dispatch.ts). On validate
 * the database routes the report in the same transaction; there is no
 * separate routing step. agencyIds are the agencies the desk ticked, in tick
 * order (owner decision Q4): the first new one leads and CDRRMO is always
 * added. Without ticks (the record case, a recalled report validated with
 * none, or no agency list to offer) the call has no list, and the database
 * adds CDRRMO alone; a recalled report also goes back to the agencies it was
 * recalled from.
 *
 * A public POST endpoint like every action in reports.ts, so the input is
 * proven first, with the same reason rules as a review_report() rejection:
 * the reject prompt is the same ReasonPromptModal, and Validation History
 * reads the reason's category back from its prefix. The list rules are
 * checklistAgencyIds: uuids only, at most 30, repeats collapsed to their
 * first position, never with a reject.
 *
 * The answer is a code (EmergencyValidationOutcome); the page words it. The
 * database decides everything else: the switch, the barangay, the state
 * table. Outcomes come back as returned text, refusals as 55000 + DETAIL
 * token (src/lib/cdrrmo-dispatch.ts).
 */
export async function validateEmergencyReport(
  reportId: string,
  decision: "validated" | "rejected",
  reason?: string,
  agencyIds?: string[]
): Promise<{ outcome: EmergencyValidationOutcome }> {
  if (!isUuid(reportId) || (decision !== "validated" && decision !== "rejected")) {
    return { outcome: "invalid" };
  }
  const checklist = checklistAgencyIds(decision, agencyIds);
  if (checklist === null) return { outcome: "invalid" };

  let pReason: string | null = null;
  if (decision === "rejected") {
    const trimmed = typeof reason === "string" ? reason.trim() : "";
    const { code, note } = parseRejectReason(trimmed);
    if (trimmed.length === 0 || trimmed.length > MAX_REASON_LENGTH || code === null || (code === "other" && note.length === 0)) {
      return { outcome: "invalid" };
    }
    pReason = trimmed;
  }

  const supabase = createClient();
  // p_agency_ids only with ticks: without them this stays the three-argument
  // call (validateEmergencyArgs).
  const { data, error, status } = await supabase.rpc(
    VALIDATE_EMERGENCY_RPC,
    validateEmergencyArgs(reportId, decision, pReason, checklist)
  );

  const outcome = mapValidateEmergencyResult({ data, error, status });
  // Every answer that may follow a write refreshes the queue, an unknown
  // one included: the page then shows where the report really stands.
  if (refreshesQueue(outcome)) revalidatePath("/queue");
  return { outcome };
}
