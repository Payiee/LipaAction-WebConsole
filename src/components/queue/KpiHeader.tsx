import { Tile } from "@/components/ui/Tile";
import { formatDuration } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { KpiSummary } from "@/types";
// Type-only import from a server-only module — erased at compile time.
import type { SanctionCounts } from "@/lib/data/sanctions";

export function KpiHeader({
  summary,
  duplicateCount,
  sanctionCounts,
  showMaliciousTrack = false,
}: {
  summary: KpiSummary;
  // Set for barangay admins only: the paper's admin KPI strip (A.3.1) adds
  // the flagged-duplicates count and the sanctions-to-lift count.
  duplicateCount?: number;
  // Undefined for a barangay official (no card at all); null when the count
  // couldn't be read, which shows as a dash rather than a zero.
  sanctionCounts?: SanctionCounts | null;
  // The senior admin's fifth card: sanctions only that role may lift.
  showMaliciousTrack?: boolean;
}) {
  const t = useT();
  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <Tile label={t("queue.kpi.fastTriage")} value={summary.fastTriageCount} accent="critical" />
      <Tile label={t("queue.kpi.standard")} value={summary.standardIntakeCount} />
      {duplicateCount !== undefined && <Tile label={t("queue.kpi.duplicates")} value={duplicateCount} />}
      {sanctionCounts !== undefined && (
        <Tile label={t("queue.kpi.sanctions")} value={sanctionCounts ? sanctionCounts.liftable : "—"} />
      )}
      {sanctionCounts !== undefined && showMaliciousTrack && (
        <Tile
          label={t("queue.kpi.sanctionsMalicious")}
          value={sanctionCounts ? sanctionCounts.seniorOnly : "—"}
          accent="critical"
        />
      )}
      {/* "Median wait", not a bare "Median" — this is the median age of
          reports still pending, so the label has to say what is being
          measured. It is not the mockup's median resolution time; no
          resolution-time column exists yet. */}
      <Tile label={t("queue.kpi.medianWait")} value={formatDuration(summary.medianMinutes)} />
      <Tile label={t("queue.kpi.validatedToday")} value={summary.validatedCount ?? "—"} accent="brand" />
    </div>
  );
}
