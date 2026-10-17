"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DataUnavailableBanner } from "@/components/layout/DataUnavailableBanner";
import { playChime, primeChime } from "@/lib/chime";
import { usePreferences } from "@/lib/preferences";
import { useT } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { DUPLICATE_WRITEBACK_LIVE } from "@/lib/features";
import { medianAgeMinutes } from "@/lib/utils";
import { useNow } from "@/lib/useNow";
import { KpiHeader } from "@/components/queue/KpiHeader";
import { RecentActivity } from "@/components/queue/RecentActivity";
import { AdminShortcuts } from "@/components/queue/AdminShortcuts";
import { ClusterCard } from "@/components/queue/ClusterCard";
import { DuplicateGroup } from "@/components/queue/DuplicateGroup";
import { QueueTabs, queuePanelDomId, queueTabDomId } from "@/components/queue/QueueTabs";
import { ReportRow } from "@/components/queue/ReportRow";
import { ReportDetailPanel } from "@/components/queue/ReportDetailPanel";
import { isReviewable, type Verdict } from "@/components/queue/useReportReview";
import { everyAgencyReturned } from "@/components/queue/routing";
import { RecallStrip } from "@/components/queue/RecallStrip";
import { RecallModal } from "@/components/queue/RecallModal";
import { useRecall } from "@/components/queue/RecallContext";
import { wasRecalled } from "@/components/queue/recallView";
import { markAutoRoutedSeen } from "@/app/actions/recall";
import { callAction } from "@/lib/callAction";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { QUEUE_SORTS, isQueueSort, sortReports, type QueueSort } from "@/lib/queue/sortReports";
import type { QueueReport, QueueTabId } from "@/types";
import type { OfficialProfile } from "@/lib/auth";
import type { QueueData } from "@/lib/data/queue";
import { UNREAD_AUTO_ROUTED_LIMIT } from "@/lib/recall";
import type { RecentActivityData } from "@/lib/data/auditLog";
import type { SanctionCounts } from "@/lib/data/sanctions";

// Fallback cadence when the Realtime channel can't be established (network
// that blocks websockets, or the subscription errors). The thesis gives
// Tier 0 a 5-minute SLA; 30 s keeps worst-case staleness well inside that.
const REFRESH_INTERVAL_MS = 30_000;

// Realtime events are coalesced for this long before one refresh: a cluster
// validate is many UPDATEs in a row, and each refresh is a full RSC fetch.
const REALTIME_DEBOUNCE_MS = 500;

type Freshness = "connecting" | "live" | "polling";

// How long a newly arrived row stays marked. Long enough to be seen by
// someone who looked away mid-sentence; short enough that the queue isn't
// permanently decorated. Matches the `arrival` keyframe's duration.
const ARRIVAL_HIGHLIGHT_MS = 4000;

const NO_ARRIVALS: ReadonlySet<string> = new Set();

// The reports the page shows, as arrival detection sees them: all of them,
// and those in a working queue (the pending tabs; Flagged duplicates only
// repeats pending rows).
interface SeenReports {
  all: ReadonlySet<string>;
  pending: ReadonlySet<string>;
}

function seenReports(data: QueueData): SeenReports {
  const { emergency, standard } = data.queueByTab;
  return {
    all: new Set(Object.values(data.queueByTab).flat().map((r) => r.id)),
    pending: new Set([...emergency, ...standard].map((r) => r.id)),
  };
}

// What arrived since the last fetch: a report new to the page, or one back in
// a working queue from Recent validated. Statuses only move forward, apart
// from the backend's handback of a report every agency returned after an
// automatic routing, and a recall (RECALL-UI), so nothing else moves into the
// pending tabs. Without the
// second half, a returned report was marked only when it had fallen off the
// capped routed list first.
function arrivalsSince(previous: SeenReports, current: SeenReports): string[] {
  return [...current.all].filter(
    (id) => !previous.all.has(id) || (current.pending.has(id) && !previous.pending.has(id))
  );
}

// The arrived emergencies that still get the chime: not already announced by
// their Realtime INSERT, and not a returned or recalled report. The alert
// means a new emergency, as Settings describes it; a report the agencies sent
// back, or one this barangay recalled (RECALL-UI), is marked on its row
// instead, and the SLA alert, when switched on, fires for it at once, since it
// is long past its five minutes.
function unannouncedEmergencies(
  emergencies: QueueReport[],
  arrived: readonly string[],
  chimed: ReadonlySet<string>
): QueueReport[] {
  return emergencies.filter(
    (r) => arrived.includes(r.id) && !chimed.has(r.id) && !everyAgencyReturned(r.details.routing) && !wasRecalled(r)
  );
}

// Fast-triage SLA from the thesis (p.102): a Tier 0 report should have a
// decision within 5 minutes of submission.
const TIER0_SLA_MS = 5 * 60_000;

// How often the SLA check runs on its own clock. A quarter-minute of slack on
// a five-minute window.
const SLA_CHECK_MS = 15_000;

// Everything the page shows as needing action: pending (kept in step with
// PENDING_STATUSES in queue.ts) and validated-awaiting-routing. The loader
// fetches both lists uncapped, so the set the catch-up compares is exact.
const ACTIONABLE_STATUSES = ["pending_priority", "prioritized", "validated"];
const CATCH_UP_LIMIT = 1000;

