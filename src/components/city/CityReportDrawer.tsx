"use client";

import { useEffect, useRef } from "react";
import { logReportView } from "@/app/actions/audit";
import { callAction } from "@/lib/callAction";
import { reportsAlreadyResolved } from "@/lib/utils";
import { useT, type Translate } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";
import { PriorityBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ReporterChip } from "@/components/ui/ReporterChip";
import { useDismissOnEscape } from "@/components/ui/useDismissOnEscape";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { agencyProgressLabel, splitRouting } from "@/components/queue/routing";
import { statusLabel } from "@/components/queue/useReportReview";
import type { AgencyRouting } from "@/types";
// Type-only import from a server-only module — erased at compile time.
import type { CityReport } from "@/lib/data/cityReports";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0">
      <p className="shrink-0 text-xs font-medium text-ink-500">{label}</p>
      <div className="text-right text-sm text-ink-900">{value}</div>
    </div>
  );
}

/**
 * One report, for the city administrator: the same account of the incident
 * the barangay desk reads, with no decision or routing controls. Decisions
 * stay with the barangay, and the role's database power to write city-wide
 * is deliberately not offered here.
 *
 * The resident's answers are printed verbatim, as in the queue's drawer.
 * The reporter is never named, and there is no location row: geom is not
 * even selected for this page.
 */
