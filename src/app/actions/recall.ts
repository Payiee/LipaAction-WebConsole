"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/utils";
import {
  RECALL_RPC,
  UNREAD_AUTO_ROUTED_LIMIT,
  mapRecallResult,
  refreshesAfterRecall,
  validateRecallInput,
  type RecallOutcome,
} from "@/lib/recall";

/**
 * Recalls an auto-routed report (recall_auto_routed_report, see
 * src/lib/recall.ts). A public POST endpoint like every action here, so the
 * input is proven first: a uuid, one of the four severities, a reason of 1 to
 * 500 characters after the RPC's own trim. The database decides the rest:
 * who may, which report, the window, dispatch, and the audit rows. The
 * console writes no audit row of its own (spec section 9).
 *
 * The answer is a code; the page words it in the official's language. The
 * backend's message never reaches the browser.
 */
export async function recallAutoRoutedReport(
  reportId: string,
  severity: string,
  reason: string
): Promise<{ outcome: RecallOutcome }> {
  const input = validateRecallInput(reportId, severity, reason);
  if (!input.ok) return { outcome: "invalid" };

  const supabase = createClient();
  const { data, error, status } = await supabase.rpc(RECALL_RPC, {
    p_report_id: input.reportId,
    p_severity: input.severity,
    p_reason: input.reason,
  });

  const outcome = mapRecallResult({ data, error, status });
  if (refreshesAfterRecall(outcome)) revalidatePath("/queue");
  return { outcome };
}

// The header badge never marks more than it shows.
const MAX_MARK = UNREAD_AUTO_ROUTED_LIMIT;

/**
 * Marks the official's own desk_report_auto_routed notifications read
 * (mark_notifications_read: the caller's rows only,
 * 20261110090000_notifications_inbox.sql:260-285). Called when the official
 * opens the list from the header badge. Returns whether it worked; a failure
 * only leaves the badge up.
 */
export async function markAutoRoutedSeen(ids: string[]): Promise<{ ok: boolean }> {
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_MARK || !ids.every(isUuid)) {
    return { ok: false };
  }
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: [...new Set(ids)] });
  if (error) {
    console.error("[recall] mark notifications read failed", error.code);
    return { ok: false };
  }
  return { ok: true };
}
