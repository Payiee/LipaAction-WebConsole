"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { usePreferences } from "@/lib/preferences";
import { playChime } from "@/lib/chime";
import { useT } from "@/lib/i18n";
import type { BarangayRole } from "@/lib/auth";

// How long the browser's permission question may go unanswered before the
// page says where it went. Long enough that an ordinary popup has been
// answered or is plainly on screen.
const QUIET_PROMPT_HINT_MS = 3000;

export function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-[68px] shrink-0 items-center justify-center rounded-full disabled:opacity-60"
    >
      {/* The button is the target, 44px tall and wider than the track, so
          the switch keeps its 44 by 24 look while the thing you press is a
          full-size target (NFR-03). The track is this span. */}
      <span
        aria-hidden
        className={`relative block h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-brand-500" : "bg-ink-300"
        }`}
      >
        {/* left-0 is load-bearing. An absolutely positioned child with no
            horizontal offset sits at its static position; anchored at the
            left, the two translations give an even 2px inset: 44px track
            minus 20px knob minus 2px = 22px. */}
        <span
          className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

/**
 * Alert preferences, saved on this device. Both are real: the Queue page
 * reads them (src/app/queue/QueueClient.tsx) and acts on them while it is
 * open. Neither reaches a closed tab — there is no push channel here, and
 * the copy says so rather than implying the mobile-style push the thesis
 * describes.
 */
export function NotificationsSection({ role }: { role: BarangayRole }) {
  const { prefs, update, hydrated } = usePreferences(role);
  const { showToast } = useToast();
  const t = useT();
  // Set while the browser's permission question is unanswered, so a second
  // click can't send a second question over the first.
  const [asking, setAsking] = useState(false);
  // Set once that question has gone QUIET_PROMPT_HINT_MS without an answer.
  const [quietPrompt, setQuietPrompt] = useState(false);

  // Turning the browser notification on is what asks for permission. Doing
  // it here, on the click, is the only place a browser will honour the
  // request; asking on page load is ignored or blocked. If the browser says
  // no, the toggle stays off — a switch that reads [on] while nothing can
  // ever fire is the kind of control this console has spent weeks removing.
  async function handleBrowserNotificationToggle(next: boolean) {
    if (!next) {
      update({ slaBreachBrowserNotification: false });
      return;
    }
    if (typeof Notification === "undefined") {
      showToast(t("notifications.unsupported"), "danger");
      return;
    }
    let permission: NotificationPermission = Notification.permission;
    if (permission !== "granted") {
      // Edge asks quietly by default, as Chrome does for sites it judges
      // unwanted: a bell icon in the address bar, no popup, and the question
      // stays unanswered until the official finds the bell. Tested in Edge on
      // 2026-09-22, the page showed nothing meanwhile, so the switch looked
      // broken. After a few seconds without an answer, say where it went.
      setAsking(true);
      const hint = window.setTimeout(() => setQuietPrompt(true), QUIET_PROMPT_HINT_MS);
      try {
        permission = await Notification.requestPermission();
      } finally {
        window.clearTimeout(hint);
        setQuietPrompt(false);
        setAsking(false);
      }
    }
    if (permission === "denied") {
      showToast(t("notifications.blocked"), "danger");
      return;
    }
    if (permission !== "granted") {
      // Dismissed, not refused: the browser will ask again next time, so
      // [blocked in your browser settings] would send the official looking
      // for a setting that was never changed.
      showToast(t("notifications.notAllowed"), "info");
      return;
    }
    update({ slaBreachBrowserNotification: true });
  }

  return (
    <div className="rounded-card border border-ink-100 bg-white p-5 shadow-panel">
      <p className="mb-1 text-sm font-semibold text-ink-900">{t("settings.nav.notifications")}</p>
      <p className="mb-4 text-xs text-ink-500">{t("notifications.body")}</p>

      <div className="flex items-center justify-between gap-4 border-b border-ink-100 py-3">
        <div>
          <p className="text-sm text-ink-900">{t("notifications.audible")}</p>
          <p className="text-xs text-ink-500">{t("notifications.audibleBody")}</p>
          {/* Plays the real chime. The click is itself the gesture browsers
              require, so this also proves the speakers and the sound path
              work without waiting for a report to arrive. */}
          <button
            type="button"
            onClick={playChime}
            className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            {t("notifications.testSound")}
          </button>
        </div>
        <Toggle
          label={t("notifications.audible")}
          checked={prefs.audibleAlertNewEmergency}
          disabled={!hydrated}
          onChange={(audibleAlertNewEmergency) => update({ audibleAlertNewEmergency })}
        />
      </div>

      <div className="flex items-center justify-between gap-4 py-3">
        <div>
          <p className="text-sm text-ink-900">{t("notifications.sla")}</p>
          <p className="text-xs text-ink-500">{t("notifications.slaBody")}</p>
          {/* Always rendered, empty until needed: a live region added to the
              page together with its text is often not announced. */}
          <p role="status" className={quietPrompt ? "mt-1 text-xs font-medium text-ink-700" : undefined}>
            {quietPrompt ? t("notifications.quietPrompt") : null}
          </p>
        </div>
        <Toggle
          label={t("notifications.sla")}
          checked={prefs.slaBreachBrowserNotification}
          disabled={!hydrated || asking}
          onChange={handleBrowserNotificationToggle}
        />
      </div>
    </div>
  );
}
