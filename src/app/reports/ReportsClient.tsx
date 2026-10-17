"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DataUnavailableBanner } from "@/components/layout/DataUnavailableBanner";
import { DailyQueueSummary } from "@/components/reports/DailyQueueSummary";
import { ReportCatalogue } from "@/components/reports/ReportCatalogue";
import { ResolutionTimes } from "@/components/reports/ResolutionTimes";
import { VerificationActivity } from "@/components/reports/VerificationActivity";
import { REPORT_PANEL_ID, ReportTabs, reportTabId, type ReportView } from "@/components/reports/ReportTabs";
import { useT } from "@/lib/i18n";
import type { OfficialProfile } from "@/lib/auth";
// Type-only import from a server-only module — erased at compile time.
import type { DailyQueueSummaryData } from "@/lib/data/dailyQueueSummary";
import type { ResolutionTimesData } from "@/lib/data/resolutionTimes";
import type { VerificationActivityData } from "@/lib/data/verificationActivity";

const VIEW_KEY = "lipaaction.console.reportsView.v1";

export function ReportsClient({
  official,
  summary,
  resolution,
  verification,
}: {
  official: OfficialProfile;
  summary: DailyQueueSummaryData;
  resolution: ResolutionTimesData;
  verification: VerificationActivityData;
}) {
  const t = useT();
  // One report at a time. Held here, not in the address: each report's own
  // day, week or month already lives there, and choosing one of those is a
  // navigation this component survives, so the chosen tab stays put. A
  // reload brings it back from this tab's session storage, after the first
  // paint (the server can't read it), and falls back to Daily.
  const [view, setView] = useState<ReportView>("daily");
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(VIEW_KEY);
      if (saved === "weekly" || saved === "monthly") setView(saved);
    } catch {
      // Storage refused (a private window): Daily it is.
    }
  }, []);
  function chooseView(next: ReportView) {
    setView(next);
    try {
      sessionStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; the choice still holds until a reload.
    }
  }

  return (
    <AppShell breadcrumb={[official.barangayName, t("nav.reports")]} official={official}>
      {/* The daily summary's failure takes the page banner; the weekly and
          monthly reports each say their own failure inside their section, so
          a failure of one never claims the others are out of date. */}
      {summary.loadFailed && <DataUnavailableBanner what={t("banner.what.reports")} />}
      <ReportTabs view={view} onChange={chooseView} />
      {/* In the catalogue's order: #12 daily, #13 weekly, #16 monthly. */}
      <div
        key={view}
        role="tabpanel"
        id={REPORT_PANEL_ID}
        aria-labelledby={reportTabId(view)}
        className="motion-safe:animate-fadeIn"
      >
        {view === "daily" && (
          <DailyQueueSummary
            summary={summary}
            barangayName={official.barangayName}
            month={resolution.month}
            currentMonth={resolution.currentMonth}
            week={verification.weekEnd}
          />
        )}
        {view === "weekly" && (
          <VerificationActivity
            data={verification}
            date={summary.date}
            month={resolution.month}
            currentMonth={resolution.currentMonth}
            barangayName={official.barangayName}
          />
        )}
        {view === "monthly" && (
          <ResolutionTimes
            data={resolution}
            date={summary.date}
            week={verification.weekEnd}
            today={summary.today}
            barangayName={official.barangayName}
          />
        )}
      </div>
      {/* The rest of the thesis's barangay catalogue, #14 included: listed,
          not faked. */}
      <ReportCatalogue />
    </AppShell>
  );
}
