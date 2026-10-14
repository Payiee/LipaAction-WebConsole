"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useDismissOnEscape } from "@/components/ui/useDismissOnEscape";
import { useFocusTrap } from "@/components/ui/useFocusTrap";
import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { agencyCount } from "./routing";
import type { RoutingOption } from "@/types";

/**
 * Chooses the agencies a report goes to — where an official, not the category
 * mapping, decides who receives it. Opened in three cases: a validated report
 * no agency holds yet, where the category's agencies carry a Recommended tag
 * and nothing is ticked (agencies asked for this, 2026-10-14: not every
 * office is on duty around the clock); the same list as an Emergency
 * report's Validate while CDRRMO dispatch is on (owner decision Q4), where
 * confirming also validates it and a note says CDRRMO always goes too; and a
 * report every agency it went to sent back as out of scope, whose list
 * already leaves those agencies out.
 *
 * The commit button is the confirmation, as in ConfirmModal: it stays
 * disabled until something is chosen, and it counts what will be sent. The
 * first agency chosen leads, marked beside its name as it is ticked, so the
 * order that decides is_primary is on screen rather than implied.
 */
export function AgencyPickerModal({
  title,
  description,
  options,
  recommended = [],
  hint,
  note,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  options: RoutingOption[];
  // Agencies marked Recommended: the category's mapping. Never ticked for
  // the official.
  recommended?: string[];
  // The line under the list; the returned case's wording by default.
  hint?: string;
  // One more line under the list, before the hint: CDRRMO dispatch's
  // [CDRRMO is always included].
  note?: string;
  // The commit button's words for {agencies} chosen; [Route to …] by default.
  confirmLabel?: (agencies: string) => string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (agencyIds: string[]) => void;
}) {
  const t = useT();
  // In the order ticked: the first is the lead.
  const [chosen, setChosen] = useState<string[]>([]);
  useDismissOnEscape(onCancel, !busy);
  // No autoFocus: focus lands on the dialog, so its title and the names of
  // the agencies that returned the report are announced before any choice.
  const dialogRef = useFocusTrap<HTMLDivElement>();

  function toggle(agencyId: string) {
    setChosen((list) => (list.includes(agencyId) ? list.filter((id) => id !== agencyId) : [...list, agencyId]));
  }

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
        aria-labelledby="agency-picker-title"
        aria-describedby={note ? "agency-picker-description agency-picker-note" : "agency-picker-description"}
        className="relative w-full max-w-sm rounded-card border border-ink-100 bg-white p-5 shadow-panel focus:outline-none"
      >
        <p id="agency-picker-title" className="mb-1 text-sm font-semibold text-ink-900">
          {title}
        </p>
        <p id="agency-picker-description" className="mb-3 text-xs text-ink-500">
          {description}
        </p>

        <fieldset className="mb-2" disabled={busy}>
          <legend className="mb-1.5 text-xs font-medium text-ink-500">{t("reroute.legend")}</legend>
          {/* Scrolls rather than growing past a 1366×768 desk screen. */}
          <div className="max-h-[45vh] space-y-1.5 overflow-y-auto">
            {options.map((option) => {
              const position = chosen.indexOf(option.agencyId);
              return (
                <label
                  key={option.agencyId}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs transition-colors",
                    position >= 0
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-ink-100 text-ink-700 hover:bg-ink-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={position >= 0}
                    onChange={() => toggle(option.agencyId)}
                    className="h-4 w-4 shrink-0 accent-brand-500"
                  />
                  <span className="min-w-0 flex-1">{option.agencyName}</span>
                  {recommended.includes(option.agencyId) && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                      {t("choose.recommendedTag")}
                    </span>
                  )}
                  {position === 0 && <span className="shrink-0 text-ink-500">{t("routing.lead")}</span>}
                </label>
              );
            })}
          </div>
        </fieldset>
        {note && (
          <p id="agency-picker-note" className="mb-1 text-[11px] text-ink-500">
            {note}
          </p>
        )}
        <p className="mb-4 text-[11px] text-ink-500">{hint ?? t("reroute.leadHint")}</p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" disabled={busy} onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" disabled={busy || chosen.length === 0} onClick={() => onConfirm(chosen)}>
            {busy
              ? t("common.working")
              : chosen.length === 0
                ? t("reroute.chooseFirst")
                : confirmLabel
                  ? confirmLabel(agencyCount(chosen.length, t))
                  : t("routing.routeConfirm", { agencies: agencyCount(chosen.length, t) })}
          </Button>
        </div>
      </div>
    </div>
  );
}
