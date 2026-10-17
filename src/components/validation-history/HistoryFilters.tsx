"use client";

import { cx, manilaTimestamp, REJECT_REASON_LABELS } from "@/lib/utils";
import { downloadCsv } from "@/lib/downloadCsv";
import { Button } from "@/components/ui/Button";
import { CategoryMultiSelect } from "@/components/ui/CategoryMultiSelect";
import { PrintButton } from "@/components/ui/PrintButton";
import { useRecordedExport } from "@/components/ui/useRecordedExport";
import { useToast } from "@/components/ui/Toast";
import { useT, type MessageKey } from "@/lib/i18n";
import type { ResolutionStatus, ValidationRecord } from "@/types";
import { NOT_SCORED, RESOLUTION_LABELS } from "./historyOptions";

export type RangeFilter = "today" | "7d" | "all";
export type OutcomeFilter = "all" | "Confirmed" | "Rejected";

export const rangeOptions: { id: RangeFilter; label: MessageKey }[] = [
  { id: "today", label: "history.range.today" },
  { id: "7d", label: "history.range.7d" },
  { id: "all", label: "history.range.all" },
];

const outcomeOptions: { id: OutcomeFilter; label: MessageKey }[] = [
  { id: "all", label: "history.outcome.all" },
  { id: "Confirmed", label: "history.outcome.Confirmed" },
  { id: "Rejected", label: "history.outcome.Rejected" },
];

