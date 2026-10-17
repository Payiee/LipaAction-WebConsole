"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ROLE_LABELS } from "@/components/audit-log/AuditTable";
import { Button } from "@/components/ui/Button";
import { FilterBar, FilterGroup } from "@/components/ui/FilterGroup";
import { PrintButton } from "@/components/ui/PrintButton";
import { useToast } from "@/components/ui/Toast";
import { useRecordedExport } from "@/components/ui/useRecordedExport";
import { downloadCsv } from "@/lib/downloadCsv";
import { translate, useT, type Translate } from "@/lib/i18n";
import { ownValue } from "@/lib/utils";
import { reportsHref } from "./reportsHref";
// Type-only import from a server-only module — erased at compile time.
import type { OfficialVerificationActivity, VerificationActivityData } from "@/lib/data/verificationActivity";
import { EmptyState } from "@/components/ui/EmptyState";

const DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;
// As on the daily summary: a typed year fires a change per keystroke.
const DATE_SETTLE_MS = 400;

// [Sep 27]. Noon Manila, so the day can't shift in any zone.
function formatDay(date: string, withYear = false): string {
  return new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/**
 * [2 of 5 (40%)], or a dash when there is nothing to take a share of. With a
 * translate function, in the screen's language; without one, in English.
 */
export function shareText(part: number, whole: number, t?: Translate): string {
  if (whole === 0) return "—";
  const percent = Math.round((part / whole) * 100);
  return t ? t("common.shareOf", { part, whole, percent }) : `${part} of ${whole} (${percent}%)`;
}

/**
 * The report as CSV rows, header first. English like every export; officials
 * by name, as the page shows them, and no resident anywhere.
 */
export function verificationActivityCsvRows(
  data: Pick<VerificationActivityData, "weekStart" | "weekEnd" | "officials" | "namesUnavailable">,
  barangayName: string
): (string | number)[][] {
  const name = (o: OfficialVerificationActivity) => o.name ?? (data.namesUnavailable ? "Name unavailable" : "Unnamed official");
  const role = (o: OfficialVerificationActivity) => {
    if (!o.role) return "";
    const key = ownValue(ROLE_LABELS, o.role);
    return key ? translate("en", key) : o.role;
  };
  return [
    ["Week start", "Week end", "Barangay", "Official", "Role", "Tier 1 promotions", "In person", "Field visit", "Barangay records", "Other method", "Revoked since"],
    ...data.officials.map((o) => [
      data.weekStart,
      data.weekEnd,
      barangayName,
      name(o),
      role(o),
      o.promotions,
      o.inPerson,
      o.field,
      o.bulkImport,
      o.other,
      o.revoked,
    ]),
  ];
}

/**
 * The paper's Weekly Verification Activity by Official (#13): each official's
 * Tier 1 promotions over seven days, by method, and how many have since been
 * revoked. The week's last day lives in the URL, so picking one is a
 * navigation and the server does the counting — see getVerificationActivity.
 *
 * It names officials, so its export and its print are each recorded in the
 * access trail first (see useRecordedExport).
 */
export function VerificationActivity({
  data,
  date,
  month,
  currentMonth,
  barangayName,
}: {
  data: VerificationActivityData;
  // The other two reports' choices, kept in the URL when the week changes.
  date: string;
  month: string;
  currentMonth: string;
  barangayName: string;
}) {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const { record, busy } = useRecordedExport();
  const { weekEnd, weekStart, today, officials, totals, loadFailed } = data;
  const settleTimer = useRef<number | undefined>(undefined);
  const range = `${formatDay(weekStart)} – ${formatDay(weekEnd, true)}`;
  const showOther = officials.some((o) => o.other > 0);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  function showWeek(next: string) {
    router.push(reportsHref({ date, month, week: next }, { today, currentMonth }));
  }

  function handleDateChange(next: string) {
    window.clearTimeout(settleTimer.current);
    // Empty while the field is cleared or half-typed; nothing to load yet.
    if (!DATE_SHAPE.test(next) || next === weekEnd) return;
    settleTimer.current = window.setTimeout(() => showWeek(next), DATE_SETTLE_MS);
  }

  async function handleExport() {
    if (officials.length === 0) {
      showToast(t("reports.verification.exportNothing"), "info");
      return;
    }
    if (!(await record("verification_activity_csv", officials.length))) return;
    downloadCsv(`verification-activity-${weekEnd}.csv`, verificationActivityCsvRows(data, barangayName));
    showToast(t("reports.verification.exported", { range }), "success");
  }

  return (
    <section aria-labelledby="verification-activity-title" data-printable="verification" className="mb-6">
      <div className="mb-4">
        <div>
          <h2 id="verification-activity-title" className="text-base font-semibold text-ink-900">
            {t("reports.verification.title")} &middot; {range}
          </h2>
          <p className="text-sm text-ink-500">{t("reports.verification.intro")}</p>
        </div>
      </div>
      <FilterBar>
        <FilterGroup label={t("filters.date")}>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            {t("reports.verification.weekEnding")}
            <input
              type="date"
              // Remounts when the week changes by another route (This week, or
              // Back), so the box never shows a week the section no longer does.
              key={weekEnd}
              defaultValue={weekEnd}
              max={today}
              onChange={(e) => handleDateChange(e.target.value)}
              className="min-h-11 rounded-md border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
            />
          </label>
          {weekEnd !== today && (
            <Button variant="secondary" onClick={() => showWeek(today)}>
              {t("reports.verification.thisWeek")}
            </Button>
          )}
        </FilterGroup>
        <FilterGroup label={t("filters.export")} className="max-w-xs">
          <Button variant="secondary" disabled={busy || loadFailed} onClick={handleExport}>
            {busy ? t("common.working") : t("history.export")}
          </Button>
          <PrintButton section="verification" record={{ what: "verification_activity_print", rows: officials.length }} />
          <p className="basis-full text-xs text-ink-500">{t("export.recordedNote")}</p>
        </FilterGroup>
      </FilterBar>

      {loadFailed ? (
        <p
          role="alert"
          className="rounded-card border border-priority-critical/40 bg-priority-criticalBg px-4 py-3 text-xs text-ink-700"
        >
          {t("reports.verification.failed")}
        </p>
      ) : officials.length === 0 ? (
        <EmptyState icon="verify">
          <p className="text-sm text-ink-500">{t("reports.verification.empty", { range })}</p>
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel print:overflow-visible">
          <table className="w-full min-w-[720px] text-left text-sm print:min-w-0">
            <caption className="sr-only">{t("reports.verification.caption", { range })}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.access.col.who")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("reports.verification.col.promotions")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("verify.method.in_person")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("verify.method.field")}</th>
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("verify.method.bulk_import")}</th>
                {showOther && (
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("reports.verification.col.other")}</th>
                )}
                <th scope="col" className="px-4 py-2.5 text-right font-semibold">{t("reports.verification.col.revoked")}</th>
              </tr>
            </thead>
            <tbody>
              {officials.map((o) => {
                const role = o.role ? ownValue(ROLE_LABELS, o.role) : undefined;
                return (
                  <tr key={o.key} className="border-b border-ink-100 last:border-0">
                    <th scope="row" className="px-4 py-2.5 text-left font-normal">
                      <p className="text-xs font-medium text-ink-900">
                        {o.name ?? t(data.namesUnavailable ? "city.access.nameUnavailable" : "city.access.unnamed")}
                      </p>
                      {o.role && <p className="text-xs text-ink-500">{role ? t(role) : o.role}</p>}
                    </th>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-900">{o.promotions}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{o.inPerson}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{o.field}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{o.bulkImport}</td>
                    {showOther && <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{o.other}</td>}
                    <td className="px-4 py-2.5 text-right tabular-nums text-ink-700">{shareText(o.revoked, o.promotions, t)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-ink-100 bg-ink-50 text-xs font-semibold text-ink-900">
                <th scope="row" className="px-4 py-2.5 text-left">{t("reports.verification.total")}</th>
                <td className="px-4 py-2.5 text-right tabular-nums">{totals.promotions}</td>
                <td colSpan={showOther ? 4 : 3} />
                <td className="px-4 py-2.5 text-right tabular-nums">{shareText(totals.revoked, totals.promotions, t)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {t("reports.verification.footer")}
        {data.capped && ` · ${t("reports.verification.capped", { limit: data.limit })}`}
      </p>
    </section>
  );
}
