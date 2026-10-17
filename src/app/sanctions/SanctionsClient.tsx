"use client";

import { useMemo, useState, useTransition } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { DataUnavailableBanner } from "@/components/layout/DataUnavailableBanner";
import { ReasonTextModal } from "@/components/ui/ReasonTextModal";
import { useToast } from "@/components/ui/Toast";
import { SanctionList } from "@/components/sanctions/SanctionList";
import { residentWho, sentenceCase } from "@/components/verify-resident/who";
import { liftSanction } from "@/app/actions/sanctions";
import { callAction } from "@/lib/callAction";
import { cx, displayName } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";
import { isSeniorBarangayAdminRole } from "@/lib/roles";
import { MAX_LIFT_REASON_LENGTH, SANCTION_TRACK_FILTERS, type SanctionTrackFilter } from "@/lib/sanctions";
import type { WriteOutcome } from "@/lib/writeOutcome";
import type { BarangayAdminProfile } from "@/lib/auth";
// Type-only import from a server-only module — erased at compile time.
import type { SanctionRow, SanctionsData } from "@/lib/data/sanctions";

const FILTER_LABELS: Record<SanctionTrackFilter, MessageKey> = {
  all: "sanctions.filter.all",
  inaccurate: "sanctions.track.inaccurate",
  malicious: "sanctions.track.malicious",
};

const OUTCOME_MESSAGES: Record<Exclude<WriteOutcome, "done" | "stale">, MessageKey> = {
  invalid: "outcome.invalid",
  "not-eligible": "outcome.invalid",
  refused: "sanctions.toast.refused",
  "session-expired": "outcome.sessionExpired",
  unreachable: "outcome.unreachable",
  failed: "outcome.failed",
};

export function SanctionsClient({
  official,
  data,
}: {
  official: BarangayAdminProfile;
  data: SanctionsData;
}) {
  const t = useT();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [track, setTrack] = useState<SanctionTrackFilter>("all");
  const [lifting, setLifting] = useState<SanctionRow | null>(null);
  const canLiftMalicious = isSeniorBarangayAdminRole(official.role);

  // The malicious chip holds everything only a senior admin may lift, which
  // is the same split the lift button and the home's cards use.
  const counts = useMemo(
    () => ({
      all: data.rows.length,
      inaccurate: data.rows.filter((r) => !r.seniorOnly).length,
      malicious: data.rows.filter((r) => r.seniorOnly).length,
    }),
    [data.rows]
  );
  const shown = useMemo(
    () => data.rows.filter((r) => track === "all" || (track === "malicious") === r.seniorOnly),
    [data.rows, track]
  );

  function handleLift(reason: string) {
    const row = lifting;
    if (!row) return;
    startTransition(async () => {
      const outcome = await callAction(() => liftSanction(row.residentId, reason));
      const who = residentWho(row, t);
      if (outcome === null) {
        // No answer: the lift may or may not have landed. The dialog stays
        // open, and the toast says to look before trying again.
        showToast(t("outcome.noAnswer"), "danger");
      } else if (outcome === "done") {
        showToast(sentenceCase(t("sanctions.toast.lifted", { who })), "success");
        setLifting(null);
      } else if (outcome === "stale") {
        // Not an error: the list was behind, and the action has refreshed it.
        showToast(sentenceCase(t("sanctions.toast.stale", { who })), "info");
        setLifting(null);
      } else {
        showToast(t(OUTCOME_MESSAGES[outcome]), "danger");
      }
    });
  }

  return (
    <AppShell breadcrumb={[official.barangayName, t("nav.sanctions")]} official={official}>
      {data.loadFailed && <DataUnavailableBanner what={t("banner.what.sanctions")} />}

      {/* What a sanction is, who may lift which, and what the page keeps to
          itself, before any name. */}
      <div role="note" className="mb-4 rounded-card border border-ink-100 bg-ink-50 px-4 py-3 text-xs text-ink-700">
        <p>{t("sanctions.intro")}</p>
        <p className="mt-1">{t("sanctions.gate")}</p>
        <p className="mt-1 text-ink-500">{t("sanctions.privacy")}</p>
      </div>

      {/* Under a failed load the banner speaks alone: no chips counting zero,
          no sentence saying nobody is sanctioned. */}
      {!data.loadFailed && (
        <>
      <div role="group" aria-label={t("sanctions.filter.label")} className="mb-3 flex flex-wrap items-center gap-1.5">
        {SANCTION_TRACK_FILTERS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={track === id}
            onClick={() => setTrack(id)}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors",
              track === id ? "bg-brand-500 text-white" : "border border-ink-100 bg-white text-ink-700 hover:bg-ink-50"
            )}
          >
            {t(FILTER_LABELS[id])} ({counts[id]})
          </button>
        ))}
      </div>

      <SanctionList
        rows={shown}
        filtered={track !== "all"}
        canLiftMalicious={canLiftMalicious}
        historyUnavailable={data.historyUnavailable}
        onLift={setLifting}
      />
        </>
      )}

      {!data.loadFailed && data.rows.length > 0 && (
        <p className="mt-3 text-xs text-ink-500">
          {data.capped
            ? t("sanctions.footerCapped", { limit: data.limit })
            : data.rows.length === 1
              ? t("sanctions.footerOne")
              : t("sanctions.footer", { count: data.rows.length })}
        </p>
      )}

      {lifting && (
        <ReasonTextModal
          title={t("sanctions.lift.title", { whoOf: residentWho(lifting, t, "of") })}
          description={t("sanctions.lift.description")}
          label={t("reason.label")}
          placeholder={t("sanctions.lift.placeholder")}
          confirmLabel={t("sanctions.lift.confirm")}
          maxLength={MAX_LIFT_REASON_LENGTH}
          busy={isPending}
          onCancel={() => setLifting(null)}
          onConfirm={handleLift}
        >
          {/* What the lift will do, as the backend does it, and under whose
              name: the thesis's state-change checklist and role-gate banner. */}
          <div className="mb-3 rounded-md border border-ink-100 px-3 py-2">
            <p className="mb-1 text-xs font-medium text-ink-700">{t("sanctions.lift.effects")}</p>
            <ul className="list-disc space-y-0.5 pl-4 text-xs text-ink-700">
              <li>{t("sanctions.lift.effect.score")}</li>
              <li>{t("sanctions.lift.effect.ends")}</li>
              <li>
                {t(lifting.kind === "suspension" ? "sanctions.lift.effect.strikesSuspension" : "sanctions.lift.effect.strikesCooldown")}
              </li>
              <li>{t("sanctions.lift.effect.tier")}</li>
              <li>{t("sanctions.lift.effect.recorded")}</li>
            </ul>
          </div>
          <p role="note" className="mb-3 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-700">
            {t("sanctions.gate")}{" "}
            {t("sanctions.lift.actor", { name: displayName(official.fullName), role: t(`role.${official.role}`) })}
          </p>
        </ReasonTextModal>
      )}
    </AppShell>
  );
}
