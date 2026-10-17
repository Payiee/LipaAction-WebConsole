"use client";

import { cx } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";
import { FilterGroup } from "@/components/ui/FilterGroup";

/**
 * Which actions a chip keeps. Empty means every action. An automatic routing
 * is a routing, so it counts with the desk's own once the backend lets it
 * through; the agency events are under All only. Kept in step with the
 * summary counts in src/lib/data/auditLog.ts.
 */
export const AUDIT_FILTERS = {
  all: [],
  // Resolving at the barangay is the desk's own decision on a report.
  decisions: ["report_validated", "report_rejected", "report_resolved_at_barangay"],
  routings: ["report_routed_manual", "report_auto_routed"],
  openings: ["report_viewed"],
} as const;

export type AuditFilterId = keyof typeof AUDIT_FILTERS;

// The thesis's date filters for the log (A.3.7: Today, Last 7d), over the
// same loaded window.
export type AuditRange = "today" | "7d" | "all";

const RANGES: { id: AuditRange; label: MessageKey }[] = [
  { id: "today", label: "history.range.today" },
  { id: "7d", label: "history.range.7d" },
  { id: "all", label: "history.range.all" },
];

const LABELS: Record<AuditFilterId, MessageKey> = {
  all: "audit.filter.all",
  decisions: "audit.filter.decisions",
  routings: "audit.filter.routings",
  openings: "audit.filter.openings",
};

/**
 * Real filters now, over the events already loaded — the read function has
 * no action argument, and asking for one later would mean dropping and
 * recreating a live function, so the page filters its own window and the
 * note beside the chips says that is what it does.
 *
 * These chips replace mockup ones that highlighted and filtered nothing, and
 * an [Export CSV] button that claimed to export fixture rows.
 */
export function AuditFilters({
  active,
  onChange,
  range,
  onRangeChange,
  extra,
}: {
  active: AuditFilterId;
  onChange: (id: AuditFilterId) => void;
  range: AuditRange;
  onRangeChange: (range: AuditRange) => void;
  // More filters for the same group (the categories).
  extra?: React.ReactNode;
}) {
  const t = useT();

  // Two of the page's three groups: the date range, and what kind of event.
  // AuditLogClient adds the categories to the second and the export as the
  // third, inside the same FilterBar.
  return (
    <>
      <FilterGroup label={t("filters.date")}>
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={range === r.id}
            onClick={() => onRangeChange(r.id)}
            className={cx(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors",
              range === r.id
                ? "bg-brand-500 text-white"
                : "bg-white text-ink-700 border border-ink-100 hover:bg-ink-50"
            )}
          >
            {t(r.label)}
          </button>
        ))}
      </FilterGroup>
      <FilterGroup label={t("filters.refine")} className="flex-1">
        {(Object.keys(AUDIT_FILTERS) as AuditFilterId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={active === id}
            onClick={() => onChange(id)}
            className={cx(
              "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors",
              active === id
                ? "bg-brand-500 text-white"
                : "bg-white text-ink-700 border border-ink-100 hover:bg-ink-50"
            )}
          >
            {t(LABELS[id])}
          </button>
        ))}
        {extra}
        <p className="basis-full text-xs text-ink-500">{t("audit.filterNote")}</p>
      </FilterGroup>
    </>
  );
}
