"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { residentWho } from "@/components/verify-resident/who";
import { useT, type MessageKey, type Translate } from "@/lib/i18n";
import { ownValue } from "@/lib/utils";
// Type-only import from a server-only module — erased at compile time.
import type { SanctionHistoryEntry, SanctionRow } from "@/lib/data/sanctions";
import { EmptyState } from "@/components/ui/EmptyState";

// The backend's values. Lookups with a raw-text fallback, never closed
// unions: a value this console doesn't know is shown as itself.
const TRACK_LABELS: Record<string, MessageKey> = {
  inaccurate: "sanctions.track.inaccurate",
  malicious: "sanctions.track.malicious",
};
const CAUSE_LABELS: Record<string, MessageKey> = {
  inaccurate: "sanctions.cause.inaccurate",
  malicious: "sanctions.cause.malicious",
  sanction_lifted: "sanctions.cause.sanction_lifted",
};
const APPLIED_LABELS: Record<string, MessageKey> = {
  none: "sanctions.applied.none",
  cooldown: "sanctions.applied.cooldown",
  suspension: "sanctions.applied.suspension",
  lifted: "sanctions.applied.lifted",
};

const label = (labels: Record<string, MessageKey>, value: string, t: Translate): string => {
  const key = ownValue(labels, value);
  return key ? t(key) : value || "—";
};

// Two decimals: the score moves in steps of 0.05, and 0.5 is its neutral value.
const score = (value: number | null): string => (value === null ? "—" : value.toFixed(2));

function HistoryLine({ entry }: { entry: SanctionHistoryEntry }) {
  const t = useT();
  return (
    <li className="py-2 text-xs text-ink-700">
      <p>
        <span className="font-mono text-ink-500">{entry.on}</span>{" "}
        <span className="font-medium text-ink-900">{label(CAUSE_LABELS, entry.cause, t)}</span>
        {entry.sanction && entry.cause !== "sanction_lifted" && <> · {label(APPLIED_LABELS, entry.sanction, t)}</>}
      </p>
      <p className="mt-0.5 text-xs text-ink-500">
        {t("sanctions.history.score", { before: score(entry.scoreBefore), after: score(entry.scoreAfter) })}
        {entry.inaccurateStrikes !== null && entry.maliciousStrikes !== null && (
          <>
            {" · "}
            {t("sanctions.history.strikes", { inaccurate: entry.inaccurateStrikes, malicious: entry.maliciousStrikes })}
          </>
        )}
      </p>
      {entry.liftReason && (
        <p className="mt-0.5 text-xs text-ink-700">{t("sanctions.history.reason", { reason: entry.liftReason })}</p>
      )}
    </li>
  );
}

/**
 * The barangay's active cooldowns and suspensions, one card per resident
 * (thesis A.3.4): the track, how long is left, the strike counts, and the
 * resident's strikes and lifts so far.
 *
 * The track is always said in words beside its colour. The report behind a
 * strike is never shown: see getSanctions().
 */
export function SanctionList({
  rows,
  filtered,
  canLiftMalicious,
  historyUnavailable,
  onLift,
}: {
  rows: SanctionRow[];
  // True when a track chip is narrowing the list, so the empty state says so.
  filtered: boolean;
  // senior_barangay_admin only; the backend refuses anyone else.
  canLiftMalicious: boolean;
  historyUnavailable: boolean;
  onLift: (row: SanctionRow) => void;
}) {
  const t = useT();

  if (rows.length === 0) {
    return (
      <EmptyState icon="sanctions">
        <p className="text-sm font-medium text-ink-700">{t("sanctions.empty.title")}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-ink-500">
          {t(filtered ? "sanctions.empty.filtered" : "sanctions.empty.body")}
        </p>
      </EmptyState>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const malicious = row.seniorOnly;
        return (
          <li key={row.residentId} className="rounded-card border border-ink-100 bg-white px-4 py-3 shadow-panel">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-900">{row.name ?? t("verify.unnamed")}</p>
                {row.phoneEnding && (
                  <p className="text-xs text-ink-500">{t("verify.phoneEnding", { digits: row.phoneEnding })}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge tone={row.track === "malicious" ? "danger" : "warning"}>
                    {label(TRACK_LABELS, row.track, t)} · {t(`sanctions.kind.${row.kind}`)}
                  </Badge>
                  <span className="text-xs text-ink-700">
                    {row.kind === "suspension"
                      ? row.suspendedOn
                        ? `${t("sanctions.untilLifted")} · ${t("sanctions.suspendedOn", { date: row.suspendedOn })}`
                        : t("sanctions.untilLifted")
                      : row.cooldownEndsOn
                        ? t("sanctions.endsOn", { date: row.cooldownEndsOn })
                        : "—"}
                  </span>
                </div>
                {/* A suspended resident can also be inside a cooldown, on
                    either track; it decides who may lift, so it is said. */}
                {row.kind === "suspension" && row.cooldownEndsOn && (
                  <p className="mt-1 text-xs text-ink-700">
                    {t("sanctions.cooldownAlso", {
                      track: label(TRACK_LABELS, row.cooldownTrack ?? "", t),
                      date: row.cooldownEndsOn,
                    })}
                  </p>
                )}
                <p className="mt-1 text-xs text-ink-500">
                  {t("sanctions.strikes", { inaccurate: row.inaccurateStrikes, malicious: row.maliciousStrikes })}
                  {" · "}
                  {t("sanctions.trustScore", { score: score(row.trustScore) })}
                </p>
              </div>

              {malicious && !canLiftMalicious ? (
                <p className="max-w-[15rem] text-xs text-ink-500">{t("sanctions.seniorOnly")}</p>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  aria-label={t("sanctions.action.liftLabel", { whoOf: residentWho(row, t, "of") })}
                  onClick={() => onLift(row)}
                >
                  {t("sanctions.action.lift")}
                </Button>
              )}
            </div>

            {historyUnavailable ? (
              <p role="status" className="mt-2 text-xs text-priority-medium">
                {t("sanctions.history.unavailable")}
              </p>
            ) : (
              <details className="mt-2">
                {/* Left as a list item, so the browser's own marker shows that it
                    opens; the padding makes it 44 px tall. */}
                <summary className="cursor-pointer py-3.5 text-xs font-medium text-brand-700">
                  {t("sanctions.history.summary", { count: row.history.length })}
                </summary>
                {row.history.length === 0 ? (
                  <p className="text-xs text-ink-500">{t("sanctions.history.empty")}</p>
                ) : (
                  <ul className="divide-y divide-ink-100 border-t border-ink-100">
                    {row.history.map((entry) => (
                      <HistoryLine key={entry.id} entry={entry} />
                    ))}
                  </ul>
                )}
              </details>
            )}
          </li>
        );
      })}
    </ul>
  );
}
