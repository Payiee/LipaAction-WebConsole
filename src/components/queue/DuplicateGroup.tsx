"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { ValidateClusterButton } from "./ValidateClusterButton";
import type { QueueReport, SituationCluster } from "@/types";

/**
 * One duplicate group on the Flagged duplicates tab: a header naming the
 * group's size and categories, with its own [Validate as one cluster], then
 * the member rows. The tab used to be one flat list, so an official couldn't
 * tell which reports the system had grouped together, and only the largest
 * group, on the Emergency tab, could be validated as one.
 *
 * rows are the members the search box lets through; the header still
 * describes, and the button still validates, the whole group.
 */
export function DuplicateGroup({
  cluster,
  rows,
  renderRow,
  onValidated,
}: {
  cluster: SituationCluster;
  rows: QueueReport[];
  renderRow: (report: QueueReport) => React.ReactNode;
  onValidated: (validatedIds: string[]) => void;
}) {
  const t = useT();
  const [allValidated, setAllValidated] = useState(false);
  if (rows.length === 0) return null;

  const headingId = `duplicate-group-${cluster.id}`;
  return (
    <section aria-labelledby={headingId} className="border-b border-ink-100 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50 px-4 py-2.5">
        <div className="min-w-0">
          <h3 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            {t("queue.dupGroup.title", { count: cluster.memberCount })}
          </h3>
          <p className="text-sm font-medium text-ink-900">
            {cluster.categories.length === 1
              ? cluster.categories[0]
              : `${t("cluster.mixedCategories")}: ${cluster.categories.join(", ")}`}
          </p>
          <p className="truncate font-mono text-xs text-ink-500">{cluster.id}</p>
        </div>
        {allValidated ? (
          <p role="status" className="text-xs text-ink-500">
            {t("queue.dupGroup.done")}
          </p>
        ) : (
          <ValidateClusterButton
            cluster={cluster}
            onValidated={(ids, all) => {
              if (all) setAllValidated(true);
              onValidated(ids);
            }}
          />
        )}
      </div>
      {rows.map(renderRow)}
    </section>
  );
}
