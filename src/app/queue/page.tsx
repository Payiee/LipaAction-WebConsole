import { requireBarangayOfficial } from "@/lib/auth";
import { LanguageProvider } from "@/lib/i18n";
import { loadQueuePage } from "@/lib/data/queuePage";
import { QueueRoot } from "./QueueRoot";

// This page depends on the signed-in user's session and live data — never
// statically prerender it.
export const dynamic = "force-dynamic";

export default async function QueuePage() {
  const official = await requireBarangayOfficial();
  const initial = await loadQueuePage(official);
  // The language provider wraps the page component itself, so the strings
  // it builds (breadcrumb, footers, empty states) follow the chosen language.
  // QueueRoot holds the data in the browser, so the page's live refresh
  // replaces it without a router refresh.
  return (
    <LanguageProvider role={official.role}>
      <QueueRoot official={official} initial={initial} />
    </LanguageProvider>
  );
}
