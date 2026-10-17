import { Tile } from "@/components/ui/Tile";
import { useT } from "@/lib/i18n";
import type { ValidationSummary } from "@/types";

export function SummaryTiles({ summary }: { summary: ValidationSummary }) {
  const t = useT();
  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <Tile label={t("history.tile.total")} value={summary.total} />
      <Tile label={t("history.tile.confirmed")} value={summary.confirmed} accent="brand" />
      <Tile label={t("history.tile.rejected")} value={summary.rejected} accent="critical" />
      <Tile label={t("history.tile.withheld")} value={summary.identityWithheld} />
    </div>
  );
}
