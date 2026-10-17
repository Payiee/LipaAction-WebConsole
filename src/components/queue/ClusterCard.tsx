"use client";

import { useState } from "react";
import { ReporterChip } from "@/components/ui/ReporterChip";
import { CopyIdButton } from "@/components/ui/CopyIdButton";
import { PriorityBadge, priorityBar } from "@/components/ui/Badge";
import { useLang, useT } from "@/lib/i18n";
import { cx, timeAgo } from "@/lib/utils";
import { ValidateClusterButton } from "./ValidateClusterButton";
import type { SituationCluster } from "@/types";

export function ClusterCard({
  cluster,
  // QueueClient's clock, so member ages keep moving while nothing refreshes;
  // null on the first render, which shows the server's own strings.
  now = null,
  onValidated,
}: {
  cluster: SituationCluster;
  now?: number | null;
  // So the queue can mark the validated members' rows before the refresh.
  onValidated?: (validatedIds: string[]) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [resolved, setResolved] = useState(false);

  if (resolved) {
    return (
      <div className="mb-4 rounded-card border border-ink-100 bg-ink-50/60 px-4 py-3 text-sm text-ink-500">
        <span className="font-mono text-xs">{cluster.id}</span>{" "}
        {t("cluster.card.done", { count: cluster.memberCount })}
      </div>
    );
  }

  // RLS shows this official only their own barangay's reports, so a cluster
  // reaches this card with one barangay; it read [2 reports across 1
  // barangays].
  const summary =
    cluster.barangaysAffected.length === 1
      ? t("cluster.card.inBarangay", { count: cluster.memberCount, barangay: cluster.barangaysAffected[0] })
      : t("cluster.card.acrossBarangays", {
          count: cluster.memberCount,
          barangays: cluster.barangaysAffected.length,
        });

  return (
    <div className="mb-4 overflow-hidden rounded-card border border-priority-critical/30 bg-priority-criticalBg/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-priority-critical/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          {/* One category names the group; several are said as mixed, and each
              member row below names its own. */}
          <span className="rounded-full bg-priority-critical px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            {cluster.categories.length === 1 ? cluster.categories[0] : t("cluster.mixedCategories")}
          </span>
          <span className="text-sm font-medium text-ink-900">{summary}</span>
          {cluster.identityWithheldMembers > 0 && (
            <span className="text-xs text-ink-500">
              {t("cluster.card.withheld", { count: cluster.identityWithheldMembers })}
            </span>
          )}
        </div>
        {/* [Split into commitments] was removed here. Splitting a cluster means
            writing incident_reports.cluster_id, and it's unconfirmed whether
            that column is writable by a barangay role — plus the
            duplicate-flagging algorithm owns cluster assignment and would
            likely re-cluster anyway. It fired a toast claiming the split had
            happened. Re-add only once the backend confirms a supported path. */}
        <ValidateClusterButton
          cluster={cluster}
          onValidated={(ids, all) => {
            if (all) setResolved(true);
            onValidated?.(ids);
          }}
        />
      </div>

      {/* The English screen keeps a Tagalog hint, as elsewhere. It used to
          read [pag-verify, pag-recall, at pag-merge], naming recall and merge
          actions this card doesn't have; validating is the only one. */}
      {lang === "en" && <p className="px-4 pt-2 text-xs text-ink-500">Mga aksyon &middot; pag-verify</p>}

      {/* Members in the same order as a queue card: priority and category,
          what it says, when and who, then the id. */}
      <div className="space-y-2 p-3">
        {cluster.members.map((member) => (
          <div
            key={member.id}
            className={cx("rounded-card border border-l-4 border-ink-100 bg-white", priorityBar(member.priority))}
          >
            <div className="min-w-0 px-4 pb-2 pt-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <PriorityBadge priority={member.priority} />
                <span className="text-sm font-semibold text-ink-900">{member.category}</span>
              </div>
              <p className="mb-1.5 line-clamp-2 text-sm text-ink-900">{member.summary}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-ink-500">
                {member.location && (
                  <>
                    <span>{member.location}</span>
                    <span aria-hidden>·</span>
                  </>
                )}
                <span>{now === null ? member.timestamp : timeAgo(member.details.submittedAt, now)}</span>
                <span aria-hidden>·</span>
                <ReporterChip reporter={member.reporter} />
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-ink-100 pl-4 pr-2">
              <span className="shrink-0 text-xs text-ink-500">{t("row.reportId")}</span>
              <span className="min-w-0 truncate font-mono text-xs text-ink-500">{member.id}</span>
              <CopyIdButton id={member.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
