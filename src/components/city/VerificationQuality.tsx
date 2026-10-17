"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/ui/PrintButton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/downloadCsv";
import { cx, manilaTimestamp } from "@/lib/utils";
import { useT, type Translate } from "@/lib/i18n";
// Type-only imports from a server-only module — erased at compile time.
import type { BarangayVerification, CityVerificationData } from "@/lib/data/cityVerification";
import { EmptyState } from "@/components/ui/EmptyState";

/** [2 of 5 (40%)], a dash when there is nothing to take a share of. */
function share(part: number | null, whole: number | null, t: Translate): string {
  if (part === null || whole === null || whole === 0) return "—";
  return t("common.shareOf", { part, whole, percent: Math.round((part / whole) * 100) });
}

/** The view as CSV rows, header first. Counts only, so its export writes no access record. */
export function verificationQualityCsvRows(data: Pick<CityVerificationData, "barangays" | "windowDays">): (string | number)[][] {
  return [
    [
      "Barangay",
      `Tier 1 promotions (${data.windowDays} days)`,
      "Revoked since",
      "Verifying officials",
      "Closed reports by verified residents",
      "Closed as false",
    ],
    ...data.barangays.map((b) => [
      b.name ?? "Barangay name unavailable",
      b.promotions,
      b.revoked,
      b.officials,
      b.closedReports ?? "",
      b.falseReports ?? "",
    ]),
  ];
}

/**
 * The thesis's Cross-Barangay Verification Quality view (A.5.2): per
 * barangay, the Tier 1 promotions of the last 30 days, how many were later
 * revoked, how many officials made them, the share of verified residents'
 * closed reports that were closed as false, and a day-by-day trend.
 *
 * Counts only: no official and no resident is named. A barangay whose false
 * share is above the city's is marked in words as well as by its border.
 */
export function VerificationQuality({ data }: { data: CityVerificationData }) {
  const t = useT();
  const { showToast } = useToast();
  const { barangays, totals, windowDays, outcomesUnavailable, loadFailed } = data;
  // One scale for every row's trend, so a busy barangay looks busy.
  const peak = Math.max(1, ...barangays.flatMap((b) => b.daily));

  function handleExport() {
    if (barangays.length === 0) {
      showToast(t("city.response.exportNothing"), "info");
      return;
    }
    const day = manilaTimestamp(new Date().toISOString()).slice(0, 10);
    downloadCsv(`verification-quality-${day}.csv`, verificationQualityCsvRows(data));
    showToast(t("city.verification.exported"), "success");
  }

  return (
    <section aria-labelledby="city-verification-title" data-printable="verification-quality" className="mb-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="city-verification-title" className="text-sm font-semibold text-ink-900">
            {t("city.verification.title")}
          </h2>
          <p className="text-xs text-ink-500">{t("city.verification.intro", { days: windowDays })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" disabled={loadFailed} onClick={handleExport}>
            {t("history.export")}
          </Button>
          <PrintButton section="verification-quality" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <Tile label={t("city.verification.tile.promotions")} value={totals.promotions} accent="brand" />
        <Tile label={t("city.verification.tile.revoked")} value={share(totals.revoked, totals.promotions, t)} />
        <Tile label={t("city.verification.tile.false")} value={share(totals.falseReports, totals.closedReports, t)} />
      </div>

      {outcomesUnavailable && !loadFailed && (
        <p role="status" className="mb-2 text-xs text-priority-medium">
          {t("city.verification.outcomesUnavailable")}
        </p>
      )}

      {barangays.length === 0 ? (
        !loadFailed && (
          <EmptyState icon="verify">
            <p className="text-sm text-ink-500">{t("city.verification.empty", { days: windowDays })}</p>
          </EmptyState>
        )
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel print:overflow-visible">
          <table className="w-full min-w-[820px] text-left text-sm print:min-w-0">
            <caption className="sr-only">{t("city.verification.caption", { days: windowDays })}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.col.barangay")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.verification.col.promotions")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("reports.verification.col.revoked")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.verification.col.officials")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.verification.col.false")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.verification.col.trend", { days: windowDays })}</th>
              </tr>
            </thead>
            <tbody>
              {barangays.map((b) => (
                <tr
                  key={b.barangayId}
                  className={cx(
                    "border-b border-ink-100 last:border-0",
                    // Amber-bordered, as the thesis draws an outlier; the chip
                    // in the row says the same in words.
                    b.aboveCityRate && "border-l-4 border-l-priority-high"
                  )}
                >
                  <th scope="row" className="px-4 py-2.5 text-left text-xs font-medium text-ink-900">
                    {b.name ?? t("city.unnamedBarangay")}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{b.promotions}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{share(b.revoked, b.promotions, t)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{b.officials}</td>
                  <td className="px-4 py-2.5 text-right text-ink-700">
                    <span className="tabular-nums">{share(b.falseReports, b.closedReports, t)}</span>
                    {b.aboveCityRate && (
                      <span className="ml-2 inline-block">
                        <Badge tone="warning">{t("city.verification.aboveCity")}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Trend row={b} peak={peak} days={windowDays} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {t("city.verification.footer", { min: data.minClosedForFlag })}
        {data.capped && ` ${t("city.verification.capped", { limit: data.limit })}`}
      </p>
    </section>
  );
}

// Promotions per day, oldest on the left. Decorative: the promotions column
// carries the number, and the busiest day is said for a screen reader.
function Trend({ row, peak, days }: { row: BarangayVerification; peak: number; days: number }) {
  const t = useT();
  const busiest = Math.max(0, ...row.daily);
  return (
    <div>
      {/* Background colours are dropped in print unless asked for. */}
      <div aria-hidden className="flex h-8 items-end gap-px [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
        {row.daily.map((count, i) => (
          <span
            key={i}
            className={count > 0 ? "w-1 rounded-sm bg-brand-500" : "w-1 rounded-sm bg-ink-100"}
            style={{ height: count > 0 ? `${Math.max(15, (count / peak) * 100)}%` : "2px" }}
          />
        ))}
      </div>
      <span className="sr-only">{t("city.verification.trendSummary", { days, busiest })}</span>
    </div>
  );
}
