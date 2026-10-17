"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { ClusterList } from "@/components/cluster-explorer/ClusterList";
import { MemberPanel } from "@/components/cluster-explorer/MemberPanel";
import { MapPanel } from "@/components/cluster-explorer/MapPanel";
import { DataUnavailableBanner } from "@/components/layout/DataUnavailableBanner";
import { Icon } from "@/components/ui/Icon";
import { useLang, useT } from "@/lib/i18n";
import { useNow } from "@/lib/useNow";
import { DUPLICATE_WRITEBACK_LIVE } from "@/lib/features";
import type { OfficialProfile } from "@/lib/auth";
// Type-only import from a server-only module — erased at compile time.
import type { ClusterData } from "@/lib/data/clusters";

export function ClusterExplorerClient({
  official,
  clusterData,
}: {
  official: OfficialProfile;
  clusterData: ClusterData;
}) {
  const { clusters, loadFailed } = clusterData;
  const hasClusters = clusters.length > 0;
  const [activeId, setActiveId] = useState(hasClusters ? clusters[0].id : "");
  const activeCluster = clusters.find((c) => c.id === activeId);
  // The member picked on the map or in the list; one state so both agree.
  // Cleared when another cluster is chosen, since its ids belong to the old one.
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  function selectCluster(id: string) {
    setActiveId(id);
    setSelectedMemberId(null);
  }
  const t = useT();
  const lang = useLang();
  // Member ages keep moving; this page doesn't refetch on its own.
  const now = useNow();

  return (
    <AppShell breadcrumb={[official.barangayName, t("nav.clusterExplorer")]} official={official}>
      {loadFailed && <DataUnavailableBanner what={t("banner.what.clusters")} />}
      {!hasClusters ? (
        // Not shown under a load failure: the banner already says nothing
        // here is current, and [not connected yet] would misstate an outage.
        !loadFailed && (
          <div className="flex h-[calc(100vh-6.5rem)] items-center justify-center rounded-card border border-ink-100 bg-white px-4 shadow-panel">
            {/* An earlier copy — [No duplicate clusters right now] — read as a
                finding. It was a wiring gap: the backend's duplicate flagger
                computed clusters but never wrote them back, so this page was
                empty no matter what was filed, and the backend owner asked for
                that to be stated on screen (2026-09-17). Nothing here can
                detect the day write-back goes live, so DUPLICATE_WRITEBACK_LIVE
                is switched by hand, and the copy then describes the grouping. */}
            <div className="max-w-md text-center">
              <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-500">
                <Icon name="clusters" className="h-6 w-6" />
              </span>
              <p className="text-base font-medium text-ink-900">
                {t(DUPLICATE_WRITEBACK_LIVE ? "clusters.emptyTitleLive" : "clusters.emptyTitle")}
              </p>
              <p className="mt-1 text-sm text-ink-500">
                {t(DUPLICATE_WRITEBACK_LIVE ? "clusters.emptyBodyLive" : "clusters.emptyBody")}
              </p>
              {/* The English screen keeps the mockup Tagalog line under it,
                  while it is still true. */}
              {lang === "en" && !DUPLICATE_WRITEBACK_LIVE && (
                <p className="mt-2 text-xs text-ink-500">
                  Hindi pa nakakonekta ang pagtukoy ng duplicate.
                </p>
              )}
            </div>
          </div>
        )
      ) : (
        <div className="flex h-auto flex-col gap-4 lg:h-[calc(100vh-6.5rem)] lg:flex-row">
          {/* Translated like the rest of the console since 2026-09-23, ahead
              of the demo pair whose grouping the backend owner writes by
              hand. Category names and tier names stay English, as
              everywhere. */}
          <ClusterList clusters={clusters} activeId={activeId} onSelect={selectCluster} />
          {activeCluster && (
            <MemberPanel
              cluster={activeCluster}
              now={now}
              selectedId={selectedMemberId}
              onSelect={setSelectedMemberId}
            />
          )}
          {activeCluster && (
            <MapPanel cluster={activeCluster} selectedId={selectedMemberId} onSelect={setSelectedMemberId} />
          )}
        </div>
      )}
    </AppShell>
  );
}
