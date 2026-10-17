"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PrintButton } from "@/components/ui/PrintButton";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { useRecordedExport } from "@/components/ui/useRecordedExport";
import { downloadCsv } from "@/lib/downloadCsv";
import { DATA_EXPORTED, type ExportKind } from "@/lib/exports";
import { cx, manilaTimestamp, ownValue } from "@/lib/utils";
import { useT, type MessageKey, type Translate } from "@/lib/i18n";
import { accessLogCsvRows } from "./accessLogCsv";
import { ACCESS_LOG_KINDS, ACCESS_LOG_OPENED, REPORT_ACTIONS, isAccessLogKind, type AccessLogKind } from "@/lib/accessLog";
// Type-only imports from a server-only module — erased at compile time.
import type { AccessLogData, AccessLogDetail, AccessLogEntry } from "@/lib/data/cityAccessLog";

const KIND_LABELS: Record<AccessLogKind, MessageKey> = {
  all: "audit.filter.all",
  openings: "audit.filter.openings",
  decisions: "audit.filter.decisions",
  routing: "city.access.kind.routing",
  exports: "city.access.kind.exports",
  other: "city.access.kind.other",
};

// The actions this console knows. Any other renders as its raw text rather
// than disappearing: action is free text, and a new backend event must still
// be readable here.
const ACTION_LABELS: Record<string, MessageKey> = {
  report_viewed: "audit.action.report_viewed",
  report_validated: "audit.action.report_validated",
  report_rejected: "audit.action.report_rejected",
  report_resolved_at_barangay: "audit.action.report_resolved_at_barangay",
  report_routed_manual: "audit.action.report_routed_manual",
  report_auto_routed: "audit.action.report_auto_routed",
  routing_in_progress: "audit.action.routing_in_progress",
  report_resolved_by_agencies: "audit.action.report_resolved_by_agencies",
  report_returned_to_barangay: "audit.action.report_returned_to_barangay",
  report_status_changed: "audit.action.report_status_changed",
  identity_reveal: "audit.action.identity_reveal",
  // Backend-written events seen raw on the live trail (2026-10-05).
  report_submitted: "audit.action.report_submitted",
  resident_sanction_lifted: "audit.action.resident_sanction_lifted",
  profile_scope_changed: "audit.action.profile_scope_changed",
  report_message_sent: "audit.action.report_message_sent",
  // Seen raw on the live trail (2026-10-11).
  consent_granted: "audit.action.consent_granted",
  media_phashes_purged: "audit.action.media_phashes_purged",
  resident_attested_tier1: "audit.action.resident_attested_tier1",
  trust_score_changed: "audit.action.trust_score_changed",
  // CDRRMO dispatch's own events (backend spec 3.2-3.5), once its
  // allow-list change to barangay_audit_log is live. Kept apart from the
  // barangay's report_validated / report_rejected.
  report_validated_cdrrmo: "audit.action.report_validated_cdrrmo",
  report_rejected_cdrrmo: "audit.action.report_rejected_cdrrmo",
  report_reject_overridden_cdrrmo: "audit.action.report_reject_overridden_cdrrmo",
  report_agencies_added_cdrrmo: "audit.action.report_agencies_added_cdrrmo",
  cdrrmo_media_view: "audit.action.cdrrmo_media_view",
  [ACCESS_LOG_OPENED]: "city.access.action.opened",
  [DATA_EXPORTED]: "city.access.action.exported",
};

const ACTION_TONES: Record<string, "neutral" | "brand" | "warning"> = {
  report_validated: "brand",
  report_rejected: "warning",
  report_resolved_at_barangay: "brand",
  report_routed_manual: "brand",
  report_auto_routed: "brand",
  report_resolved_by_agencies: "brand",
  report_returned_to_barangay: "warning",
  identity_reveal: "warning",
  resident_sanction_lifted: "brand",
  resident_attested_tier1: "brand",
  profile_scope_changed: "warning",
  report_validated_cdrrmo: "brand",
  report_rejected_cdrrmo: "warning",
  report_reject_overridden_cdrrmo: "warning",
  report_agencies_added_cdrrmo: "brand",
};

// Known roles get a label; an unknown one shows as itself, a missing one as
// a dash.
const ROLE_LABELS: Record<string, MessageKey> = {
  barangay_official: "role.barangay_official",
  barangay_admin: "role.barangay_admin",
  senior_barangay_admin: "role.senior_barangay_admin",
  municipal_admin: "role.municipal_admin",
  agency_user: "role.agency_user",
  agency_supervisor: "role.agency_supervisor",
  dpo: "role.dpo",
  resident: "role.resident",
};

