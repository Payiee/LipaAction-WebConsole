"use client";

import { useState } from "react";
import { Button } from "./Button";
import { useDismissOnEscape } from "./useDismissOnEscape";
import { useFocusTrap } from "./useFocusTrap";
import { useT } from "@/lib/i18n";

/**
 * Single-line text prompt with Save/Cancel.
 *
 * Deliberately separate from ReasonPromptModal rather than a generalisation
 * of it: that one is a multi-line, destructive-styled prompt sitting on the
 * report-rejection path, and reshaping it to serve both would put a working
 * write path at risk for the sake of removing a little duplication.
 */
export function TextPromptModal({
  title,
  description,
  label,
  initialValue = "",
  confirmLabel,
  maxLength,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  label: string;
  initialValue?: string;
  confirmLabel: string;
  maxLength?: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  // Not while saving — same reason Cancel is disabled then.
  const t = useT();
  useDismissOnEscape(onCancel, !busy);
  const dialogRef = useFocusTrap<HTMLFormElement>();
  const trimmed = value.trim();
  // Nothing typed, or nothing changed — no point submitting either.
  const canSubmit = trimmed.length > 0 && trimmed !== initialValue.trim() && !busy;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (canSubmit) onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
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
        aria-labelledby="text-prompt-title"
        className="relative w-full max-w-sm rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none motion-safe:animate-dialogIn"
      >
        <p id="text-prompt-title" className="mb-1 text-sm font-semibold text-ink-900">
          {title}
        </p>
        <p className="mb-3 text-xs text-ink-500">{description}</p>

        <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="text-prompt-input">
          {label}
        </label>
        <input
          id="text-prompt-input"
          autoFocus
          type="text"
          value={value}
          maxLength={maxLength}
          onChange={(e) => setValue(e.target.value)}
          className="mb-4 min-h-11 w-full rounded-md border border-ink-100 bg-ink-50 px-3 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={!canSubmit}>
            {busy ? t("common.saving") : confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
