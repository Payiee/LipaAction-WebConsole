"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CategoryMultiSelect, matchesCategories } from "@/components/ui/CategoryMultiSelect";
import { PrintButton } from "@/components/ui/PrintButton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/downloadCsv";
import { useT } from "@/lib/i18n";
import { reportsHref } from "./reportsHref";
// Type-only import from a server-only module — erased at compile time.
import type { DailyCounts, DailyQueueSummaryData } from "@/lib/data/dailyQueueSummary";

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

// Typing a year into a date field fires a change per keystroke (0002, 0020,
// 0202, 2026), each a valid date. Waiting for the typing to stop loads the
// day once instead of four times.
const DATE_SETTLE_MS = 400;

/**
 * The paper's Daily Queue Summary (#12): the chosen day's reports by
 * category, counted by where each stands now. The day lives in the URL, so
 * picking one is a navigation and the server does the counting — see
 * getDailyQueueSummary for what is and isn't counted.
 */
export function DailyQueueSummary({
  summary,
  barangayName,
  month,
  currentMonth,
  week,
}: {
  summary: DailyQueueSummaryData;
  barangayName: string;
  // The monthly report's month and the weekly report's last day, kept in the
  // URL when the day changes.
  month: string;
  currentMonth: string;
  week: string;
}) {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const { date, today, rows: allRows, totals: allTotals, loadFailed } = summary;
  const settleTimer = useRef<number | undefined>(undefined);
  // Several categories at once, so the file holds only the ones an office
  // wants (agencies' request, 2026-10-14). The tiles, the table, the CSV and
  // a print all follow the choice; nothing ticked means every category.
  const [categories, setCategories] = useState<string[]>([]);
  const categoryOptions = useMemo(() => allRows.map((r) => r.category), [allRows]);
  const rows = useMemo(() => allRows.filter((r) => matchesCategories(r.category, categories)), [allRows, categories]);
  const narrowed = rows.length !== allRows.length;
  const totals = narrowed ? sumCounts(rows) : allTotals;

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  function showDay(next: string) {
    router.push(reportsHref({ date: next, month, week }, { today, currentMonth }));
  }

  function handleDateChange(next: string) {
    window.clearTimeout(settleTimer.current);
    // Empty while the field is cleared or half-typed; nothing to load yet.
    if (!DATE_SHAPE.test(next) || next === date) return;
    settleTimer.current = window.setTimeout(() => showDay(next), DATE_SETTLE_MS);
  }

  // Always English, like the Validation History export: the file is read by
  // other offices.
  function handleExport() {
    if (rows.length === 0) {
      showToast(t("reports.exportNothing"), "info");
      return;
    }
    downloadCsv(`daily-queue-summary-${date}.csv`, [
      ["Date", "Barangay", "Category", "Submitted", "Awaiting review", "Validated", "Rejected"],
      ...rows.map((r) => [date, barangayName, r.category, r.submitted, r.awaitingReview, r.validated, r.rejected]),
      [date, barangayName, "Total", totals.submitted, totals.awaitingReview, totals.validated, totals.rejected],
    ]);
    showToast(t("reports.exported", { date: formatDay(date) }), "success");
  }

  return (
    <section aria-labelledby="daily-summary-title" data-printable="daily" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="daily-summary-title" className="text-sm font-semibold text-ink-900">
            {t("reports.dailyTitle")} &middot; {formatDay(date)}
          </h2>
          <p className="text-xs text-ink-500">{t("reports.dailyIntro")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <label className="flex items-center gap-2 text-xs font-medium text-ink-700">
            {t("reports.date")}
            {/* Uncontrolled, and re-keyed on the day shown: a controlled
                value would snap back to the old day while the new one loads. */}
            <input
              key={date}
              type="date"
              defaultValue={date}
              max={today}
              onChange={(e) => handleDateChange(e.target.value)}
              className="min-h-11 rounded-md border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </label>
          {categoryOptions.length > 1 && (
            <CategoryMultiSelect options={categoryOptions} chosen={categories} onChange={setCategories} />
          )}
          {date !== today && (
            <Button variant="secondary" size="sm" onClick={() => showDay(today)}>
              {t("history.range.today")}
            </Button>
          )}
          <Button variant="secondary" size="sm" disabled={loadFailed} onClick={handleExport}>
            {t("history.export")}
          </Button>
          <PrintButton section="daily" />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <Tile label={t("reports.tile.submitted")} value={totals.submitted} />
        <Tile label={t("reports.tile.awaiting")} value={totals.awaitingReview} accent="critical" />
        <Tile label={t("status.validated")} value={totals.validated} accent="brand" />
        <Tile label={t("status.rejected")} value={totals.rejected} />
      </div>

      {rows.length === 0 ? (
        // Under a load failure the banner already says nothing is current;
        // [no reports were submitted] would be a claim.
        !loadFailed && (
          <div className="rounded-card border border-ink-100 bg-white px-4 py-10 text-center shadow-panel">
            <p className="text-sm text-ink-500">{t("reports.empty", { date: formatDay(date) })}</p>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel">
          <table className="w-full min-w-[560px] text-left text-sm">
            <caption className="sr-only">{t("reports.caption", { date: formatDay(date) })}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("reports.col.category")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("reports.tile.submitted")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("reports.tile.awaiting")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("status.validated")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("status.rejected")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.category} className="border-b border-ink-100 last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-xs font-medium text-ink-900">
                    {r.category}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{r.submitted}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{r.awaitingReview}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{r.validated}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{r.rejected}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-100 bg-ink-50 font-semibold">
                <th scope="row" className="px-4 py-2.5 text-xs text-ink-900">
                  {t("history.tile.total")}
                </th>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{totals.submitted}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{totals.awaitingReview}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{totals.validated}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{totals.rejected}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {narrowed && `${t("reports.categoriesShown", { shown: rows.length, count: allRows.length })} `}
        {t("reports.footer")}
        {summary.capped && ` · ${t("reports.capped", { limit: summary.limit })}`}
      </p>
    </section>
  );
}

function sumCounts(rows: DailyCounts[]): DailyCounts {
  return rows.reduce(
    (sum, r) => ({
      submitted: sum.submitted + r.submitted,
      awaitingReview: sum.awaitingReview + r.awaitingReview,
      validated: sum.validated + r.validated,
      rejected: sum.rejected + r.rejected,
    }),
    { submitted: 0, awaitingReview: 0, validated: 0, rejected: 0 }
  );
}

// [Sep 22, 2026]. Noon Manila, so the day can't shift in any zone; the zone
// is pinned anyway, as everywhere else on the console.
function formatDay(date: string): string {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
