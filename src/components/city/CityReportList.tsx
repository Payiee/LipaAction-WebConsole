"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { CategoryMultiSelect, matchesCategories } from "@/components/ui/CategoryMultiSelect";
import { useToast } from "@/components/ui/Toast";
import { useRecordedExport } from "@/components/ui/useRecordedExport";
import { downloadCsv } from "@/lib/downloadCsv";
import { statusLabel } from "@/components/queue/useReportReview";
import { splitRouting, agencyProgressLabel } from "@/components/queue/routing";
import { cx, manilaTimestamp } from "@/lib/utils";
import { translate, useT, type MessageKey, type Translate } from "@/lib/i18n";
import { CityReportDrawer, barangayOf, formatTimestamp } from "./CityReportDrawer";
// Type-only imports from a server-only module — erased at compile time.
import type { CityReport, CityReportsData, CityStatusFilter } from "@/lib/data/cityReports";
import { EmptyState } from "@/components/ui/EmptyState";

// The loader's filter keys, listed here because a client component can't
// import a value from a server-only module. The type keeps the two in step.
const STAGES: { value: CityStatusFilter; label: MessageKey }[] = [
  { value: "all", label: "city.stage.all" },
  { value: "awaiting", label: "city.stage.awaiting" },
  { value: "validated", label: "city.stage.validated" },
  { value: "withAgencies", label: "city.stage.withAgencies" },
  { value: "rejected", label: "city.stage.rejected" },
];

/**
 * Every report filed in the city over the window, newest first, filterable
 * by barangay and stage. The filters live in the URL, so the server does the
 * narrowing and a filtered view can be reloaded.
 *
 * The list shows no description: the resident's own words appear only in
 * the drawer, whose opening is recorded in the access log.
 *
 * Categories filter in the page, several at once, over the reports already
 * loaded (agencies' request, 2026-10-14), and the CSV holds exactly the rows
 * on screen.
 */
