"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, MAX_REASON_LENGTH, parseRejectReason } from "@/lib/utils";
import {
  mapValidateEmergencyResult,
  refreshesQueue,
  VALIDATE_EMERGENCY_RPC,
  type EmergencyValidationOutcome,
} from "@/lib/cdrrmo-dispatch";

/**
 * Validates or rejects an Emergency report through CDRRMO dispatch
 * (validate_emergency_report, see src/lib/cdrrmo-dispatch.ts). On validate
 * the database sends the report to its default agencies in the same
 * transaction; there is no separate routing step and no agency choice.
 *
 * A public POST endpoint like every action in reports.ts, so the input is
 * proven first, with the same reason rules as a review_report() rejection:
 * the reject prompt is the same ReasonPromptModal, and Validation History
 * reads the reason's category back from its prefix.
 *
 * The answer is a code (EmergencyValidationOutcome); the page words it. The
 * database decides everything else: the switch, the barangay, the state
 * table. Outcomes come back as returned text, refusals as 55000 + DETAIL
 * token (src/lib/cdrrmo-dispatch.ts).
 */
export async function validateEmergencyReport(
  reportId: string,
  decision: "validated" | "rejected",
  reason?: string
): Promise<{ outcome: EmergencyValidationOutcome }> {
  if (!isUuid(reportId) || (decision !== "validated" && decision !== "rejected")) {
    return { outcome: "invalid" };
  }

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
  const { data, error, status } = await supabase.rpc(VALIDATE_EMERGENCY_RPC, {
    p_report: reportId,
    p_decision: decision,
    p_reason: pReason,
  });

  const outcome = mapValidateEmergencyResult({ data, error, status });
  // Every answer that may follow a write refreshes the queue, an unknown
  // one included: the page then shows where the report really stands.
  if (refreshesQueue(outcome)) revalidatePath("/queue");
  return { outcome };
}