// What each of this console's exports is called in the trail, in words. The
// type makes a new export a compile error until it has a name here. Another
// console can record a name this one doesn't know; that shows as itself.
const EXPORT_LABELS: Record<ExportKind, MessageKey> = {
  validation_history_csv: "export.kind.validation_history_csv",
  validation_history_print: "export.kind.validation_history_print",
  audit_log_csv: "export.kind.audit_log_csv",
  access_log_csv: "export.kind.access_log_csv",
  access_log_print: "export.kind.access_log_print",
  verification_activity_csv: "export.kind.verification_activity_csv",
  verification_activity_print: "export.kind.verification_activity_print",
  city_reports_csv: "export.kind.city_reports_csv",
};

/** The page's address for a kind and a date range, defaults left out. */
function accessLogHref(kind: AccessLogKind, from: string | null, to: string | null): string {
  const params = new URLSearchParams();
  if (kind !== "all") params.set("kind", kind);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  return qs ? `/city/access-log?${qs}` : "/city/access-log";
}

/**
 * The city access log: each recorded event with the official behind it.
 * The kind and the date range live in the URL, so the server does the
 * narrowing over the whole trail, not over a window already loaded, and each
 * view is recorded. Neither is personal data: a kind of event and two days.
 *
 * The export and the print are the thesis's RA 10173 Data Access Log for
 * data-protection requests (A.5.7). They name officials, so each is written
 * to the trail before it happens, and doesn't happen otherwise.
 */