export function CityReportDrawer({ report, onClose }: { report: CityReport; onClose: () => void }) {
  const t = useT();
  const { showToast } = useToast();
  useDismissOnEscape(onClose);
  const dialogRef = useFocusTrap<HTMLElement>();

  // The access trail, exactly as in the queue's drawer: one log_report_view
  // per opening, written when the resident's account reaches the screen.
  // The ref survives React StrictMode's double-run of effects; reopening the
  // drawer remounts it, so a second look gets its own row. A failure never
  // blocks the read, and is never hidden.
  const loggedReportId = useRef<string | null>(null);
  useEffect(() => {
    if (loggedReportId.current === report.id) return;
    loggedReportId.current = report.id;
    void callAction(() => logReportView(report.id)).then((result) => {
      const outcome = result ?? "failed";
      if (outcome === "logged") return;
      showToast(t(outcome === "session-expired" ? "drawer.sessionExpired" : "drawer.notLogged"), "danger");
    });
  }, [report.id, showToast, t]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label={t("drawer.close")}
        className="absolute inset-0 bg-ink-900/40 motion-safe:animate-scrimIn"
        onClick={onClose}
      />

      <aside
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-report-title"
        className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-ink-100 bg-white shadow-panel focus:outline-none motion-safe:animate-drawerIn"
      >
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-ink-100 bg-white px-5 py-4">
          <div className="min-w-0">
            <p id="city-report-title" className="text-sm font-semibold text-ink-900">
              {report.category}
            </p>
            <p className="truncate text-xs text-ink-500">{barangayOf(report, t)}</p>
            <p className="truncate font-mono text-xs text-ink-500">{report.id}</p>
          </div>
          <Button variant="ghost" size="sm" className="min-w-11" onClick={onClose} aria-label={t("common.close")}>
            <Icon name="close" />
          </Button>
        </header>

        <div className="flex-1 px-5 py-4">
          {report.discreetReporting && (
            <p
              role="note"
              className="mb-4 flex items-start gap-2 rounded-md border border-priority-medium/30 bg-priority-mediumBg px-3 py-2 text-sm font-semibold text-priority-medium"
            >
              <Icon name="no-contact" className="mt-0.5" />
              {t("drawer.discreetBanner")}
            </p>
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <PriorityBadge priority={report.priority} />
            <span className="text-xs text-ink-500">{t(`drawer.tier.${report.entryTier}`)}</span>
            {reportsAlreadyResolved(report.safetyNetConfirmation) && (
              <span className="rounded-full bg-priority-mediumBg px-2 py-0.5 text-xs font-semibold text-priority-medium">
                {t("row.alreadyResolved")}
              </span>
            )}
          </div>

          <p className="mb-5 whitespace-pre-wrap text-sm text-ink-900">
            {report.description ?? <span className="text-ink-500">{t("drawer.noDescription")}</span>}
          </p>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {t("drawer.section.reporterSaid")}
          </p>
          <div className="mb-5">
            <Row label={t("drawer.severity")} value={report.severitySelfRating ?? <NotProvided />} />
            <Row label={t("drawer.anyoneHurt")} value={report.anyoneHurt ?? <NotProvided />} />
            <Row
              label={t("drawer.ongoing")}
              value={report.isOngoing === null ? <NotProvided /> : t(report.isOngoing ? "drawer.yes" : "drawer.no")}
            />
            <Row label={t("drawer.safetyNet")} value={report.safetyNetConfirmation ?? <NotProvided />} />
            <Row label={t("drawer.attachments")} value={attachmentSummary(report.hasPhoto, report.hasVideo, t)} />
          </div>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {t("drawer.section.triage")}
          </p>
          <div className="mb-5">
            <Row
              label={t("drawer.priority")}
              value={
                report.priority === null
                  ? <span className="text-ink-500">{t("drawer.notScoredYet")}</span>
                  : report.priorityScore === null
                    ? report.priority
                    : t("drawer.score", { priority: report.priority, score: report.priorityScore })
              }
            />
            {report.subCategory && <Row label={t("drawer.subCategory")} value={report.subCategory} />}
            <Row label={t("drawer.confidence")} value={report.confidenceBand ?? <NotProvided />} />
            <Row label={t("drawer.status")} value={statusLabel(report.status, t)} />
          </div>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {t("drawer.section.submission")}
          </p>
          <div className="mb-5">
            <Row
              label={t("field.reporter")}
              value={<ReporterChip reporter={{ name: "", identityWithheld: report.identityWithheld }} />}
            />
            <Row label={t("drawer.submitted")} value={formatTimestamp(report.submittedAt)} />
            {report.reviewedAt && <Row label={t("city.drawer.reviewed")} value={formatTimestamp(report.reviewedAt)} />}
          </div>

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
            {t("drawer.section.routing")}
          </p>
          <AgencySection routing={report.routing} resolvedAtBarangay={report.resolvedAtBarangay} />
        </div>

        <footer className="sticky bottom-0 border-t border-ink-100 bg-white px-5 py-3">
          <p className="text-xs text-ink-500">{t("city.drawer.readOnly")}</p>
        </footer>
      </aside>
    </div>
  );
}

function AgencySection({
  routing,
  resolvedAtBarangay,
}: {
  routing: AgencyRouting[] | null;
  resolvedAtBarangay: boolean;
}) {
  const t = useT();
  if (resolvedAtBarangay) return <p className="text-sm text-ink-700">{t("city.drawer.resolvedAtBarangay")}</p>;
  if (routing === null) return <p className="text-sm text-ink-500">{t("city.drawer.agenciesUnavailable")}</p>;
  if (routing.length === 0) return <p className="text-sm text-ink-700">{t("city.drawer.notRouted")}</p>;
  const { current, earlier } = splitRouting(routing);
  return (
    <div>
      {current.some((r) => r.autoRouted) && <p className="mb-2 text-xs text-ink-500">{t("drawer.autoRouted")}</p>}
      <AgencyList rows={current} />
      {earlier.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-xs text-ink-500">{t("drawer.returnedEarlier")}:</p>
          <AgencyList rows={earlier} />
        </div>
      )}
    </div>
  );
}

function AgencyList({ rows }: { rows: AgencyRouting[] }) {
  const t = useT();
  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={`${i}-${r.agencyName}`}
          className="flex items-start justify-between gap-4 border-b border-ink-100 py-2.5 last:border-0"
        >
          <p className="min-w-0 text-sm text-ink-900">
            {r.agencyName}
            {r.isPrimary && <span className="ml-1.5 text-xs text-ink-500">{t("routing.lead")}</span>}
          </p>
          <p className="shrink-0 text-right text-sm text-ink-900">
            {agencyProgressLabel(r, t)}
            <span className="block text-xs text-ink-500">{stageTime(r, t)}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

export function barangayOf(report: CityReport, t: Translate): string {
  if (report.barangayId === null) return t("city.noBarangay");
  return report.barangayName ?? t("city.unnamedBarangay");
}

function stageTime(r: AgencyRouting, t: Translate): string {
  if (r.resolvedAt) return t("drawer.stage.closed", { time: formatTimestamp(r.resolvedAt) });
  if (r.inProgressAt) return t("drawer.stage.inProgress", { time: formatTimestamp(r.inProgressAt) });
  if (r.acknowledgedAt) return t("drawer.stage.acknowledged", { time: formatTimestamp(r.acknowledgedAt) });
  if (r.routedAt) return t("drawer.stage.routed", { time: formatTimestamp(r.routedAt) });
  return "";
}

function NotProvided() {
  const t = useT();
  return <span className="text-ink-500">{t("drawer.notProvided")}</span>;
}

function attachmentSummary(hasPhoto: boolean, hasVideo: boolean, t: Translate): string {
  if (hasPhoto && hasVideo) return t("drawer.attach.both");
  if (hasPhoto) return t("drawer.attach.photo");
  if (hasVideo) return t("drawer.attach.video");
  return t("drawer.attach.none");
}

// Manila, like every time on the console.
export function formatTimestamp(isoString: string): string {
  return new Date(isoString).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
