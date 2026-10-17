"use client";

import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { ClusterExplorerEntry } from "@/types";

const statusStyles: Record<string, string> = {
  Critical: "text-priority-critical",
  High: "text-priority-high",
  Standard: "text-ink-500",
};

export function ClusterList({
  clusters,
  activeId,
  onSelect,
}: {
  clusters: ClusterExplorerEntry[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const t = useT();

  // Critical and High are the model's class names, which stay English like
  // every priority badge; Standard is this console's own word for the rest.
  function statusText(status: ClusterExplorerEntry["status"]): string {
    if (status === null) return t("priority.unscored");
    if (status === "Standard") return t("cluster.status.standard");
    return status;
  }

  return (
    <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-panel lg:w-64 lg:max-h-none max-h-64">
      <div className="border-b border-ink-100 px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {t("cluster.list.title", { count: clusters.length })}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {clusters.map((cluster) => {
          const active = cluster.id === activeId;
          return (
            <button
              key={cluster.id}
              onClick={() => onSelect(cluster.id)}
              className={cx(
                "flex min-h-11 w-full flex-col items-start justify-center gap-0.5 border-b border-ink-100 px-3 py-2.5 text-left transition-colors last:border-0",
                active ? "bg-brand-50" : "hover:bg-ink-50"
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className="font-mono text-xs text-ink-500">{cluster.id}</span>
                <span
                  className={cx(
                    "text-xs font-semibold",
                    cluster.status === null ? "text-ink-500" : statusStyles[cluster.status]
                  )}
                >
                  {statusText(cluster.status)}
                </span>
              </div>
              <span className="text-sm font-medium text-ink-900">
                {cluster.categories.length === 1 ? cluster.categories[0] : t("cluster.mixedCategories")}
              </span>
              {cluster.categories.length > 1 && (
                <span className="text-xs text-ink-700">{cluster.categories.join(", ")}</span>
              )}
              <span className="text-xs text-ink-500">
                {t("cluster.list.members", { count: cluster.memberCount })}
                {cluster.radiusMeters !== undefined && t("cluster.list.radius", { meters: cluster.radiusMeters })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
