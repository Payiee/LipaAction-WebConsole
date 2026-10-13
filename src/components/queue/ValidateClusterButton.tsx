"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/Toast";
import { validateReports } from "@/app/actions/reports";
import { callAction } from "@/lib/callAction";
import { useT } from "@/lib/i18n";
import type { SituationCluster } from "@/types";
import { useCdrrmoDispatch } from "./CdrrmoDispatchContext";

/**
 * The members a bulk validation actually decided: every id the action didn't
 * report as failed. Nothing when it validated none, including a request it
 * refused outright, whose single failure carries no report id.
 */
export function validatedMembers(
  ids: string[],
  result: { validated: number; failures: { reportId: string }[] }
): string[] {
  if (result.validated === 0) return [];
  const failed = new Set(result.failures.map((f) => f.reportId.toLowerCase()));
  return ids.filter((id) => !failed.has(id.toLowerCase()));
}

/**
 * [Validate as one cluster]: one review_report() per member, behind a
 * confirmation. Shared by the Emergency tab's card and every group on the
 * Flagged duplicates tab, so the two can't drift on what they say.
 *
 * onValidated receives the ids that were validated, and whether that was
 * every member, so the caller can mark those rows as decided before the
 * next refresh removes them.
 */
export function ValidateClusterButton({
  cluster,
  onValidated,
}: {
  cluster: SituationCluster;
  onValidated: (validatedIds: string[], all: boolean) => void;
}) {
  const { showToast } = useToast();
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const dispatch = useCdrrmoDispatch();

  function handleValidate() {
    startTransition(async () => {
      const ids = cluster.members.map((m) => m.id);
      const result = await callAction(() => validateReports(ids));
      setShowConfirm(false);
      if (result === null) {
        showToast(t("common.noAnswer"), "danger");
        return;
      }
      const { validated, failures } = result;
      const validatedIds = validatedMembers(ids, result);

      // Partial success is the normal case here, not an edge case: another
      // official can review one member between page load and this click. Say
      // exactly what happened rather than rounding it to success.
      // `validated > 0` guards the success branch: a zero-length member list
      // would otherwise report [Validated all 0 reports] as a success. Not
      // reachable today — a group needs 2+ members to render — but a success
      // toast for work that did not happen is the exact failure this button
      // was fixed to stop making.
      if (failures.length === 0 && validated > 0) {
        showToast(t("cluster.toast.all", { count: validated, id: cluster.id }), "success");
      } else if (validated > 0) {
        showToast(
          t("cluster.toast.partial", {
            validated,
            total: cluster.members.length,
            failed: failures.length,
          }),
          "info"
        );
      } else {
        // The server's own reason when it gave one, which stays English like
        // every message a server action returns.
        showToast(failures[0]?.message ?? t("cluster.toast.failed"), "danger");
      }
      if (validatedIds.length > 0) onValidated(validatedIds, failures.length === 0);
    });
  }

  // The flagger weighs category rather than requiring it to match, so a group
  // can hold a fire and a medical emergency. Validating them together is a
  // claim about each one, so the confirmation names the mix.
  const description =
    cluster.categories.length > 1
      ? `${t("cluster.confirm.body")} ${t("cluster.confirm.mixed", { categories: cluster.categories.join(", ") })}`
      : t("cluster.confirm.body");

  // With CDRRMO dispatch on, an Emergency report is validated one at a time
  // through Validate, which routes it too, and review_report() refuses it.
  // A group of Emergency reports only would fail every member, so it offers
  // no group button; a mixed group still validates its Other-reports, and
  // each Emergency member comes back with that refusal's message.
  if (dispatch.active && cluster.members.every((m) => m.details.entryTier === "emergency")) return null;

  return (
    <>
      <Button variant="primary" size="sm" disabled={isPending} onClick={() => setShowConfirm(true)}>
        {t("cluster.card.validate")}
      </Button>
      {showConfirm && (
        <ConfirmModal
          title={t("cluster.confirm.title", { count: cluster.memberCount, id: cluster.id })}
          description={description}
          confirmLabel={t("cluster.confirm.label", { count: cluster.memberCount })}
          busy={isPending}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleValidate}
        />
      )}
    </>
  );
}
