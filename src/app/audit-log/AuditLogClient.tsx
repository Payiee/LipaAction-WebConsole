"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DataUnavailableBanner } from "@/components/layout/DataUnavailableBanner";
import { useT } from "@/lib/i18n";
import { AuditSummaryTiles } from "@/components/audit-log/AuditSummaryTiles";
import { AUDIT_FILTERS, AuditFilters, type AuditFilterId, type AuditRange } from "@/components/audit-log/AuditFilters";
import { manilaTimestamp, startOfManilaDay } from "@/lib/utils";
import { ACTION_LABELS, AuditTable, ROLE_LABELS } from "@/components/audit-log/AuditTable";
import { auditCsvRows } from "@/components/audit-log/auditCsv";
import { Button } from "@/components/ui/Button";
import { CategoryMultiSelect, matchesCategories } from "@/components/ui/CategoryMultiSelect";
import { useToast } from "@/components/ui/Toast";
import { useRecordedExport } from "@/components/ui/useRecordedExport";
import { downloadCsv } from "@/lib/downloadCsv";
import type { OfficialProfile } from "@/lib/auth";
// Type-only import from a server-only module — erased at compile time.
import type { AuditLogData } from "@/lib/data/auditLog";

export function AuditLogClient({
  official,
  auditData,
}: {
  official: OfficialProfile;
  auditData: AuditLogData;
}) {
  const t = useT();
  const { entries, summary, limit, loadFailed, refusal } = auditData;
  const [filter, setFilter] = useState<AuditFilterId>("all");
  const [range, setRange] = useState<AuditRange>("all");
  // The reports' categories, several at once (agencies' request,
  // 2026-10-14). An event with no report has no category, so any choice
  // leaves it out.
  const [categories, setCategories] = useState<string[]>([]);
  const categoryOptions = useMemo(
    () => [...new Set(entries.map((e) => e.category).filter((c): c is string => !!c))].sort(),
    [entries]
  );
  const { showToast } = useToast();
  const { record, busy } = useRecordedExport();

  const shown = useMemo(() => {
    const actions: readonly string[] = AUDIT_FILTERS[filter];
    return entries.filter(
      (e) =>
        (actions.length === 0 || actions.includes(e.action)) &&
        inRange(e.at, range) &&
        matchesCategories(e.category, categories)
    );
  }, [entries, filter, range, categories]);
  const narrowed = filter !== "all" || range !== "all" || categories.some((c) => categoryOptions.includes(c));

  // The thesis's export of the log for data-protection requests (A.3.7). It
  // is the trail itself leaving the console, so the export is recorded in
  // the trail first, and the file is made only if that succeeded.
  async function handleExport() {
    if (shown.length === 0) {
      showToast(t("history.exportNothing"), "info");
      return;
    }
    if (!(await record("audit_log_csv", shown.length))) return;
    // Dated in Manila: toISOString() is UTC, and would name a file made
    // before 8am for the previous day.
    const day = manilaTimestamp(new Date().toISOString()).slice(0, 10);
    downloadCsv(`audit-log-${day}.csv`, auditCsvRows(shown, ACTION_LABELS, ROLE_LABELS));
    showToast(t("audit.exported", { count: shown.length }), "success");
  }

  return (
    <AppShell breadcrumb={[official.barangayName, t("nav.auditLog")]} official={official}>
      {loadFailed && <DataUnavailableBanner what={t("banner.what.audit")} />}

      {/* Not an outage: the function answered, and its answer was that this
          account has no trail to show. Saying so beats the red banner, which
          would send an official refreshing a page that will never load. */}
      {refusal !== null ? (
        <div className="rounded-card border border-ink-100 bg-white px-4 py-10 text-center shadow-panel">
          <p className="text-sm font-medium text-ink-700">{t("audit.empty.title")}</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
            {t(refusal === "no_barangay" ? "audit.refusal.noBarangay" : "audit.refusal.noRole")}
          </p>
        </div>
      ) : (
        <>
          {/* What the page is, in the words of what the backend actually
              returns: roles, not officials. The old notice here said [Sample
              data] — true until the read function reached prod. */}
          <div
            role="note"
            className="mb-4 rounded-card border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-700"
          >
            {t("audit.notice")}
          </div>

          <AuditSummaryTiles summary={summary} />
          <AuditFilters active={filter} onChange={setFilter} range={range} onRangeChange={setRange} />
          <div className="mb-3 flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
            {categoryOptions.length > 1 && (
              <div className="mr-auto">
                <CategoryMultiSelect options={categoryOptions} chosen={categories} onChange={setCategories} />
              </div>
            )}
            <p className="text-xs text-ink-500">{t("export.recordedNote")}</p>
            <Button variant="secondary" size="sm" disabled={busy || loadFailed} onClick={handleExport}>
              {busy ? t("common.working") : t("history.export")}
            </Button>
          </div>
          <AuditTable entries={shown} filtered={narrowed} />

          {/* Never [the audit trail]: the function returns at most `limit`
              rows and cannot say whether older ones were dropped. */}
          <p className="mt-3 text-xs text-ink-500">
            {!narrowed
              ? t("audit.footer", { count: entries.length, limit })
              : t("audit.footerFiltered", { shown: shown.length, count: entries.length })}
          </p>
        </>
      )}
    </AppShell>
  );
}

// Manila's day, not the browser's, as on Validation History.
function inRange(at: string | undefined, range: AuditRange): boolean {
  if (range === "all") return true;
  const time = at ? Date.parse(at) : NaN;
  if (Number.isNaN(time)) return false;
  if (range === "today") return time >= startOfManilaDay().getTime();
  return time >= Date.now() - 7 * 24 * 60 * 60 * 1000;
}
