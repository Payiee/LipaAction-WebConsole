"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { reloadQueue } from "@/app/actions/queue";
import { callAction } from "@/lib/callAction";
import { CdrrmoDispatchProvider } from "@/components/queue/CdrrmoDispatchContext";
import { RecallProvider } from "@/components/queue/RecallContext";
import type { OfficialProfile } from "@/lib/auth";
// Type-only import from a server-only module — erased at compile time.
import type { QueuePageData } from "@/lib/data/queuePage";
import { QueueClient } from "./QueueClient";

/**
 * Holds the queue page's data in the browser, so a live refresh can replace
 * it without router.refresh() (see reloadQueue for why that matters).
 *
 * Two things replace it: the reload, and new data from the server, which
 * arrives when a decision's revalidation or a navigation renders the page
 * again. The newest of the two wins: each reload is numbered, and one that
 * returns after newer data arrived is dropped.
 */
export function QueueRoot({ official, initial }: { official: OfficialProfile; initial: QueuePageData }) {
  const [page, setPage] = useState(initial);
  const seq = useRef(0);

  useEffect(() => {
    seq.current += 1;
    setPage(initial);
  }, [initial]);

  // No answer leaves the page as it was; the live channel, the catch-up
  // check and the poll fallback ask again.
  const reload = useCallback(async () => {
    const mine = ++seq.current;
    const next = await callAction(() => reloadQueue());
    if (next && mine === seq.current) setPage(next);
  }, []);

  const { queueData } = page;
  return (
    // The CDRRMO dispatch switch as getBarangayQueue read it for this load,
    // false on any doubt (src/lib/cdrrmo-dispatch.ts). Rows and the drawer
    // read it from here.
    <CdrrmoDispatchProvider initial={queueData.cdrrmoDispatch} cdrrmoAgency={queueData.cdrrmoAgency}>
      {/* RECALL-UI: the one Recall dialog and what the server already
          answered, shared by the strip, the rows and the drawer. Off (no
          button anywhere) until its one probe finds the recall functions. */}
      <RecallProvider probeId={queueData.autoRouted[0]?.id ?? null}>
        <QueueClient
          official={official}
          queueData={queueData}
          recentActivity={page.recentActivity}
          sanctionCounts={page.sanctionCounts}
          loadedAt={page.loadedAt}
          reload={reload}
        />
      </RecallProvider>
    </CdrrmoDispatchProvider>
  );
}
