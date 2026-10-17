"use client";

import { useEffect, useRef } from "react";
import { PriorityBadge } from "@/components/ui/Badge";
import { ReporterChip } from "@/components/ui/ReporterChip";
import { useLang, useT } from "@/lib/i18n";
import { cx, manilaTimestamp, timeAgo } from "@/lib/utils";
import type { ClusterExplorerEntry, ClusterMemberDetail } from "@/types";

/**
 * Member list. Three controls from the mockup used to sit in the header —
 * [Wrong duplicate match], [Split into separate clusters], [Merge selected]
 * — each firing a toast that claimed the change had been made while writing
 * nothing. Removed rather than wired: cluster membership is
 * incident_reports.cluster_id, which no barangay role can write, and a
 * recomputation pass would undo a manual split unless a pin/override design
 * exists — it doesn't. Re-add only with a backend path. Same reasoning as
 * ClusterCard's removed [Split into commitments].
 *
 * Each row is a control since the map's dots became clickable: picking a
 * member here or on the map highlights it in both places and opens its
 * details under the row. Read-only still: the decision itself is made in
 * the Queue, and nothing here writes.
 */
export function MemberPanel({
  cluster,
  // The page's clock, so member ages keep moving; null on the first render,
  // which shows the server's own strings.
  now = null,
  selectedId,
  onSelect,
}: {
  cluster: ClusterExplorerEntry;
  now?: number | null;
  selectedId: string | null;
  onSelect: (reportId: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  const rows = useRef(new Map<string, HTMLDivElement>());

  // A dot picked on the map scrolls its row into view; a row the official
  // tapped is already on screen, and the scroll is a no-op there.
  useEffect(() => {
    if (!selectedId) return;
    rows.current.get(selectedId)?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  return (
    <div className="flex min-h-[16rem] flex-1 flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-panel">
      <div className="flex flex-col gap-2 border-b border-ink-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-900">
            {t("cluster.member.title", { id: cluster.id, category: cluster.categories.join(", "), count: cluster.memberCount })}
          </p>
          <p className="text-xs text-ink-500">{cluster.centroidLabel}</p>
        </div>
        <p className="text-xs text-ink-500">
          {t("cluster.member.where")}
          {/* The English screen keeps the mockup's Tagalog hint. */}
          {lang === "en" && <> &middot; Mga aksyon sa Queue</>}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {cluster.members.map((member, idx) => {
          const selected = member.reportId === selectedId;
          return (
            <div
              key={member.reportId}
              ref={(el) => {
                if (el) rows.current.set(member.reportId, el);
                else rows.current.delete(member.reportId);
              }}
              className={cx(
                "border-b border-ink-100 last:border-0",
                selected && "bg-brand-50"
              )}
            >
              <button
                type="button"
                aria-expanded={selected}
                aria-controls={`cluster-member-${member.reportId}`}
                onClick={() => onSelect(member.reportId)}
                className={cx(
                  "flex min-h-11 w-full flex-col items-start px-4 py-3 text-left transition-colors",
                  selected ? "border-l-4 border-brand-500 pl-3" : "hover:bg-ink-50"
                )}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-ink-500">{member.reportId}</span>
                  <PriorityBadge priority={member.priority} />
                  <span className="text-xs font-medium text-ink-700">{member.category}</span>
                  <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-medium text-ink-700">
                    {member.relationship === "Primary" ? t("cluster.member.primary") : t("cluster.member.related")}
                  </span>
                  <span className="text-xs text-ink-500">
                    {now === null ? member.timestamp : timeAgo(member.submittedAt, now)}
                  </span>
                </div>
                <ReporterChip reporter={member.reporter} />
              </button>
              {selected && <MemberDetails member={member} />}
              {idx > 0 && (member.visualHash || member.temporalDeltaSeconds || member.sitio) && (
                <div className="mx-4 mb-3 flex flex-wrap gap-3 rounded-md bg-ink-50 px-2.5 py-1.5 text-xs text-ink-500">
                  {member.visualHash !== undefined && (
                    <span>{t("cluster.signal.visualHash", { value: member.visualHash.toFixed(2) })}</span>
                  )}
                  {member.temporalDeltaSeconds !== undefined && (
                    <span>
                      {t("cluster.signal.temporal", {
                        minutes: Math.floor(member.temporalDeltaSeconds / 60),
                        seconds: member.temporalDeltaSeconds % 60,
                      })}
                    </span>
                  )}
                  {member.sitio && <span>{t("cluster.signal.sitio", { sitio: member.sitio })}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * What the row doesn't already show: the exact filing time and where the
 * report was filed from, as far as the privacy rule lets the console say.
 * No description or resident text — that stays behind the queue drawer,
 * which logs its opening; this panel logs nothing and so must show nothing
 * the resident wrote.
 */
function MemberDetails({ member }: { member: ClusterMemberDetail }) {
  const t = useT();
  const position = member.position;
  return (
    <dl
      id={`cluster-member-${member.reportId}`}
      className="mx-4 mb-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-md border border-brand-100 bg-white px-3 py-2 text-xs"
    >
      <dt className="text-ink-500">{t("cluster.member.submitted")}</dt>
      <dd className="font-mono text-ink-900">{manilaTimestamp(member.submittedAt)}</dd>
      <dt className="text-ink-500">{t("cluster.member.location")}</dt>
      <dd className="text-ink-900">
        {position.kind === "point" && (
          <span className="font-mono">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
          </span>
        )}
        {position.kind === "hidden" && t("cluster.member.locationHidden")}
        {position.kind === "none" && t("cluster.member.locationNone")}
        {position.kind === "unavailable" && t("cluster.member.locationUnavailable")}
      </dd>
      <dt className="text-ink-500">{t("cluster.member.decide")}</dt>
      <dd className="text-ink-700">{t("cluster.member.decideBody")}</dd>
    </dl>
  );
}
