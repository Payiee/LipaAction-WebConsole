"use client";

import { useId, useState } from "react";
import { Button } from "./Button";
import { useDismissOnEscape } from "./useDismissOnEscape";
import { useFocusTrap } from "./useFocusTrap";
import { useT } from "@/lib/i18n";

/**
 * A confirmation that takes a required, free-text reason which the backend
 * records with the action.
 *
 * Separate from ReasonPromptModal on purpose. That one sits on the report
 * rejection path and stores a coded category; this one has no categories,
 * and reshaping a working write path to serve both would risk it for the
 * sake of a little shared markup.
 *
 * Focus lands on the dialog itself, not the textarea, so a screen reader
 * hears what is being confirmed, and anything passed as children, before the
 * first field.
 */
export function ReasonTextModal({
  title,
  description,
  label,
  placeholder,
  confirmLabel,
  maxLength,
  variant = "primary",
  busy = false,
  children,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  maxLength: number;
  variant?: "primary" | "danger";
  busy?: boolean;
  // Shown between the description and the reason: what the action will do.
  children?: React.ReactNode;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const t = useT();
  const titleId = useId();
  const fieldId = useId();
  // Not while the write is running: the answer would arrive with no dialog
  // left to report it in.
  useDismissOnEscape(onCancel, !busy);
  const dialogRef = useFocusTrap<HTMLFormElement>();
  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !busy;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit) onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        type="button"
        aria-label={t("common.cancel")}
        className="absolute inset-0 bg-ink-900/40 motion-safe:animate-scrimIn"
        onClick={onCancel}
        disabled={busy}
      />
      <form
        ref={dialogRef}
        tabIndex={-1}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none motion-safe:animate-dialogIn"
      >
        <p id={titleId} className="mb-1 text-sm font-semibold text-ink-900">
          {title}
        </p>
        <p className="mb-3 text-xs text-ink-500">{description}</p>

        {children}

        <label className="mb-1 flex items-baseline justify-between gap-2 text-xs font-medium text-ink-500" htmlFor={fieldId}>
          <span>
            {label} <span className="font-normal">({t("common.required")})</span>
          </span>
          <span className="font-mono font-normal tabular-nums" aria-hidden>
            {reason.length}/{maxLength}
          </span>
        </label>
        <textarea
          id={fieldId}
          required
          maxLength={maxLength}
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          className="mb-4 w-full resize-none rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant={variant} size="sm" type="submit" disabled={!canSubmit}>
            {busy ? t("common.working") : confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