// The catch-up compares only the reports needing action. The rest of the
// page (the routed half of Recent validated, the Validated today count) can
// lag it, so data this old gets refreshed on a catch-up even when nothing it
// compares has changed.
const STALE_DATA_MS = 60_000;

// The fallback clock for agency progress, which normally arrives live on its
// own channel — see the agency progress check in the component.
const AGENCY_PROGRESS_CHECK_MS = 60_000;
const AGENCY_PROGRESS_LIMIT = 1000;

// Tier 0 breaches this tab has already announced. Kept outside the component
// and in sessionStorage, because the ref it used to live in was rebuilt on
// every mount: an official moving between pages was told about the same
// overdue report again on each return, six times over one night. Reading and
// writing are wrapped because a private window can refuse storage, where the
// set in memory still covers this page's life.
const SLA_NOTIFIED_KEY = "lipaaction.console.slaNotified.v1";
let announced: Set<string> | null = null;

function announcedBreaches(): Set<string> {
  if (announced === null) {
    try {
      const raw = window.sessionStorage.getItem(SLA_NOTIFIED_KEY);
      announced = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      announced = new Set();
    }
  }
  return announced;
}

function rememberBreach(reportId: string): void {
  const ids = announcedBreaches();
  ids.add(reportId);
  try {
    window.sessionStorage.setItem(SLA_NOTIFIED_KEY, JSON.stringify([...ids]));
  } catch {
    // Storage refused; the set in memory still stops a repeat on this page.
  }
}

function signatureOf(rows: { id: string; status: string }[]): string {
  return rows
    .map((r) => `${r.id}:${r.status}`)
    .sort()
    .join("|");
}

// Where each agency stands on each report, without naming the agency: the
// page holds agency names and the query returns ids, and a new, closed or
// acknowledged row changes this string either way.
function progressSignature(
  rows: {
    reportId: string;
    acknowledgedAt: string | null;
    inProgressAt: string | null;
    resolvedAt: string | null;
    resolutionOutcome: string | null;
  }[]
): string {
  return rows
    .map((r) => `${r.reportId}:${r.acknowledgedAt ? 1 : 0}${r.inProgressAt ? 1 : 0}${r.resolvedAt ? 1 : 0}:${r.resolutionOutcome ?? "-"}`)
    .sort()
    .join("|");
}

// What the page is showing, in the shape the catch-up query returns. null
// when the page's own data can't be trusted for a comparison.
function actionableSignature(data: QueueData): string | null {
  if (data.loadFailed || data.validatedUnavailable) return null;
  const { emergency, standard, validated } = data.queueByTab;
  return signatureOf(
    [...emergency, ...standard, ...validated.filter((r) => r.details.status === "validated")].map((r) => ({
      id: r.id,
      status: r.details.status,
    }))
  );
}

