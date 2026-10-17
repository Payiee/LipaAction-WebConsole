"use client";

import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/ui/PrintButton";
import { useToast } from "@/components/ui/Toast";
import { downloadCsv } from "@/lib/downloadCsv";
import { formatDuration, manilaTimestamp } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";
// Type-only import from a server-only module — erased at compile time.
import type { AgencyResponse, CityResponseData, DurationSummary } from "@/lib/data/cityResponseTimes";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The paper's Per-Agency Response Time view (A.5.2), as a table: one row per
 * agency that was routed a report in the window. See getCityResponseTimes
 * for where each clock starts.
 */
export function AgencyResponseTable({ response }: { response: CityResponseData }) {
  const t = useT();
  const { showToast } = useToast();
  const { agencies, windowDays, loadFailed } = response;

  function handleExport() {
    if (agencies.length === 0) {
      showToast(t("city.response.exportNothing"), "info");
      return;
    }
    exportCsv(response);
    showToast(t("city.response.exported"), "success");
  }

  return (
    <section aria-labelledby="city-response-title" data-printable="response" className="mb-6">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="city-response-title" className="text-sm font-semibold text-ink-900">
            {t("city.response.title")}
          </h2>
          <p className="text-xs text-ink-500">{t("city.response.intro", { days: windowDays })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Button variant="secondary" size="sm" disabled={loadFailed} onClick={handleExport}>
            {t("history.export")}
          </Button>
          <PrintButton section="response" />
        </div>
      </div>

      {agencies.length === 0 ? (
        !loadFailed && (
          <EmptyState icon="timer">
            <p className="text-sm text-ink-500">{t("city.response.empty", { days: windowDays })}</p>
          </EmptyState>
        )
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel print:overflow-visible">
          <table className="w-full min-w-[900px] text-left text-sm print:min-w-0">
            <caption className="sr-only">{t("city.response.caption")}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.response.col.agency")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.response.col.routed")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.response.col.awaiting")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("routing.progress.inProgress")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.response.col.toAck")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.response.col.toResolve")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.response.col.resolved")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("city.response.col.returned")}</th>
              </tr>
            </thead>
            <tbody>
              {agencies.map((a) => (
                <tr key={a.agencyId} className="border-b border-ink-100 align-top last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-xs font-medium text-ink-900">
                    {a.name ?? t("city.unnamedAgency")}
                  </th>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{a.routed}</td>
                  <td
                    className={
                      a.awaitingAcknowledgement > 0
                        ? "px-4 py-2.5 text-right font-semibold tabular-nums text-priority-critical"
                        : "px-4 py-2.5 text-right tabular-nums text-ink-700"
                    }
                  >
                    {a.awaitingAcknowledgement}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{a.inProgress}</td>
                  <td className="px-4 py-2.5">
                    <Duration summary={a.toAcknowledge} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Duration summary={a.toResolve} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{a.resolved}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{a.returned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* The paper's two stacked grids (A.5.2): each clock per agency and
          category. Left out when the categories couldn't be read. */}
      {agencies.length > 0 && !response.categoriesUnavailable && response.categories.length > 0 && (
        <>
          <CategoryGrid response={response} clock="toAcknowledge" title="city.response.grid.ack" />
          <CategoryGrid response={response} clock="toResolve" title="city.response.grid.resolve" />
        </>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {t("city.response.footer", { min: response.minSamplesForP95 })}
        {response.capped && ` ${t("city.capped", { limit: response.limit })}`}
      </p>
    </section>
  );
}

function Duration({ summary }: { summary: DurationSummary }) {
  const t = useT();
  if (summary.median === null) {
    return <span className="text-xs text-ink-500">{t("city.response.noTiming")}</span>;
  }
  return (
    <div className="leading-tight">
      <p className="tabular-nums text-ink-900">
        {t("city.response.median", { value: formatDuration(summary.median) })}
      </p>
      <p className="text-xs tabular-nums text-ink-500">
        {summary.p95 !== null && `${t("city.response.p95", { value: formatDuration(summary.p95) })} · `}
        {t("city.response.samples", { count: summary.samples })}
      </p>
    </div>
  );
}

// One clock per agency and category: the median, and how many timings it
// rests on. A dash where an agency had no report of that category.
function CategoryGrid({
  response,
  clock,
  title,
}: {
  response: CityResponseData;
  clock: "toAcknowledge" | "toResolve";
  title: MessageKey;
}) {
  const t = useT();
  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold text-ink-900">{t(title)}</h3>
      <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel print:overflow-visible">
        <table className="w-full text-left text-xs">
          <caption className="sr-only">{t(title)}</caption>
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <th scope="col" className="px-4 py-2 font-semibold">{t("city.response.col.agency")}</th>
              {response.categories.map((c) => (
                <th key={c} scope="col" className="px-3 py-2 font-semibold">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {response.agencies.map((a: AgencyResponse) => (
              <tr key={a.agencyId} className="border-b border-ink-100 last:border-0">
                <th scope="row" className="px-4 py-2 font-medium text-ink-900">
                  {a.name ?? t("city.unnamedAgency")}
                </th>
                {response.categories.map((c) => {
                  const cell = a.byCategory[c];
                  const summary = cell?.[clock];
                  return (
                    <td key={c} className="px-3 py-2 tabular-nums text-ink-700">
                      {!cell ? (
                        "—"
                      ) : summary && summary.median !== null ? (
                        <>
                          {formatDuration(summary.median)}{" "}
                          <span className="text-xs text-ink-500">({summary.samples})</span>
                        </>
                      ) : (
                        <span className="text-ink-500">{t("city.response.noTiming")}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Always English, like every export: other offices read the file. One row
// per agency for all its reports, then one per category.
function exportCsv(response: CityResponseData) {
  const minutes = (d: DurationSummary, key: "median" | "p95") => d[key] ?? "";
  const rows: (string | number)[][] = [];
  for (const a of response.agencies) {
    const name = a.name ?? "Agency name unavailable";
    rows.push([
      name, "All categories", a.routed, a.awaitingAcknowledgement, a.inProgress, a.resolved, a.returned,
      minutes(a.toAcknowledge, "median"), minutes(a.toAcknowledge, "p95"), minutes(a.toResolve, "median"), minutes(a.toResolve, "p95"),
    ]);
    for (const c of response.categories) {
      const cell = a.byCategory[c];
      if (!cell) continue;
      rows.push([
        name, c, cell.routed, "", "", "", "",
        minutes(cell.toAcknowledge, "median"), minutes(cell.toAcknowledge, "p95"), minutes(cell.toResolve, "median"), minutes(cell.toResolve, "p95"),
      ]);
    }
  }
  downloadCsv(`agency-response-${manilaTimestamp(new Date().toISOString()).slice(0, 10)}.csv`, [
    [
      "Agency", "Category", "Routed", "Awaiting acknowledgement", "In progress", "Resolved", "Returned out of scope",
      "Median minutes to acknowledge", "95th percentile minutes to acknowledge",
      "Median minutes acknowledged to resolved", "95th percentile minutes acknowledged to resolved",
    ],
    ...rows,
  ]);
}
