"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDismissOnEscape } from "@/components/ui/useDismissOnEscape";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { ATTEST_METHODS, type AttestMethod } from "@/lib/residents";

/**
 * The attestation itself (thesis A.3.9): how residency was established, and
 * the official's own statement that the person lives in the barangay.
 *
 * No method is preselected and the statement is not pre-ticked. Both are
 * what the record says about this official's act, and a default would be
 * recorded for anyone who didn't read it. There is no free-text field, by
 * the backend's design: nothing of the ID or proof shown is stored.
 *
 * Focus lands on the dialog, so who is being verified is announced before any
 * control, and the first Tab reaches the methods before the commit button.
 */
export function AttestModal({
  who,
  barangayName,
  busy = false,
  onCancel,
  onConfirm,
}: {
  // The resident by name, or by their phone number's ending when the
  // profile has no name: see residentWho().
  who: string;
  barangayName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (method: AttestMethod) => void;
}) {
  const [method, setMethod] = useState<AttestMethod | null>(null);
  const [attested, setAttested] = useState(false);
  const t = useT();
  // Not while the write is running.
  useDismissOnEscape(onCancel, !busy);
  const dialogRef = useFocusTrap<HTMLFormElement>();
  const ready = method !== null && attested && !busy;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (ready && method) onConfirm(method);
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
        aria-labelledby="attest-modal-title"
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none motion-safe:animate-dialogIn"
      >
        <p id="attest-modal-title" className="mb-1 text-sm font-semibold text-ink-900">
          {t("verify.attest.title", { who })}
        </p>
        <p className="mb-3 text-xs text-ink-500">{t("verify.attest.description")}</p>

        <fieldset className="mb-3" disabled={busy}>
          <legend className="mb-1.5 text-xs font-medium text-ink-500">{t("verify.attest.method")}</legend>
          {/* Native radios: arrow keys move the choice within the group and
              Tab leaves it. */}
          <div className="flex flex-col gap-1.5">
            {ATTEST_METHODS.map((option) => (
              <label
                key={option}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-1.5 text-xs transition-colors",
                  method === option
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-ink-100 text-ink-700 hover:bg-ink-50"
                )}
              >
                <input
                  type="radio"
                  name="attest-method"
                  value={option}
                  checked={method === option}
                  onChange={() => setMethod(option)}
                  className="h-4 w-4 shrink-0 accent-brand-500"
                />
                <span>
                  <span className="font-medium">{t(`verify.method.${option}`)}</span>
                  <span className="block text-xs text-ink-500">{t(`verify.attest.hint.${option}`)}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mb-3 flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border border-ink-100 px-3 py-2 text-xs text-ink-700">
          <input
            type="checkbox"
            checked={attested}
            disabled={busy}
            onChange={(e) => setAttested(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-brand-500"
          />
          <span>{t("verify.attest.oath", { who, barangay: barangayName })}</span>
        </label>

        <p role="note" className="mb-4 rounded-md bg-ink-50 px-3 py-2 text-xs text-ink-700">
          {t("verify.attest.minimization")}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={!ready}>
            {busy ? t("common.working") : t("verify.attest.confirm")}
          </Button>
        </div>
      </form>
    </div>
  );
}
