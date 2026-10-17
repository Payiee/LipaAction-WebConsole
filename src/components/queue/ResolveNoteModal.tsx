"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDismissOnEscape } from "@/components/ui/useDismissOnEscape";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { MAX_REASON_LENGTH } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * The prompt before a report is resolved at the barangay: what it means,
 * and a required note saying what was done.
 *
 * The note is required because it is the only record of why no agency was
 * involved. Focus lands on the dialog itself, not the note, so the
 * description (it can't be undone) is read before anything is typed, as
 * with the routing confirmation.
 */
export function ResolveNoteModal({
  reportId,
  busy = false,
  onCancel,
  onConfirm,
}: {
  reportId: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const t = useT();
  // Not while saving, the same reason Cancel is disabled then.
  useDismissOnEscape(onCancel, !busy);
  const dialogRef = useFocusTrap<HTMLFormElement>();
  const trimmed = note.trim();
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
        aria-labelledby="resolve-note-title"
        aria-describedby="resolve-note-description"
        className="relative w-full max-w-sm rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none motion-safe:animate-dialogIn"
      >
        <p id="resolve-note-title" className="mb-1 text-sm font-semibold text-ink-900">
          {t("resolve.title", { id: reportId })}
        </p>
        <p id="resolve-note-description" className="mb-3 text-xs text-ink-500">
          {t("resolve.description")}
        </p>

        <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="resolve-note-input">
          {t("resolve.noteLabel")}
        </label>
        <textarea
          id="resolve-note-input"
          required
          maxLength={MAX_REASON_LENGTH}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("resolve.notePlaceholder")}
          className="mb-4 w-full resize-none rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={!canSubmit}>
            {busy ? t("common.saving") : t("resolve.confirm")}
          </Button>
        </div>
      </form>
    </div>
  );
}