export function AccessLogView({ data }: { data: AccessLogData }) {
  const t = useT();
  const router = useRouter();
  const { showToast } = useToast();
  const { record, busy } = useRecordedExport();
  const [from, setFrom] = useState(data.from ?? "");
  const [to, setTo] = useState(data.to ?? "");

  // The boxes follow the range the server actually used: it drops a day
  // that doesn't exist and turns a backwards range around. Every fresh
  // render resets them, so a value the server dropped doesn't linger.
  useEffect(() => {
    setFrom(data.from ?? "");
    setTo(data.to ?? "");
  }, [data.from, data.to, data.renderId]);

  function choose(kind: AccessLogKind) {
    router.push(accessLogHref(kind, data.from, data.to));
  }

  function applyRange(e: React.FormEvent) {
    e.preventDefault();
    router.push(accessLogHref(data.kind, from || null, to || null));
  }

  async function handleExport() {
    if (data.entries.length === 0) {
      showToast(t("history.exportNothing"), "info");
      return;
    }
    if (!(await record("access_log_csv", data.entries.length))) return;
    // Dated in Manila: toISOString() is UTC, and would name a file made
    // before 8am for the previous day.
    const day = manilaTimestamp(new Date().toISOString()).slice(0, 10);
    downloadCsv(`access-log-${data.kind}-${day}.csv`, accessLogCsvRows(data, ACTION_LABELS, ROLE_LABELS));
    showToast(t("audit.exported", { count: data.entries.length }), "success");
  }

  return (
    <section aria-labelledby="city-access-title" data-printable="access-log" className="mb-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="city-access-title" className="text-sm font-semibold text-ink-900">
            {t("city.access.title")}
          </h2>
          <p className="text-xs text-ink-500">{t("city.access.intro")}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 print:hidden">
          <Button variant="secondary" size="sm" disabled={busy || data.loadFailed} onClick={handleExport}>
            {busy ? t("common.working") : t("history.export")}
          </Button>
          <PrintButton section="access-log" record={{ what: "access_log_print", rows: data.entries.length }} />
          <p className="basis-full text-right text-xs text-ink-500">{t("export.recordedNote")}</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-4">
        <Tile label={t("audit.tile.total")} value={data.summary.events} />
        <Tile label={t("audit.tile.openings")} value={data.summary.openings} />
        <Tile label={t("audit.tile.decisions")} value={data.summary.decisions} accent="brand" />
        <Tile label={t("city.access.tile.officials")} value={data.summary.officials} />
      </div>

      {/* Two days and an explicit button: a date box fires on every keystroke
          of a typed year, and each load of this page writes a record. */}
      <form onSubmit={applyRange} className="mb-3 flex flex-wrap items-end gap-2 print:hidden">
        <label className="text-xs font-medium text-ink-500">
          <span className="mb-1 block">{t("city.access.range.from")}</span>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className="min-h-11 rounded-md border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="text-xs font-medium text-ink-500">
          <span className="mb-1 block">{t("city.access.range.to")}</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="min-h-11 rounded-md border border-ink-100 bg-white px-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <Button variant="secondary" size="sm" type="submit">
          {t("city.access.range.apply")}
        </Button>
        {(data.from || data.to) && (
          <Button variant="ghost" size="sm" type="button" onClick={() => router.push(accessLogHref(data.kind, null, null))}>
            {t("city.access.range.clear")}
          </Button>
        )}
      </form>

      <div role="group" aria-label={t("city.access.filter")} className="mb-4 flex flex-wrap gap-2 print:hidden">
        {ACCESS_LOG_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            aria-pressed={data.kind === kind}
            onClick={() => choose(kind)}
            className={cx(
              "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
              data.kind === kind
                ? "border-brand-500 bg-brand-100 text-brand-700"
                : "border-ink-100 bg-white text-ink-700 hover:bg-ink-100"
            )}
          >
            {t(KIND_LABELS[kind])}
          </button>
        ))}
      </div>

      {data.entries.length === 0 ? (
        !data.loadFailed && (
          <div className="rounded-card border border-ink-100 bg-white px-4 py-10 text-center shadow-panel">
            <p className="text-sm text-ink-500">
              {/* With dates chosen, [none recorded yet] would be untrue: there
                  may be events outside them. */}
              {t(
                data.from || data.to
                  ? "city.access.emptyRange"
                  : data.kind === "all"
                    ? "city.access.empty"
                    : "city.access.emptyFiltered"
              )}
            </p>
          </div>
        )
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel print:overflow-visible">
          <table className="w-full min-w-[760px] text-left text-sm print:min-w-0">
            <caption className="sr-only">{t("city.access.caption")}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("field.timestamp")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.access.col.who")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("audit.col.role")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("audit.col.action")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("audit.col.report")}</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => {
                const actionKey = ACTION_LABELS[entry.action];
                const roleKey = entry.actorRole ? ROLE_LABELS[entry.actorRole] : undefined;
                return (
                  <tr key={entry.id} className="border-b border-ink-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-ink-500">{entry.timestamp}</td>
                    <td className="px-4 py-2.5">{actorCell(entry, data.namesUnavailable, t)}</td>
                    <td className="px-4 py-2.5 text-xs text-ink-700">
                      {roleKey ? t(roleKey) : entry.actorRole || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={ACTION_TONES[entry.action] ?? "neutral"}>
                        {actionKey ? t(actionKey) : entry.action}
                      </Badge>
                      {entry.detail && <p className="mt-1 text-xs text-ink-500">{detailLine(entry.detail, t)}</p>}
                    </td>
                    <td className="px-4 py-2.5">{reportCell(entry, t)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">
        {t("city.access.footer", { count: data.entries.length })}
        {(data.from || data.to) &&
          ` ${t("city.access.range.footer", { from: data.from ?? t("city.access.range.open"), to: data.to ?? t("city.access.range.open") })}`}
        {data.capped && ` ${t("city.access.capped", { limit: data.limit })}`}
      </p>
    </section>
  );
}

// Who did it. Only officials are named; a resident is shown by role alone,
// and an event the database wrote by itself says so.
function actorCell(entry: AccessLogEntry, namesUnavailable: boolean, t: Translate) {
  const { actor } = entry;
  if (actor.kind !== "official") {
    const key: MessageKey =
      actor.kind === "resident" ? "city.access.resident" : actor.kind === "system" ? "city.access.system" : "city.access.notNamed";
    return <span className="text-xs italic text-ink-500">{t(key)}</span>;
  }
  const name = actor.name ?? t(namesUnavailable ? "city.access.nameUnavailable" : "city.access.unnamed");
  const office = actor.office === null ? null : actor.office.type === "city" ? t("city.scope") : actor.office.name;
  return (
    <div className="leading-tight">
      <p className="text-xs font-medium text-ink-900">{name}</p>
      {office && <p className="text-xs text-ink-500">{office}</p>}
    </div>
  );
}

// What a console-written event adds: the view of this log that was opened,
// or what was exported and how many rows.
function detailLine(detail: AccessLogDetail, t: Translate): string {
  if (detail.type === "view") {
    return t("city.access.detail.view", {
      view: isAccessLogKind(detail.filter) ? t(KIND_LABELS[detail.filter]) : detail.filter,
    });
  }
  const key = ownValue(EXPORT_LABELS as Record<string, MessageKey>, detail.what);
  const what = key ? t(key) : detail.what;
  if (detail.rows === null) return what;
  return detail.rows === 1
    ? t("city.access.detail.exportOne", { what })
    : t("city.access.detail.export", { what, count: detail.rows });
}

function reportCell(entry: AccessLogEntry, t: Translate) {
  if (!entry.reportId) {
    // A report event without a report: the report was deleted, which blanks
    // the id on its audit rows. Anything else was never about a report.
    return REPORT_ACTIONS.includes(entry.action) ? (
      <span className="text-xs text-ink-500">{t("audit.reportGone")}</span>
    ) : (
      <span className="text-xs text-ink-500">—</span>
    );
  }
  return (
    <div className="leading-tight">
      <p className="font-mono text-xs text-ink-700">{entry.reportId}</p>
      {entry.category && <p className="text-xs text-ink-500">{entry.category}</p>}
    </div>
  );
}