export function QueueClient({
  official,
  queueData,
  recentActivity = null,
  sanctionCounts,
  loadedAt,
  reload,
}: {
  official: OfficialProfile;
  queueData: QueueData;
  // The barangay admin's recent-activity list; null for every other role.
  recentActivity?: RecentActivityData | null;
  // The barangay admin's sanction cards: undefined for a barangay official,
  // null when the count couldn't be read.
  sanctionCounts?: SanctionCounts | null;
  // When the server loaded queueData (ISO), and the refresh that loads it
  // again; both from QueueRoot.
  loadedAt: string;
  reload: () => Promise<void>;
}) {
  const [activeTab, setActiveTab] = useState<QueueTabId>("emergency");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<QueueSort>("priority");
  const { showToast } = useToast();
  const t = useT();

  // Filters the active tab's rows only. Report ID, category, and description
  // are the searchable fields — deliberately not reporter or address, which
  // the old placeholder advertised: reporter names are never exposed to
  // officials, and incident_reports has no address column at all.
  const rows = useMemo(() => {
    const tabRows = queueData.queueByTab[activeTab];
    const trimmed = query.trim().toLowerCase();
    const matched =
      trimmed.length === 0
        ? tabRows
        : tabRows.filter((report) =>
            [report.id, report.category, report.summary].some((field) =>
              field.toLowerCase().includes(trimmed)
            )
          );
    // Recent validated is ordered by review time server-side and has no sort
    // control; the pending tabs sort client-side over what is already loaded.
    return activeTab === "validated" ? matched : sortReports(matched, sort);
  }, [queueData.queueByTab, activeTab, query, sort]);

  const unfilteredCount = queueData.queueByTab[activeTab].length;
  const isFiltered = query.trim().length > 0;
  const listRef = useRef<HTMLDivElement>(null);

  // Held here rather than inside each row: a report can be resolved from its
  // row or from the detail drawer, and both surfaces have to agree.
  const [resolved, setResolved] = useState<Record<string, Verdict>>({});
  const [selected, setSelected] = useState<QueueReport | null>(null);
  // True when the drawer was opened from a row's [Chat] button.
  const [chatFocus, setChatFocus] = useState(false);

  // The drawer shows the freshest copy of the selected report, not the
  // snapshot taken when it was clicked. Routing keeps the drawer open and
  // the report comes back from the server with its new status and agency
  // rows; handing the drawer the stale snapshot would leave it offering
  // [Route to agency] on a report that has just been routed. Falls back to
  // the snapshot when the report has left every tab (e.g. rejected).
  // The freshest copy of a report anywhere on the page: every tab, then the
  // auto-routed list the Recall strip shows (RECALL-UI).
  const findReport = useCallback(
    (id: string): QueueReport | null => {
      for (const list of [...Object.values(queueData.queueByTab), queueData.autoRouted]) {
        const fresh = list.find((r) => r.id === id);
        if (fresh) return fresh;
      }
      return null;
    },
    [queueData.queueByTab, queueData.autoRouted]
  );
  const selectedReport = useMemo(
    () => (selected ? findReport(selected.id) ?? selected : null),
    [selected, findReport]
  );

  // RECALL-UI: the one Recall dialog (RecallContext), and the header badge
  // for unread [routed without you] notifications. Ids marked read this page
  // load are hidden at once; the next load agrees.
  const recall = useRecall();
  const [seenNotifications, setSeenNotifications] = useState<ReadonlySet<string>>(new Set());
  const unreadAutoRouted = (queueData.unreadAutoRoutedIds ?? []).filter((id) => !seenNotifications.has(id));

  const { prefs } = usePreferences(official.role);
  // Read inside long-lived callbacks (the Realtime handler, the SLA timer)
  // that must not be torn down and re-created every time a preference flips.
  const prefsRef = useRef(prefs);
  useEffect(() => {
    prefsRef.current = prefs;
  });

  // The latest data and when the server loaded it, for the catch-up check
  // below — a long-lived callback that must not be rebuilt per refresh. The
  // server's time, not this component's: a page shown again from the
  // browser's cache mounts with data loaded minutes earlier.
  const queueDataRef = useRef(queueData);
  const dataArrivedAt = useRef(0);
  useEffect(() => {
    queueDataRef.current = queueData;
    const loaded = Date.parse(loadedAt);
    dataArrivedAt.current = Number.isNaN(loaded) ? Date.now() : loaded;
  }, [queueData, loadedAt]);

  // The chime needs one click or key press on this page before the browser
  // lets it play (see chime.ts). After a reload there hasn't been one, so the
  // footer says so until the first gesture, which also unlocks the audio.
  // Browsers without navigator.userActivation get the unlock but no notice.
  const [soundLocked, setSoundLocked] = useState(false);
  useEffect(() => {
    const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
      .userActivation;
    if (activation && !activation.hasBeenActive) setSoundLocked(true);
    function unlock() {
      primeChime();
      setSoundLocked(false);
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // ---------------------------------------------------------------------
  // Refresh scheduling.
  //
  // Every reason to re-fetch — a Realtime event, a reconnect, the tab coming
  // back, the poll — asks through requestRefresh(), and one place decides
  // when it may actually run. A refresh is HELD, never dropped, while:
  //
  //  - a dialog is open: a drawer or prompt must never have its report
  //    swapped out from under a decision;
  //  - the pointer is over the list: a refresh re-sorts rows, and a list that
  //    reflows under a cursor can turn a click meant for one report's
  //    Validate into a decision on another — which cannot be undone;
  //  - the browser reports itself offline: on Next 14 a refresh that fails
  //    becomes a hard navigation, which on a dead connection replaces the
  //    console with the browser's own error page.
  //
  // A held refresh runs the moment all three clear. The footer says one is
  // waiting, so a held queue never passes for an idle one; and new emergencies
  // still chime while held, straight from the Realtime event (see below).
  // The dialog check reads the DOM because the modals live in ReportRow and
  // ClusterCard and this component doesn't see them open.
  const refreshPending = useRef(false);
  const pointerOverList = useRef(false);
  const [updateWaiting, setUpdateWaiting] = useState(false);

  // The page's own clock for ages: rows, cluster members and Median wait are
  // worked out from it rather than taken from the last fetch (see useNow).
  const now = useNow();

  const tryRefresh = useCallback(() => {
    if (!refreshPending.current) return;
    const held =
      pointerOverList.current ||
      document.querySelector('[role="dialog"]') !== null ||
      navigator.onLine === false;
    if (held) {
      setUpdateWaiting(true);
      return;
    }
    refreshPending.current = false;
    setUpdateWaiting(false);
    // Through a Server Action, never router.refresh(): on Next 14 that empties
    // the browser's cache of every other page (see reloadQueue).
    void reload();
  }, [reload]);

  const requestRefresh = useCallback(() => {
    refreshPending.current = true;
    tryRefresh();
  }, [tryRefresh]);

  /**
   * Catches up after a gap the Realtime channel can't cover — a (re)subscribe,
   * the tab coming back, the network returning — without refreshing when
   * nothing changed. Each refresh is a full reload of the page's data, and a
   * router.refresh() (what it used to be) on Next 14 emptied the router's whole
   * client cache, so refreshing on every subscribe made every other page load
   * again behind its skeleton after each visit here. Instead one small query
   * compares the reports this page shows as needing action (id and status)
   * with the database, and only a difference refreshes. When the check can't
   * answer, or the data on screen is over a minute old, it refreshes anyway.
   */
  const catchUp = useCallback(async () => {
    const rendered = actionableSignature(queueDataRef.current);
    if (rendered === null || Date.now() - dataArrivedAt.current > STALE_DATA_MS) {
      requestRefresh();
      return;
    }
    try {
      const { data, error } = await createClient()
        .from("incident_reports")
        .select("id, status")
        .eq("incident_barangay_id", official.barangayId)
        .in("status", ACTIONABLE_STATUSES)
        .limit(CATCH_UP_LIMIT);
      if (error || !data || data.length >= CATCH_UP_LIMIT || signatureOf(data) !== rendered) {
        requestRefresh();
      }
    } catch {
      requestRefresh();
    }
  }, [requestRefresh, official.barangayId]);

  // Which mode the footer reports: live, connecting, or the polling
  // fallback. The channel below sets it; it is declared here because the
  // handlers just below read it.
  const [freshness, setFreshness] = useState<Freshness>("connecting");
  // Bumped to build a fresh channel. A dropped channel is retried by
  // supabase-js on a backoff, but a hidden tab's timers are slowed to a
  // crawl: left overnight on 2026-09-23 the footer sat on [Live updates
  // unavailable] for long stretches and only recovered when a page change
  // remounted this component. Coming back to the page rebuilds it instead.
  const [channelEpoch, setChannelEpoch] = useState(0);
  const freshnessRef = useRef(freshness);
  useEffect(() => {
    freshnessRef.current = freshness;
  });
  const reviveChannelIfStalled = useCallback(() => {
    if (freshnessRef.current !== "live") setChannelEpoch((epoch) => epoch + 1);
  }, []);

  // Flushes a held refresh once it's clear, and catches up after the gaps a
  // Realtime channel can't see: the tab hidden or the laptop asleep (events
  // missed while suspended are not replayed), and the network coming back.
  useEffect(() => {
    const flush = window.setInterval(tryRefresh, 1000);
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void catchUp();
      reviveChannelIfStalled();
    };
    const onOnline = () => {
      void catchUp();
      reviveChannelIfStalled();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(flush);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tryRefresh, catchUp, reviveChannelIfStalled]);

  /**
   * Agency progress (an acknowledgement, a resolution, an out-of-scope
   * return) is written to agency_routing. Until the backend's #70 put that
   * table in the Realtime publication, an agency acting on a routed report
   * sent this page nothing: the row kept reading [awaiting acknowledgement]
   * until something else refreshed it, while an official watched it on
   * screen. The agency-progress channel below now carries those changes
   * (seen on prod 2026-10-01, within a second of each), and this check stays
   * as the fallback for one the channel misses, a dropped socket for one.
   * About once a minute while the queue is on screen, it compares the
   * routing the page shows with the database and refreshes only on a
   * difference, for the same router-cache reason as catchUp. A check that
   * fails waits for the next one: refreshing on an error would repeat every
   * minute for as long as the error lasted.
   */
  useEffect(() => {
    let inFlight = false;
    async function checkAgencyProgress() {
      if (inFlight || document.visibilityState !== "visible") return;
      const data = queueDataRef.current;
      if (data.loadFailed || data.validatedUnavailable) return;
      const shown = data.queueByTab.validated;
      if (shown.length === 0) return;
      inFlight = true;
      try {
        const { data: rows, error } = await createClient()
          .from("agency_routing")
          .select("incident_report_id, acknowledged_at, in_progress_at, resolved_at, resolution_outcome")
          .in(
            "incident_report_id",
            shown.map((r) => r.id)
          )
          .limit(AGENCY_PROGRESS_LIMIT);
        if (error || !rows || rows.length >= AGENCY_PROGRESS_LIMIT) return;
        const rendered = progressSignature(
          shown.flatMap((r) =>
            r.details.routing.map((a) => ({
              reportId: r.id,
              acknowledgedAt: a.acknowledgedAt,
              inProgressAt: a.inProgressAt,
              resolvedAt: a.resolvedAt,
              resolutionOutcome: a.resolutionOutcome,
            }))
          )
        );
        const current = progressSignature(
          rows.map((row) => ({
            reportId: row.incident_report_id,
            acknowledgedAt: row.acknowledged_at,
            inProgressAt: row.in_progress_at,
            resolvedAt: row.resolved_at,
            resolutionOutcome: row.resolution_outcome,
          }))
        );
        if (current !== rendered) requestRefresh();
      } catch {
        // The next check runs in a minute.
      } finally {
        inFlight = false;
      }
    }
    const id = window.setInterval(() => void checkAgencyProgress(), AGENCY_PROGRESS_CHECK_MS);
    return () => window.clearInterval(id);
  }, [requestRefresh]);

  // Emergencies already chimed for, so the Realtime event and the next
  // refresh's arrival check don't both sound for the same report.
  const chimedIds = useRef(new Set<string>());

  // ---------------------------------------------------------------------
  // Live updates. incident_reports is in the supabase_realtime publication
  // and postgres_changes delivery is RLS-filtered per authenticated user
  // (backend owner, 2026-09-11; verified on prod 2026-06-01). The barangay
  // filter is defence in depth on top of that, not the boundary.
  //
  // An event doesn't carry enough to update the screen by itself — priority
  // shaping, tab partitioning, and the KPI count all live server-side — so
  // each event asks for a refresh, which re-runs the server component and
  // streams new props in; React state here (active tab, search, resolved
  // marks) survives it.
  useEffect(() => {
    const supabase = createClient();
    let debounce: number | undefined;
    // Callbacks can still arrive after cleanup has started removing the
    // channel; they must not touch state or schedule work by then.
    let disposed = false;

    function onChange() {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(requestRefresh, REALTIME_DEBOUNCE_MS);
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let agencyChannel: ReturnType<typeof supabase.channel> | null = null;

    // The join message carries whichever token the Realtime client holds at
    // the moment subscribe() builds it, and supabase-js fetches the session
    // token asynchronously. On a fresh page the socket can open first, so the
    // join goes out as the anon role: RLS then shows this channel nothing,
    // while the server still answers SUBSCRIBED and the footer reads [Live].
    // The token pushed afterwards doesn't repair a join still in flight.
    // Reported by the backend owner as issue #1 (2026-09-23). So the token is
    // fetched first and the join is built with it. setAuth() with no argument
    // asks supabase-js for the session token, so refresh keeps working; it
    // falls back to the anon key rather than throwing when there is none.
    void supabase.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (disposed) return;
        channel = subscribeQueue();
        agencyChannel = subscribeAgencyProgress();
      });

    // Agency progress (acknowledged, in progress, resolved, returned) lives
    // on agency_routing, which joined the Realtime publication with the
    // backend's migration #70 (on prod; seen delivering 2026-10-01). A
    // channel of its own, so nothing about it can touch the queue channel or
    // the footer; if it ever drops, the once-a-minute progress check above
    // still covers it. agency_routing has no barangay column to filter on,
    // so row-level security (ar_select_barangay) is what scopes the events
    // to this desk.
    function subscribeAgencyProgress() {
      return supabase
        .channel(`agency-progress:${official.barangayId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "agency_routing" }, () => {
          if (disposed) return;
          onChange();
        })
        .subscribe();
    }

    function subscribeQueue() {
      return supabase
        .channel(`queue:${official.barangayId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "incident_reports",
            filter: `incident_barangay_id=eq.${official.barangayId}`,
          },
          (payload) => {
            if (disposed) return;
            // The chime fires from the event itself, not from the refresh it
            // triggers: a refresh can be held for as long as a drawer is open,
            // and an official busy in a drawer is exactly who needs to hear a
            // new emergency arrive.
            if (payload.eventType === "INSERT") {
              const row = payload.new as { id?: unknown; entry_tier?: unknown };
              if (row.entry_tier === "emergency" && typeof row.id === "string" && !chimedIds.current.has(row.id)) {
                chimedIds.current.add(row.id);
                if (prefsRef.current.audibleAlertNewEmergency) playChime();
              }
            }
            onChange();
          }
        )
        .subscribe((status) => {
          if (disposed) return;
          if (status === "SUBSCRIBED") {
            setFreshness("live");
            // Catch up on every (re)subscribe. Changes made between the server
            // render and the first subscribe, or during a reconnect gap, are
            // never replayed as events — without this the footer said [Live]
            // over a queue that could be missing a report indefinitely. The
            // check refreshes only if something actually changed (see catchUp).
            void catchUp();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            // Any failure state falls back to polling below rather than going
            // silent — the page must never look live when it isn't.
            setFreshness("polling");
          }
        });
    }

    return () => {
      disposed = true;
      window.clearTimeout(debounce);
      if (channel) void supabase.removeChannel(channel);
      if (agencyChannel) void supabase.removeChannel(agencyChannel);
    };
  }, [requestRefresh, catchUp, official.barangayId, channelEpoch]);

  // Polling, only while the channel isn't delivering.
  useEffect(() => {
    if (freshness === "live") return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") requestRefresh();
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [requestRefresh, freshness]);

  // When the data on screen was last received — the honest version of a
  // [Live] badge. Not moved by a failed load: that would stamp a fresh time
  // on data that didn't arrive.
  const [receivedAt, setReceivedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (queueData.loadFailed) return;
    const loaded = new Date(loadedAt);
    setReceivedAt(Number.isNaN(loaded.getTime()) ? new Date() : loaded);
  }, [queueData, loadedAt]);

  // What arrived on its own. The queue updates without being asked, so a
  // report can appear while the official is reading something else — the
  // row tint and the chime are how they find out.
  //
  // The first fetch seeds the set silently: the official just opened the
  // page and can see everything on it. Ids are compared, not counts, because
  // a count stays flat when one report is validated and another arrives in
  // the same refresh. A failed load is skipped entirely: its empty lists are
  // a fallback, not [everything left], and treating them as real made the
  // next good load mark every report New and chime. A report back in a
  // working queue after every agency returned it counts as arrived too (see
  // arrivalsSince), but never chimes.
  const seenBefore = useRef<SeenReports | null>(null);
  const [arrivedIds, setArrivedIds] = useState<ReadonlySet<string>>(NO_ARRIVALS);
  useEffect(() => {
    if (queueData.loadFailed) return;
    const current = seenReports(queueData);
    const previous = seenBefore.current;
    seenBefore.current = current;
    if (previous === null) return;

    const arrived = arrivalsSince(previous, current);
    if (arrived.length === 0) return;

    // A later arrival replaces an earlier highlight rather than extending it.
    setArrivedIds(new Set(arrived));

    // Chime only for emergencies the Realtime event didn't already announce
    // — this path covers arrivals seen by polling, or after a reconnect.
    const unannounced = unannouncedEmergencies(queueData.queueByTab.emergency, arrived, chimedIds.current);
    unannounced.forEach((r) => chimedIds.current.add(r.id));
    if (unannounced.length > 0 && prefsRef.current.audibleAlertNewEmergency) playChime();
  }, [queueData]);

  // Clears the highlight. Its own effect, keyed on the highlight itself: when
  // the timer lived in the arrival effect, the next fetch's cleanup cancelled
  // it, and a fetch with nothing new never set another — so the [New] chip
  // could stay on a row indefinitely.
  useEffect(() => {
    if (arrivedIds.size === 0) return;
    const timer = window.setTimeout(() => setArrivedIds(NO_ARRIVALS), ARRIVAL_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [arrivedIds]);

  // SLA breach: one browser notification per Tier 0 report the first time it
  // is seen past the 5-minute window, and only with permission already
  // granted — Settings is where permission is requested, on the toggle.
  //
  // On its own clock. It used to run only when the data changed, and a live
  // queue with no activity never changes — so a report that arrived under
  // five minutes old was never checked again and the alert never came. The
  // latest list is read through a ref so the timer isn't rebuilt per refresh.
  const slaSource = useRef({ emergency: queueData.queueByTab.emergency, resolved });
  useEffect(() => {
    slaSource.current = { emergency: queueData.queueByTab.emergency, resolved };
  });
  useEffect(() => {
    if (!prefs.slaBreachBrowserNotification) return;

    function notifyBreach(report: QueueReport) {
      // Nothing that identifies the incident on a report the resident filed
      // discreetly: an OS notification can surface on a lock screen or a
      // shared display, outside the console entirely.
      const body = report.details.discreetReporting
        ? t("queue.sla.discreet")
        : `${report.category} · ${report.id}`;
      try {
        new Notification(t("queue.sla.title"), { body, tag: report.id });
      } catch {
        // Some browsers (Chrome on Android) refuse the Notification
        // constructor outright and require a service worker. The alert still
        // has to reach the official, so it falls back to an in-page toast.
        showToast(t("queue.sla.toast"), "danger");
      }
    }

    function check() {
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const now = Date.now();
      for (const report of slaSource.current.emergency) {
        if (slaSource.current.resolved[report.id] || announcedBreaches().has(report.id)) continue;
        if (now - new Date(report.details.submittedAt).getTime() < TIER0_SLA_MS) continue;
        rememberBreach(report.id);
        notifyBreach(report);
      }
    }

    check();
    const id = window.setInterval(check, SLA_CHECK_MS);
    return () => window.clearInterval(id);
    // t changes with the language; the rerun re-checks immediately, and the
    // notified set above means nothing already announced is announced again.
  }, [prefs.slaBreachBrowserNotification, showToast, t]);

  /**
   * Moves the official to the next report awaiting a decision: scrolls the
   * top row of the active tab into view and puts focus on its Validate
   * button, so the keyboard is already where the work is.
   *
   * It does NOT validate anything, and it does not open the detail drawer —
   * that opens from a row's Details button. The button previously claimed
   * to open a report for validation when no such view existed.
   */
  function handleValidateNext() {
    // Always the top report in PRIORITY order, whatever the list is sorted
    // by: a date sort must not let the desk skip an urgent report. Under the
    // default sort the first button in the DOM already is that report.
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-validate-button]") ?? []
    );
    let target: HTMLButtonElement | undefined = buttons[0];
    if (sort !== "priority" && buttons.length > 0) {
      const byId = new Map(buttons.map((b) => [b.dataset.reportId, b]));
      const top = sortReports(
        rows.filter((r) => byId.has(r.id)),
        "priority"
      )[0];
      target = (top && byId.get(top.id)) || buttons[0];
    }
    if (!target) {
      showToast(t("queue.nothingToValidate"), "info");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    target.focus();
  }

  // The local [resolved] mark bridges the moment between a decision and the
  // refreshed data arriving. Once the server says a report is past review,
  // its real state wins — otherwise a report validated from the Emergency
  // tab reappears in Recent validated still wearing its collapsed
  // [Validated] mark, hiding the Route button it now needs.
  // A group validated as one marks each validated member's row, as a single
  // decision does, until the refresh takes them off the pending tabs.
  const markValidated = useCallback((ids: string[]) => {
    setResolved((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = "validated";
      return next;
    });
  }, []);

  function showAutoRouted() {
    setActiveTab("emergency");
    // After the tab renders its strip.
    window.setTimeout(() => {
      const strip = document.getElementById("recall-strip");
      strip?.scrollIntoView({ behavior: "smooth", block: "start" });
      strip?.focus();
    }, 0);
    const ids = unreadAutoRouted;
    if (ids.length === 0) return;
    void callAction(() => markAutoRoutedSeen(ids)).then((answer) => {
      if (answer?.ok) setSeenNotifications((prev) => new Set([...prev, ...ids]));
    });
  }

  function renderRow(report: QueueReport) {
    return (
      <ReportRow
        key={report.id}
        report={report}
        resolvedAs={isReviewable(report.details.status) ? resolved[report.id] : undefined}
        justArrived={arrivedIds.has(report.id)}
        now={now}
        onResolved={(verdict) => setResolved((prev) => ({ ...prev, [report.id]: verdict }))}
        onOpenDetails={() => {
          setChatFocus(false);
          setSelected(report);
        }}
        onOpenChat={() => {
          setChatFocus(true);
          setSelected(report);
        }}
      />
    );
  }

  return (
    <AppShell
      breadcrumb={[official.barangayName, t("nav.queue")]}
      official={official}
      /* [Manual report] was removed here. incident_reports has exactly one
         INSERT policy — ir_insert_resident, auth_role() = 'resident' AND
         user_id = auth.uid() — so a barangay official cannot file a report at
         all, on anyone's behalf. The button fired a toast saying a form had
         opened; no form existed, and none could work without a backend
         change. */
      actions={
        <>
          {unreadAutoRouted.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              onClick={showAutoRouted}
              aria-label={t("recall.badgeLabel", { count: unreadAutoRouted.length })}
            >
              {t("recall.badge", {
                count:
                  unreadAutoRouted.length >= UNREAD_AUTO_ROUTED_LIMIT
                    ? `${UNREAD_AUTO_ROUTED_LIMIT}+`
                    : unreadAutoRouted.length,
              })}
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={handleValidateNext}>
            {t("queue.validateNext")}
          </Button>
        </>
      }
      search={{
        value: query,
        onChange: setQuery,
        placeholder: t("queue.searchPlaceholder"),
        label: t("queue.searchLabel"),
      }}
    >
      {queueData.loadFailed && <DataUnavailableBanner what={t("banner.what.queue")} />}
      <KpiHeader
        // Admin roles only (recentActivity is loaded for them alone).
        duplicateCount={recentActivity ? queueData.queueByTab.duplicates.length : undefined}
        sanctionCounts={sanctionCounts}
        showMaliciousTrack={official.role === "senior_barangay_admin"}
        summary={
          now === null
            ? queueData.kpiSummary
            : {
                ...queueData.kpiSummary,
                // Pending is exactly these two tabs; Flagged duplicates holds
                // members of them, not extra reports.
                medianMinutes: medianAgeMinutes(
                  [...queueData.queueByTab.emergency, ...queueData.queueByTab.standard].map(
                    (r) => r.details.submittedAt
                  ),
                  now
                ),
              }
        }
      />

      {/* RECALL-UI: reports routed without a review here, at the top of the
          Emergency tab, where an official coming back to the desk looks
          first (spec Q1: a strip, not a fifth tab). */}
      {activeTab === "emergency" && !queueData.loadFailed && (
        <RecallStrip
          reports={queueData.autoRouted}
          unavailable={queueData.autoRoutedUnavailable}
          capped={queueData.autoRoutedCapped}
          onOpenDetails={(report) => {
            setChatFocus(false);
            setSelected(report);
          }}
        />
      )}

      {activeTab === "emergency" && queueData.activeCluster && (
        // Keyed on the cluster: its local [resolved] flag must not carry over
        // to a different cluster that takes its place after a refresh.
        <ClusterCard
          key={queueData.activeCluster.id}
          cluster={queueData.activeCluster}
          now={now}
          onValidated={markValidated}
        />
      )}

      <QueueTabs
        tabs={queueData.queueTabMeta}
        activeTab={activeTab}
        onChange={setActiveTab}
        trailing={
          activeTab === "validated" ? null : (
            <label className="flex items-center gap-2 text-xs font-medium text-ink-700">
              {t("queue.sort.label")}
              <select
                value={sort}
                onChange={(e) => {
                  if (isQueueSort(e.target.value)) setSort(e.target.value);
                }}
                className="min-h-11 rounded-md border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
              >
                {QUEUE_SORTS.map((s) => (
                  <option key={s} value={s}>
                    {t(`queue.sort.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />

      {activeTab === "validated" && queueData.validatedUnavailable && (
        <p role="status" className="mb-2 text-xs text-priority-medium">
          {t("queue.partialLoad")}
        </p>
      )}

      <div
        ref={listRef}
        // Holds refreshes while the pointer is over the rows — see tryRefresh.
        onPointerEnter={() => {
          pointerOverList.current = true;
        }}
        onPointerLeave={() => {
          pointerOverList.current = false;
          tryRefresh();
        }}
        role="tabpanel"
        id={queuePanelDomId(activeTab)}
        aria-labelledby={queueTabDomId(activeTab)}
        className="overflow-hidden rounded-card border border-ink-100 bg-white shadow-panel"
      >
        {rows.length === 0 ? (
          activeTab === "duplicates" && !isFiltered && !queueData.loadFailed ? (
            <DuplicatesEmpty />
          ) : (
            <p className="px-4 py-10 text-center text-sm text-ink-500">
              {isFiltered
                ? t("queue.noMatch", { query: query.trim() })
                : queueData.loadFailed
                  ? t("queue.loadFailedEmpty")
                  : t("queue.empty")}
            </p>
          )
        ) : activeTab === "validated" ? (
          // Two groups, because they ask different things of the official:
          // the first still needs routing — nothing sends a validated report
          // anywhere on its own — and the second is there to watch.
          <>
            <RowGroup
              title={t("queue.group.awaitingRouting")}
              rows={rows.filter((r) => r.details.status === "validated")}
              renderRow={renderRow}
            />
            <RowGroup
              title={t("queue.group.routed")}
              rows={rows.filter((r) => r.details.status !== "validated")}
              renderRow={renderRow}
            />
          </>
        ) : activeTab === "duplicates" ? (
          // One section per group, so the official sees which reports the
          // system grouped, and can validate any group as one.
          queueData.duplicateClusters.map((cluster) => (
            <DuplicateGroup
              key={cluster.id}
              cluster={cluster}
              rows={rows.filter((r) => r.details.clusterId === cluster.id)}
              renderRow={renderRow}
              onValidated={markValidated}
            />
          ))
        ) : (
          rows.map(renderRow)
        )}
      </div>

      <p className="mt-3 text-xs text-ink-500">
        {isFiltered
          ? t(unfilteredCount === 1 ? "queue.footer.filteredOne" : "queue.footer.filtered", {
              shown: rows.length,
              total: unfilteredCount,
            })
          : rows.length === 1
            ? t("queue.footer.countOne")
            : t("queue.footer.count", { count: rows.length })}
        {/* Says how the pending tabs are ordered. Nearly every emergency
            scores Critical, so without this the order looks arbitrary among
            identical red badges. Recent validated is ordered by review time,
            so it doesn't get the line. */}
        {activeTab !== "validated" && ` · ${t(
          sort === "newest"
            ? "queue.footer.rankedNewest"
            : sort === "oldest"
              ? "queue.footer.rankedOldest"
              : "queue.footer.ranked"
        )}`}
        {" · "}
        {freshness === "live" && t("queue.footer.live")}
        {freshness === "polling" && t("queue.footer.polling", { seconds: REFRESH_INTERVAL_MS / 1000 })}
        {freshness === "connecting" && t("queue.footer.connecting")}
        {receivedAt && ` · ${t("queue.footer.dataAsOf", { time: formatClock(receivedAt) })}`}
        {updateWaiting && ` · ${t("queue.footer.updateWaiting")}`}
        {prefs.audibleAlertNewEmergency && soundLocked && ` · ${t("queue.footer.soundLocked")}`}
      </p>

      {/* Admin roles only (recentActivity is loaded for them alone). */}
      {recentActivity && <AdminShortcuts role={official.role} />}
      {recentActivity && <RecentActivity data={recentActivity} />}

      {selected && selectedReport && (
        <ReportDetailPanel
          key={selected.id}
          report={selectedReport}
          focusChat={chatFocus}
          onClose={() => setSelected(null)}
          onResolved={(verdict) =>
            setResolved((prev) => ({ ...prev, [selected.id]: verdict }))
          }
        />
      )}

      {/* Above the strip, the table and the drawer; keyed by report, so it
          keeps its text while the report's state changes under it. */}
      {recall.openFor && (
        <RecallModal
          key={recall.openFor}
          reportId={recall.openFor}
          report={findReport(recall.openFor)}
          mark={recall.marks[recall.openFor] ?? null}
          busy={recall.isPending}
          onCancel={recall.cancel}
          onConfirm={recall.recall}
        />
      )}
    </AppShell>
  );
}

/**
 * The Flagged duplicates tab's empty state. Until the backend writes clusters
 * back onto reports, it must not read as [no duplicates found]: the tab is
 * empty whatever has been filed, and the backend owner asked for that to be
 * said on screen (2026-09-17). Once write-back is live (DUPLICATE_WRITEBACK_LIVE)
 * an empty tab does mean nothing is grouped, and the copy says how grouping
 * works instead, including for reports without a location, which the backend
 * groups by category and barangay.
 */
function DuplicatesEmpty() {
  const t = useT();
  const live = DUPLICATE_WRITEBACK_LIVE;
  return (
    <div className="px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink-700">{t(live ? "queue.dup.titleLive" : "queue.dup.title")}</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
        {t(live ? "queue.dup.bodyLive" : "queue.dup.body")}
      </p>
    </div>
  );
}

function RowGroup({
  title,
  rows,
  renderRow,
}: {
  title: string;
  rows: QueueReport[];
  renderRow: (report: QueueReport) => React.ReactNode;
}) {
  if (rows.length === 0) return null;
  return (
    <section>
      <h3 className="border-b border-ink-100 bg-ink-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {title} &middot; {rows.length}
      </h3>
      {rows.map(renderRow)}
    </section>
  );
}

// Manila, like every other time on the console.
function formatClock(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
