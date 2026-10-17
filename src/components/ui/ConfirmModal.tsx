"use client";

import { Button } from "./Button";
import { useDismissOnEscape } from "./useDismissOnEscape";
import { useFocusTrap } from "./useFocusTrap";
import { useT } from "@/lib/i18n";

/**
 * Plain yes/no confirmation. ReasonPromptModal covers the case where a reason
 * is mandatory (rejection); this one is for an action that needs a deliberate
 * second step but no free text — notably validating a whole cluster at once,
 * where the click commits several reports rather than one.
 */
export function ConfirmModal({
  title,
  description,
  confirmLabel,
  variant = "primary",
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Not while the cluster write is running.
  const t = useT();
  useDismissOnEscape(onCancel, !busy);
  // No autoFocus inside: focus lands on the dialog itself so the title is
  // announced first, and the first Tab reaches Cancel before the commit
  // button — the safe order for an action that writes several reports.
  const dialogRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        aria-label={t("common.cancel")}
        className="absolute inset-0 bg-ink-900/40 motion-safe:animate-scrimIn"
        onClick={onCancel}
        disabled={busy}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative w-full max-w-sm rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none motion-safe:animate-dialogIn"
      >
        <p id="confirm-modal-title" className="mb-1 text-sm font-semibold text-ink-900">
          {title}
        </p>
        <p className="mb-4 text-xs text-ink-500">{description}</p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant={variant} size="sm" disabled={busy} onClick={onConfirm}>
            {busy ? t("common.working") : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
