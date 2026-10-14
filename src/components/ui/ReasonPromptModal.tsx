"use client";

import { useState } from "react";
import { Button } from "./Button";
import { useDismissOnEscape } from "./useDismissOnEscape";
import { useFocusTrap } from "./useFocusTrap";
import {
  composeRejectReason,
  cx,
  MAX_REJECT_NOTE_LENGTH,
  REJECT_REASON_CODES,
  type RejectReasonCode,
} from "@/lib/utils";
import { useLang, useT } from "@/lib/i18n";

/**
 * The reject prompt: a required reason category, and a note.
 *
 * The categories are the paper's (A.3.2) plus Other. None is preselected —
 * the point of a coded reason is an auditable choice, and a default would be
 * recorded for every official who didn't look. The note is optional except
 * for Other, where the category alone says nothing.
 *
 * onConfirm receives the composed reason (`[code] note`, see
 * composeRejectReason), so the callers and updateReportStatus keep their
 * signatures and review_report() still receives one text reason.
 */
export function ReasonPromptModal({
  title,
  description,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  // True while the decision is being written: the prompt stays open, with
  // the reason in it, until the answer arrives (CDRRMO dispatch's reject).
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [code, setCode] = useState<RejectReasonCode | null>(null);
  const [note, setNote] = useState("");
  const t = useT();
  const lang = useLang();
  useDismissOnEscape(onCancel, !busy);
  const dialogRef = useFocusTrap<HTMLDivElement>();
  const trimmedNote = note.trim();
  const noteRequired = code === "other";
  const ready = code !== null && (!noteRequired || trimmedNote.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <button
        aria-label={t("common.cancel")}
        className="absolute inset-0 bg-ink-900/40"
        onClick={onCancel}
        disabled={busy}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reason-prompt-title"
        className="relative w-full max-w-sm rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none"
      >
        <p id="reason-prompt-title" className="mb-1 text-sm font-semibold text-ink-900">
          {title}
        </p>
        <p className="mb-3 text-xs text-ink-500">{description}</p>

        <fieldset className="mb-3">
          <legend className="mb-1.5 text-xs font-medium text-ink-500">
            {t("reason.label")}
            {/* The English screen keeps the mockup Tagalog hint beside the term. */}
            {lang === "en" && (
              <>
                {" "}
                &middot; <span className="font-normal">dahilan</span>
              </>
            )}
          </legend>
          {/* Native radios: arrow keys move the choice within the group and
              Tab leaves it, with nothing to re-implement. Focus lands on the
              first option without choosing it. */}
          <div className="grid grid-cols-2 gap-1.5">
            {REJECT_REASON_CODES.map((option, index) => (
              <label
                key={option}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs transition-colors",
                  code === option
                    ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                    : "border-ink-100 text-ink-700 hover:bg-ink-50"
                )}
              >
                <input
                  type="radio"
                  name="reject-reason"
                  value={option}
                  checked={code === option}
                  onChange={() => setCode(option)}
                  autoFocus={index === 0}
                  className="h-4 w-4 accent-brand-500"
                />
                {t(`rejectReason.${option}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mb-1 block text-xs font-medium text-ink-500" htmlFor="reason-prompt-note">
          {t("reason.note")}{" "}
          <span className="font-normal">
            ({t(noteRequired ? "reason.noteRequired" : "reason.noteOptional")})
          </span>
        </label>
        <textarea
          id="reason-prompt-note"
          required={noteRequired}
          maxLength={MAX_REJECT_NOTE_LENGTH}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={t("reason.placeholder")}
          className="mb-4 w-full resize-none rounded-md border border-ink-100 bg-ink-50 px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            size="sm"
            disabled={!ready || busy}
            onClick={() => {
              if (code) onConfirm(composeRejectReason(code, trimmedNote));
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
