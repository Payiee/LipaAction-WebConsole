"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid, MAX_REASON_LENGTH, parseRejectReason } from "@/lib/utils";
import {
  mapValidateEmergencyResult,
  VALIDATE_EMERGENCY_RPC,
  type EmergencyValidationOutcome,
} from "@/lib/cdrrmo-dispatch";

// Answers after which the report is where it was: nothing to refresh.
const NOTHING_MOVED = new Set<EmergencyValidationOutcome>([
  "invalid",
  "not-permitted",
  "session-expired",
  "unreachable",
  "failed",
]);

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
 * table. The queue is refreshed after any answer that means the report
 * moved, done or not.
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
  if (!NOTHING_MOVED.has(outcome)) revalidatePath("/queue");
  return { outcome };
}
