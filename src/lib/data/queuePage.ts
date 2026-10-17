import "server-only";

import type { OfficialProfile } from "@/lib/auth";
import { getBarangayQueue, type QueueData } from "@/lib/data/queue";
import { getRecentAuditActivity, type RecentActivityData } from "@/lib/data/auditLog";
import { getSanctionCounts, type SanctionCounts } from "@/lib/data/sanctions";

/** Everything the queue page shows, loaded together. */
export interface QueuePageData {
  queueData: QueueData;
  // The barangay admin's recent-activity list; null for every other role.
  recentActivity: RecentActivityData | null;
  // The barangay admin's sanction cards: undefined for a barangay official,
  // null when the count couldn't be read.
  sanctionCounts: SanctionCounts | null | undefined;
  // When the server loaded it, as an ISO instant. The page's [Data as of]
  // line and its catch-up check read this rather than the moment the page
  // mounted, because a page shown again from the browser's cache mounts with
  // data loaded minutes earlier.
  loadedAt: string;
}

/**
 * The queue page's data, for the page itself and for reloadQueue(), the
 * Server Action the page refreshes through. One loader, so a refresh can
 * never show less than a page load does.
 */
export async function loadQueuePage(official: OfficialProfile): Promise<QueuePageData> {
  // A barangay admin's home adds a recent-activity list and the sanction
  // cards (A.3.1). Loaded beside the queue, never before it, and only for
  // those roles; neither can fail the page.
  const isAdmin = official.role === "barangay_admin" || official.role === "senior_barangay_admin";
  const [queueData, recentActivity, sanctionCounts] = await Promise.all([
    getBarangayQueue(official.barangayId, official.barangayName),
    isAdmin ? getRecentAuditActivity() : Promise.resolve(null),
    isAdmin ? getSanctionCounts(official.barangayId) : Promise.resolve(undefined),
  ]);
  return { queueData, recentActivity, sanctionCounts, loadedAt: new Date().toISOString() };
}
