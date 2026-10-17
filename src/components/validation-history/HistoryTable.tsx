import { PriorityBadge, Badge } from "@/components/ui/Badge";
import { ReporterChip } from "@/components/ui/ReporterChip";
import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Icon } from "@/components/ui/Icon";
import type { ValidationRecord } from "@/types";
import { RESOLUTION_LABELS } from "./historyOptions";
import { EmptyState } from "@/components/ui/EmptyState";

export function HistoryTable({
  records,
  // Distinguishes "this barangay has reviewed nothing yet" from "your filters
  // excluded everything" — the same empty table means two very different
  // things, and the second one is the user's own doing.
  isFiltered = false,
}: {
  records: ValidationRecord[];
  isFiltered?: boolean;
}) {
  const t = useT();
  if (records.length === 0) {
    return (
      <EmptyState icon="history">
        <p className="text-sm font-medium text-ink-700">
          {t(isFiltered ? "history.empty.filteredTitle" : "history.empty.title")}
        </p>
        <p className="mt-1 text-xs text-ink-500">
          {t(isFiltered ? "history.empty.filteredBody" : "history.empty.body")}
        </p>
      </EmptyState>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel print:overflow-visible">
      <table className="w-full min-w-[800px] text-left text-sm print:min-w-0">
        <caption className="sr-only">{t("history.caption")}</caption>
        <thead>
          <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("history.col.report")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("reports.col.category")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("drawer.priority")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("history.col.verdict")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("history.col.official")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("field.reporter")}</th>
            <th scope="col" className="px-4 py-2.5 font-semibold">{t("field.timestamp")}</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.reportId}
              className="border-b border-ink-100 last:border-0 hover:bg-ink-50/60"
            >
              <td className="px-4 py-3 font-mono text-xs text-ink-500">{record.reportId}</td>
              {/* Category and priority in columns of their own: sharing one
                  cell, each badge started wherever its category name ended,
                  so the badges zigzagged down the table. */}
              <td className="px-4 py-3">
                <span className="text-xs text-ink-700">{record.category}</span>
                {/* Intake tier, kept as plain text so it can't be mistaken for
                    a second priority reading. */}
                <p className="mt-0.5 text-xs text-ink-500">
                  {t(`history.tier.${record.entryTier}`)}
                </p>
              </td>
              <td className="px-4 py-3">
                <PriorityBadge priority={record.priority} />
              </td>
              <td className="px-4 py-3 align-top">
                <Badge tone={record.verdict === "Confirmed" ? "success" : "warning"}>
                  {/* The icon repeats the word, so the verdict is never
                      carried by the badge colour alone. */}
                  <Icon name={record.verdict === "Confirmed" ? "check" : "close"} className="mr-1 h-3 w-3" />
                  {t(record.verdict === "Confirmed" ? "history.verdict.confirmed" : "history.verdict.rejected")}
                </Badge>
                {/* Rejection reason (incident_reports.review_reason). Only
                    rejected rows carry one — the RPC leaves it NULL on
                    validate — so this block is absent, not empty, otherwise.
                    The category is parsed from the reason's prefix; a reason
                    without one shows its text alone. */}
                {/* What became of a confirmed report since: still with an
                    agency, resolved, sent back. Absent on a rejection, and
                    when the agency rows couldn't be read. */}
                {record.resolution && (
                  <p className="mt-1 text-xs text-ink-500">{t(RESOLUTION_LABELS[record.resolution])}</p>
                )}
                {/* What the desk wrote when it closed the report itself. */}
                {record.resolutionNote && (
                  <p className="mt-1 max-w-[220px] whitespace-pre-wrap text-xs leading-snug text-ink-500">
                    {record.resolutionNote}
                  </p>
                )}
                {record.reason && (
                  <div className="mt-1 max-w-[220px] text-xs leading-snug text-ink-500">
                    {record.reasonCode && (
                      <p className="font-medium text-ink-700">{t(`rejectReason.${record.reasonCode}`)}</p>
                    )}
                    {record.reasonNote && <p>{record.reasonNote}</p>}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-xs text-ink-700">
                {record.officialIsBarangayGeneric ? t("history.yourBarangay") : record.validatingOfficial}
              </td>
              <td className="px-4 py-3">
                <ReporterChip reporter={record.reporter} />
              </td>
              <td
                className={cx(
                  "px-4 py-3 text-xs",
                  record.trustDelta ? "text-priority-critical" : "text-ink-500"
                )}
              >
                {record.timestamp}
                {record.trustDelta && (
                  <span className="ml-1.5 font-medium">{t("history.trust", { delta: record.trustDelta })}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
