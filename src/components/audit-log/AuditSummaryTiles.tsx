"use client";

import { Tile } from "@/components/ui/Tile";
import { useT } from "@/lib/i18n";
import type { AuditSummary } from "@/types";

/**
 * Counts over the events loaded, which is what [Events shown] says. The
 * mockup's [Unique actors] and [PII-access events] tiles are gone: the read
 * function returns no actor and no subject, by design, so both would have
 * been invented numbers.
 */
export function AuditSummaryTiles({ summary }: { summary: AuditSummary }) {
  const t = useT();
  return (
    <div className="mb-6 flex flex-wrap gap-4">
      <Tile label={t("audit.tile.total")} value={summary.totalEvents} />
      <Tile label={t("audit.tile.decisions")} value={summary.decisions} accent="brand" />
      <Tile label={t("audit.tile.routings")} value={summary.routings} />
      <Tile label={t("audit.tile.openings")} value={summary.openings} />
    </div>
  );
}
