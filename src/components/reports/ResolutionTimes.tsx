"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/ui/PrintButton";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/downloadCsv";
import { formatDuration } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { formatMonth, monthOptions, reportsHref } from "./reportsHref";
// Type-only imports from a server-only module — erased at compile time.
import type { DurationSummary } from "@/lib/durations";
import type { ResolutionTimesData } from "@/lib/data/resolutionTimes";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The paper's Monthly Resolution-Time Distribution by Agency (#16): per
 * agency, how long this barangay's reports took from routing to resolution,
 * over the routings closed in the chosen month. The month lives in the URL,
 * so picking one is a navigation and the server does the counting — see
 * getMonthlyResolutionTimes.
 */
export function ResolutionTimes({
  data,
  date,
  week,
  today,
  barangayName,
}: {
  data: ResolutionTimesData;
  // The daily summary's day and the weekly report's last day, kept in the
  // URL when the month changes.
  date: string;
  week: string;
  today: string;
  barangayName: string;
}) {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const { month, currentMonth, agencies, loadFailed } = data;
  const monthLabel = formatMonth(month);

  // Always English, like the other exports: other offices read the file.
  function handleExport() {
    if (agencies.length === 0) {
      showToast(t("reports.resolution.exportNothing"), "info");
      return;
    }
    downloadCsv(`resolution-times-${month}.csv`, [
      ["Month", "Barangay", "Agency", "Resolved", "Median minutes", "95th percentile minutes", "Returned out of scope"],
      ...agencies.map((a) => [
        month,
        barangayName,
        a.name ?? "Agency name unavailable",
        a.resolved,
        a.time.median ?? "",
        a.time.p95 ?? "",
        a.returned,
      ]),
    ]);
    showToast(t("reports.resolution.exported", { month: monthLabel }), "success");
  }

  return (
    <section aria-labelledby="resolution-title" data-printable="resolution" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="resolution-title" className="text-sm font-semibold text-ink-900">
            {t("reports.resolution.title")} &middot; {monthLabel}
          </h2>
          <p className="text-xs text-ink-500">{t("reports.resolution.intro")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-700">
            {t("reports.resolution.month")}
            <select
              value={month}
              onChange={(e) => router.push(reportsHref({ date, month: e.target.value, week }, { today, currentMonth }))}
              className="min-h-11 rounded-md border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
            >
              {monthOptions(currentMonth, month).map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          </label>
          <Button variant="secondary" size="sm" disabled={loadFailed} onClick={handleExport}>
            {t("history.export")}
          </Button>
          <PrintButton section="resolution" />
        </div>
      </div>

      {loadFailed ? (
        <p
          role="alert"
          className="rounded-card border border-priority-critical/40 bg-priority-criticalBg px-4 py-3 text-xs text-ink-700"
        >
          {t("reports.resolution.failed")}
        </p>
      ) : agencies.length === 0 ? (
        <EmptyState icon="timer">
          <p className="text-sm text-ink-500">{t("reports.resolution.empty", { month: monthLabel })}</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">{t("reports.resolution.caption", { month: monthLabel })}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.response.col.agency")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.response.col.resolved")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("reports.resolution.col.time")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.response.col.returned")}</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.agencyId} className="border-b border-ink-100 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-xs font-medium text-ink-900">
                    {a.name ?? t("city.unnamedAgency")}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{a.resolved}</td>
                  <td className="px-4 py-2.5">
                    <Duration summary={a.time} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{a.returned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {t("reports.resolution.footer", { min: data.minSamplesForP95 })}
        {data.capped && ` · ${t("reports.resolution.capped", { limit: data.limit })}`}
      </p>
    </section>
  );
}

// [median 2h 15m · 95th 6h · 24 timed], the same reading as the city's
// Agency response page.
function Duration({ summary }: { summary: DurationSummary }) {
  const t = useT();
  if (summary.median === null) return <span className="text-xs text-ink-500">{t("city.response.noTiming")}</span>;
  return (
    <div className="leading-tight">
      <p className="text-xs font-medium text-ink-900">
        {t("city.response.median", { value: formatDuration(summary.median) })}
        {summary.p95 !== null && ` · ${t("city.response.p95", { value: formatDuration(summary.p95) })}`}
      </p>
      <p className="text-xs text-ink-500">{t("city.response.samples", { count: summary.samples })}</p>
    </div>
  );
}
