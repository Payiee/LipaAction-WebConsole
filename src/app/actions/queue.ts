"use server";

import { requireBarangayOfficial } from "@/lib/auth";
import { loadQueuePage, type QueuePageData } from "@/lib/data/queuePage";

/**
 * The queue page's data again, for the page's live refresh.
 *
 * The page used to refresh with router.refresh(), which on Next 14 empties
 * the browser's cache of every other page too. The queue refreshes on each
 * live event (a report filed or decided, an agency's progress, a timer
 * routing), so an official who looked at the queue for a while found every
 * other page loading again behind its skeleton. A Server Action that only
 * returns data leaves that cache alone.
 *
 * It goes through the same gate as the page: no session sends the browser
 * to sign-in, a role outside the desk to /not-authorized. It takes no input,
 * so there is nothing to prove; the barangay comes from the caller's own
 * profile.
 */
export async function reloadQueue(): Promise<QueuePageData> {
  const official = await requireBarangayOfficial();
  return loadQueuePage(official);
}