// Controlled — ValidationHistoryClient owns the state and does the actual
// filtering, so the table and these chips can never disagree about what's
// being shown. Every option here filters the rows already fetched by
// getValidationHistory(); none of them re-query.
//
// "All officials" used to sit in the range group alongside Today/Last 7d,
// which mixed two unrelated dimensions into one row of chips. It's now its
// own select, populated from the officials actually present in the data.
export function HistoryFilters({
  range,
  outcome,
  official,
  officialOptions,
  onRangeChange,
  onOutcomeChange,
  onOfficialChange,
  categories,
  categoryOptions,
  onCategoriesChange,
  priority,
  priorityOptions,
  onPriorityChange,
  resolution,
  resolutionOptions,
  onResolutionChange,
  records,
}: {
  range: RangeFilter;
  outcome: OutcomeFilter;
  official: string;
  officialOptions: string[];
  onRangeChange: (value: RangeFilter) => void;
  onOutcomeChange: (value: OutcomeFilter) => void;
  onOfficialChange: (value: string) => void;
  // Several at once, so an export can hold only the categories an office
  // wants (agencies' request, 2026-10-14). Empty means every category.
  categories: string[];
  categoryOptions: string[];
  onCategoriesChange: (value: string[]) => void;
  priority: string;
  priorityOptions: string[];
  onPriorityChange: (value: string) => void;
  resolution: ResolutionStatus | "all";
  // Empty when the agency rows couldn't be read, and the select is hidden.
  resolutionOptions: ResolutionStatus[];
  onResolutionChange: (value: ResolutionStatus | "all") => void;
  records: ValidationRecord[];
}) {
  const { showToast } = useToast();
  const t = useT();
  const { record, busy } = useRecordedExport();

  // The file names the validating officials, so the export is written to the
  // access trail first, and the file is made only if that succeeded.
  async function handleExport() {
    if (records.length === 0) {
      showToast(t("history.exportNothing"), "info");
      return;
    }
    if (!(await record("validation_history_csv", records.length))) return;
    exportCsv(records);
    showToast(t("history.exported", { count: records.length }), "success");
  }

  // print:hidden: a printed history shows the rows and tiles, not the controls.
  return (
    <div className="mb-3 flex flex-col gap-2 print:hidden sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {rangeOptions.map((opt) => (
          <button
            key={opt.id}
            onClick={() => onRangeChange(opt.id)}
            aria-pressed={range === opt.id}
            className={cx(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors",
              range === opt.id
                ? "bg-brand-500 text-white"
                : "bg-white text-ink-700 border border-ink-100 hover:bg-ink-50"
            )}
          >
            {t(opt.label)}
          </button>
        ))}

        <select
          aria-label={t("history.filterOutcome")}
          value={outcome}
          onChange={(e) => onOutcomeChange(e.target.value as OutcomeFilter)}
          className="min-h-11 rounded-full border border-ink-100 bg-white px-4 text-sm font-medium text-ink-700"
        >
          {outcomeOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {t(opt.label)}
            </option>
          ))}
        </select>

        {/* Only worth showing once more than one official appears in the data —
            a single-entry dropdown is just noise. */}
        {officialOptions.length > 1 && (
          <select
            aria-label={t("history.filterOfficial")}
            value={official}
            onChange={(e) => onOfficialChange(e.target.value)}
            className="min-h-11 shrink-0 rounded-full border border-ink-100 bg-white px-4 text-sm font-medium text-ink-700"
          >
            <option value="all">{t("history.allOfficials")}</option>
            {officialOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        {categoryOptions.length > 1 && (
          <CategoryMultiSelect options={categoryOptions} chosen={categories} onChange={onCategoriesChange} />
        )}

        {priorityOptions.length > 1 && (
          <select
            aria-label={t("history.filterPriority")}
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value)}
            className="min-h-11 shrink-0 rounded-full border border-ink-100 bg-white px-4 text-sm font-medium text-ink-700"
          >
            <option value="all">{t("history.allPriorities")}</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>
                {p === NOT_SCORED ? t("priority.unscored") : p}
              </option>
            ))}
          </select>
        )}

        {resolutionOptions.length > 0 && (
          <select
            aria-label={t("history.filterResolution")}
            value={resolution}
            onChange={(e) => onResolutionChange(e.target.value as ResolutionStatus | "all")}
            className="min-h-11 shrink-0 rounded-full border border-ink-100 bg-white px-4 text-sm font-medium text-ink-700"
          >
            <option value="all">{t("history.allResolutions")}</option>
            {resolutionOptions.map((s) => (
              <option key={s} value={s}>
                {t(RESOLUTION_LABELS[s])}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={busy} onClick={handleExport}>
          {busy ? t("common.working") : t("history.export")}
        </Button>
        <PrintButton section="history" record={{ what: "validation_history_print", rows: records.length }} />
        <p className="basis-full text-right text-xs text-ink-500">{t("export.recordedNote")}</p>
      </div>
    </div>
  );
}

// Exports exactly what's on screen (current filters included), not a fresh
// server query — so the file always matches what the official was looking at
// when they clicked.
//
// Always in English, whatever the interface language: the file is read by
// other offices, and its column names are what the verified export was
// checked against.
//
// The reporter column carries "Verified reporter" / "Identity withheld" only,
// never a name — same privacy rule as the table itself. Nothing here widens
// what leaves the system.
function exportCsv(records: ValidationRecord[]) {
  const header = [
    "Report ID",
    "Category",
    "Priority",
    "Entry tier",
    "Verdict",
    "Reason category",
    "Reason",
    "Validating official",
    "Reporter",
    "Reviewed at",
  ];

  const rows = records.map((r) => [
    r.reportId,
    r.category,
    // A blank cell would read as missing data; the words say what it is.
    r.priority ?? "Not scored",
    r.entryTier,
    r.verdict,
    // The category in words; [Uncategorised] for a rejection whose reason has
    // no known prefix, blank for a confirmation, which carries no reason.
    r.verdict === "Rejected" ? (r.reasonCode ? REJECT_REASON_LABELS[r.reasonCode] : "Uncategorised") : "",
    // The note without its prefix, or the whole text of an uncategorised one.
    r.reasonNote ?? "",
    r.validatingOfficial,
    r.reporter.name,
    // Manila, like the table above it. The raw column is UTC, so exporting
    // it unchanged put every review eight hours earlier than the screen
    // said. The +08:00 offset is kept so the value stays unambiguous.
    manilaTimestamp(r.reviewedAt),
  ]);

  // Dated in Manila: toISOString() is UTC, so an export made before 8am
  // was named for the previous day.
  downloadCsv(
    `validation-history-${manilaTimestamp(new Date().toISOString()).slice(0, 10)}.csv`,
    [header, ...rows]
  );
}
