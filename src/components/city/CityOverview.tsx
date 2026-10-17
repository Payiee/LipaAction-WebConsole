"use client";

import { Tile } from "@/components/ui/Tile";
import { useT } from "@/lib/i18n";
// Type-only import from a server-only module — erased at compile time.
import type { BarangayActivity, CityOverviewData } from "@/lib/data/cityOverview";
import { PrintButton } from "@/components/ui/PrintButton";

/**
 * The city dashboard's overview: city-wide tiles, then one row per barangay
 * with its last 7 days drawn as bars. Read-only; see getCityOverview for what
 * is counted.
 */
export function CityOverview({ overview }: { overview: CityOverviewData }) {
  const t = useT();
  const { totals, barangays, days, loadFailed } = overview;

  return (
    <section aria-labelledby="city-overview-title" data-printable="overview" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="city-overview-title" className="text-sm font-semibold text-ink-900">
            {t("city.overview.title")}
          </h2>
          <p className="text-xs text-ink-500">{t("city.overview.intro")}</p>
        </div>
        {/* The city-wide summary is what gets printed for a meeting. */}
        <div className="print:hidden">
          <PrintButton section="overview" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <Tile label={t("city.tile.today")} value={totals.today} />
        <Tile label={t("city.tile.average")} value={totals.dailyAverage.toFixed(1)} />
        <Tile label={t("city.tile.awaiting")} value={totals.awaitingReview} accent="critical" />
        <Tile label={t("city.tile.critical")} value={totals.criticalAwaiting} accent="critical" />
        <Tile
          label={t("city.tile.pastSla", { minutes: overview.slaMinutes })}
          value={totals.emergenciesPastSla}
          accent="critical"
        />
      </div>

      {barangays.length === 0 ? (
        // Under a load failure the banner already says nothing is current;
        // [no reports were filed] would be a claim.
        !loadFailed && (
          <div className="rounded-card border border-ink-100 bg-white px-4 py-10 text-center shadow-panel">
            <p className="text-sm text-ink-500">{t("city.overview.empty")}</p>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel print:overflow-visible">
          <table className="w-full min-w-[760px] text-left text-sm print:min-w-0">
            <caption className="sr-only">{t("city.overview.caption")}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.col.barangay")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.col.daily")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.col.week")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.col.today")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.col.awaiting")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.col.validated")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.col.rejected")}</th>
              </tr>
            </thead>
            <tbody>
              {barangays.map((b) => (
                <tr key={b.barangayId ?? "none"} className="border-b border-ink-100 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-xs font-medium text-ink-900">
                    {barangayLabel(b, t)}
                  </th>
                  <td className="px-4 py-2.5">
                    <DailyBars counts={b.daily} days={days} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{b.week}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{b.today}</td>
                  <td
                    className={
                      b.awaitingReview > 0
                        ? "px-4 py-2.5 text-right font-semibold tabular-nums text-priority-critical"
                        : "px-4 py-2.5 text-right tabular-nums text-ink-700"
                    }
                  >
                    {b.awaitingReview}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{b.validated}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{b.rejected}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {t("city.overview.footer", { time: formatTime(overview.asOf) })}
        {overview.capped && ` ${t("city.capped", { limit: overview.limit })}`}
      </p>
    </section>
  );
}

function barangayLabel(b: BarangayActivity, t: ReturnType<typeof useT>): string {
  if (b.barangayId === null) return t("city.noBarangay");
  return b.name ?? t("city.unnamedBarangay");
}

/**
 * Seven bars, oldest day first, scaled to the row's busiest day. The counts
 * are also given as text, for screen readers and on hover, so the bars never
 * carry a number on their own.
 */
function DailyBars({ counts, days }: { counts: number[]; days: string[] }) {
  const t = useT();
  const max = Math.max(1, ...counts);
  const described = counts
    .map((count, i) => t("city.dayCount", { day: formatDay(days[i]), count }))
    .join(", ");

  return (
    <div className="flex h-8 items-end gap-1" role="img" aria-label={described} title={described}>
      {counts.map((count, i) => (
        <span
          key={days[i]}
          aria-hidden
          className={count > 0 ? "w-3 rounded-sm bg-brand-500" : "w-3 rounded-sm bg-ink-100"}
          style={{ height: count > 0 ? `${Math.max(15, (count / max) * 100)}%` : "3px" }}
        />
      ))}
    </div>
  );
}

// [Sep 24]. Noon Manila, so the day can't shift in any zone.
function formatDay(date: string): string {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
