import { requireBarangayOfficial } from "@/lib/auth";
import { LanguageProvider } from "@/lib/i18n";
import { getBarangayQueue } from "@/lib/data/queue";
import { getRecentAuditActivity } from "@/lib/data/auditLog";
import { getSanctionCounts } from "@/lib/data/sanctions";
import { CdrrmoDispatchProvider } from "@/components/queue/CdrrmoDispatchContext";
import { QueueClient } from "./QueueClient";

// This page depends on the signed-in user's session and live data — never
// statically prerender it.
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const official = await requireBarangayOfficial();
  // A barangay admin's home adds a recent-activity list and the sanction
  // cards (A.3.1). Loaded beside the queue, never before it, and only for
  // those roles; neither can fail the page.
  const isAdmin = official.role === "barangay_admin" || official.role === "senior_barangay_admin";
  const [queueData, recentActivity, sanctionCounts] = await Promise.all([
    getBarangayQueue(official.barangayId, official.barangayName),
    isAdmin ? getRecentAuditActivity() : Promise.resolve(null),
    isAdmin ? getSanctionCounts(official.barangayId) : Promise.resolve(undefined),
  ]);
  // The language provider wraps the page component itself, so the strings
  // it builds (breadcrumb, footers, empty states) follow the chosen language.
  return (
    <LanguageProvider role={official.role}>
      {/* The CDRRMO dispatch switch as getBarangayQueue read it for this page
          load, false on any doubt (src/lib/cdrrmo-dispatch.ts). Rows and the
          drawer read it from here. */}
      <CdrrmoDispatchProvider initial={queueData.cdrrmoDispatch} cdrrmoAgency={queueData.cdrrmoAgency}>
        <QueueClient
          official={official}
          queueData={queueData}
          recentActivity={recentActivity}
          sanctionCounts={sanctionCounts}
        />
      </CdrrmoDispatchProvider>
    </LanguageProvider>
  );
}
