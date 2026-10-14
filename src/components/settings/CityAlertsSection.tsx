"use client";

import { usePreferences } from "@/lib/preferences";
import { playChime } from "@/lib/chime";
import { useT } from "@/lib/i18n";
import type { CityRole } from "@/lib/auth";
import { Toggle } from "./NotificationsSection";

/**
 * The city dashboard's sound alerts, saved on this device (CityAlerts plays
 * them on every city page). Two switches: a new emergency anywhere in the
 * city, and a report newly scored Critical.
 */
export function CityAlertsSection({ role }: { role: CityRole }) {
  const { prefs, update, hydrated } = usePreferences(role);
  const t = useT();
  return (
    <div className="rounded-card border border-ink-100 bg-white p-5 shadow-panel">
      <p className="mb-1 text-sm font-semibold text-ink-900">{t("city.alerts.title")}</p>
      <p className="mb-4 text-xs text-ink-500">{t("city.alerts.body")}</p>

      <div className="flex items-center justify-between gap-4 border-b border-ink-100 py-3">
        <div>
          <p className="text-sm text-ink-900">{t("city.alerts.emergency")}</p>
          <p className="text-xs text-ink-500">{t("city.alerts.emergencyBody")}</p>
          <button
            type="button"
            onClick={playChime}
            className="mt-1 inline-flex min-h-11 items-center text-xs font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            {t("notifications.testSound")}
          </button>
        </div>
        <Toggle
          label={t("city.alerts.emergency")}
          checked={prefs.cityAlertNewEmergency}
          disabled={!hydrated}
          onChange={(cityAlertNewEmergency) => update({ cityAlertNewEmergency })}
        />
      </div>

      <div className="flex items-center justify-between gap-4 py-3">
        <div>
          <p className="text-sm text-ink-900">{t("city.alerts.critical")}</p>
          <p className="text-xs text-ink-500">{t("city.alerts.criticalBody")}</p>
        </div>
        <Toggle
          label={t("city.alerts.critical")}
          checked={prefs.cityAlertCritical}
          disabled={!hydrated}
          onChange={(cityAlertCritical) => update({ cityAlertCritical })}
        />
      </div>
    </div>
  );
}