export function CityReportList({ data }: { data: CityReportsData }) {
  const t = useT();
  const router = useRouter();
  // A report named in the URL (from the city map) opens on arrival, if it is
  // in this list. Its drawer records the opening like any other.
  const [openId, setOpenId] = useState<string | null>(() =>
    data.open && data.reports.some((r) => r.id === data.open) ? data.open : null
  );
  const open = data.reports.find((r) => r.id === openId) ?? null;
  const { showToast } = useToast();
  const { record, busy } = useRecordedExport();
  const [categories, setCategories] = useState<string[]>([]);
  const categoryOptions = useMemo(() => [...new Set(data.reports.map((r) => r.category))].sort(), [data.reports]);
  const shown = useMemo(
    () => data.reports.filter((r) => matchesCategories(r.category, categories)),
    [data.reports, categories]
  );
  const byCategory = shown.length !== data.reports.length;

  // One row per report and no names, but more than a count, so the export is
  // written to the access trail first, like the other per-row exports.
  async function handleExport() {
    if (shown.length === 0) {
      showToast(t("city.reports.exportNothing"), "info");
      return;
    }
    if (!(await record("city_reports_csv", shown.length))) return;
    const day = manilaTimestamp(new Date().toISOString()).slice(0, 10);
    downloadCsv(`city-reports-${day}.csv`, cityReportsCsv(shown));
    showToast(t("city.reports.exported", { count: shown.length }), "success");
  }
  const openMissing = data.open !== null && !data.loadFailed && !data.reports.some((r) => r.id === data.open);

  function closeDrawer() {
    setOpenId(null);
    // Off the URL once closed, so a reload doesn't open it again unasked.
    if (data.open) navigate({});
  }

  function navigate(next: { barangay?: string | null; status?: CityStatusFilter }) {
    const barangay = next.barangay !== undefined ? next.barangay : data.barangay;
    const status = next.status ?? data.status;
    const params = new URLSearchParams();
    if (barangay) params.set("barangay", barangay);
    if (status !== "all") params.set("status", status);
    const query = params.toString();
    router.push(query ? `/city/reports?${query}` : "/city/reports");
  }

  const filtered = data.barangay !== null || data.status !== "all" || byCategory;

  return (
    <section aria-labelledby="city-reports-title" className="mb-6">
      <div className="mb-3">
        <h2 id="city-reports-title" className="text-sm font-semibold text-ink-900">
          {t("city.reports.title")}
        </h2>
        <p className="text-xs text-ink-500">{t("city.reports.intro", { days: data.windowDays })}</p>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-700">
          {t("city.col.barangay")}
          <select
            value={data.barangay ?? ""}
            onChange={(e) => navigate({ barangay: e.target.value || null })}
            className="min-h-11 rounded-md border border-ink-100 bg-white px-4 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
          >
            <option value="">{t("city.filter.allBarangays")}</option>
            {data.barangays.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <div role="group" aria-label={t("city.filter.stage")} className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={data.status === s.value}
              onClick={() => navigate({ status: s.value })}
              className={cx(
                "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
                data.status === s.value
                  ? "border-brand-500 bg-brand-100 text-brand-700"
                  : "border-ink-100 bg-white text-ink-700 hover:bg-ink-100"
              )}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
        {categoryOptions.length > 1 && (
          <CategoryMultiSelect options={categoryOptions} chosen={categories} onChange={setCategories} />
        )}
        <div className="ml-auto flex flex-col items-end gap-1">
          <Button variant="secondary" size="sm" disabled={busy || data.loadFailed} onClick={handleExport}>
            {busy ? t("common.working") : t("city.reports.export")}
          </Button>
          <p className="text-xs text-ink-500">{t("export.recordedNote")}</p>
        </div>
      </div>

      {openMissing && (
        <p role="note" className="mb-3 text-xs text-ink-700">
          {t("city.reports.openMissing", { days: data.windowDays, limit: data.limit })}
        </p>
      )}

      {shown.length === 0 ? (
        !data.loadFailed && (
          <EmptyState icon="queue">
            <p className="text-sm text-ink-500">
              {t(filtered ? "city.reports.emptyFiltered" : "city.reports.empty", { days: data.windowDays })}
            </p>
          </EmptyState>
        )
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel">
          <table className="w-full min-w-[860px] text-left text-sm">
            <caption className="sr-only">{t("city.reports.caption")}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.reports.col.submitted")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.col.barangay")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("reports.col.category")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("drawer.priority")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("drawer.status")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.reports.col.agencies")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">
                  <span className="sr-only">{t("city.reports.col.open")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-700">{formatTimestamp(r.submittedAt)}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-900">{barangayOf(r, t)}</td>
                  <th scope="row" className="px-4 py-2.5 text-xs font-medium text-ink-900">
                    {r.category}
                    {r.discreetReporting && (
                      <span
                        title={t("drawer.discreetBanner")}
                        className="ml-2 rounded-full bg-priority-mediumBg px-2 py-0.5 text-xs font-semibold text-priority-medium"
                      >
                        {t("row.discreet")}
                      </span>
                    )}
                  </th>
                  <td className="px-4 py-2.5">
                    <PriorityBadge priority={r.priority} score={r.priorityScore} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-ink-700">{statusLabel(r.status, t)}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-700">{agencySummary(r, t)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setOpenId(r.id)}
                      aria-label={t("row.viewDetails", { id: r.id })}
                    >
                      {t("city.reports.open")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {byCategory && `${t("city.reports.categoriesShown", { shown: shown.length, count: data.reports.length })} `}
        {t("city.reports.footer", { count: shown.length })}
        {data.capped && ` ${t("city.reports.capped", { limit: data.limit })}`}
      </p>

      {open && <CityReportDrawer report={open} onClose={closeDrawer} />}
    </section>
  );
}

// The list as CSV, header first: exactly the columns the list shows, in
// English whatever the interface language, like every file that leaves the
// console. No description and no reporter, as on screen.
function cityReportsCsv(reports: CityReport[]): (string | number)[][] {
  const en: Translate = (key, vars) => translate("en", key, vars);
  return [
    ["Report ID", "Submitted", "Barangay", "Category", "Sub-category", "Entry tier", "Priority", "Priority score", "Status", "Agencies"],
    ...reports.map((r) => [
      r.id,
      manilaTimestamp(r.submittedAt),
      barangayOf(r, en),
      r.category,
      r.subCategory ?? "",
      r.entryTier === "emergency" ? "Emergency" : "Other report",
      r.priority ?? "Not scored",
      r.priorityScore ?? "",
      statusLabel(r.status, en),
      agencySummary(r, en),
    ]),
  ];
}

// [Bureau of Fire Protection +1 · Acknowledged], from the agencies holding
// the report now; ones that sent it back before a re-route aren't counted.
function agencySummary(r: CityReport, t: Translate): string {
  // Before the agency rows: this report never had any, by design.
  if (r.resolvedAtBarangay) return t("history.resolution.resolvedAtBarangay");
  if (r.routing === null) return t("city.reports.agenciesUnavailable");
  if (r.routing.length === 0) return "—";
  const { current } = splitRouting(r.routing);
  const lead = current[0] ?? r.routing[0];
  const more = current.length > 1 ? ` +${current.length - 1}` : "";
  return `${lead.agencyName}${more} · ${agencyProgressLabel(lead, t)}`;
}
