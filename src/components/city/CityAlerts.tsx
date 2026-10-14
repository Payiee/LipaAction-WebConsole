"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePreferences } from "@/lib/preferences";
import { playChime, primeChime } from "@/lib/chime";
import type { CityRole } from "@/lib/auth";

// Reports already sounded for, kept outside the component: every city page
// renders its own shell, so this mounts again on each navigation, and a
// report must not chime a second time because the official changed page.
const chimedEmergencies = new Set<string>();
const chimedCritical = new Set<string>();

/**
 * The city dashboard's sound alert, asked for by the agencies (2026-10-14).
 * Two switches in City Settings, both on by default and saved on this
 * device like the barangay queue's alert: a new emergency anywhere in the
 * city, and a report newly scored Critical. One event never chimes twice:
 * an emergency filed and scored Critical sounds once on arrival and once
 * more when the score lands, since those are two different moments.
 *
 * incident_reports is in the Realtime publication, and postgres_changes
 * delivery is filtered by row-level security per signed-in user, so the
 * city account receives every barangay's reports, as it may read them.
 * Realtime sends the whole row; this reads only id, entry_tier and
 * priority_name, and shows nothing. Renders nothing.
 *
 * As on the queue page, browsers start audio only after a click or a key on
 * the page, so the first gesture primes the sound; an alert before any
 * gesture after a reload is silent. City Settings says so.
 */
export function CityAlerts({ role }: { role: CityRole }) {
  const { prefs, hydrated } = usePreferences(role);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const wanted = hydrated && (prefs.cityAlertNewEmergency || prefs.cityAlertCritical);

  useEffect(() => {
    const prime = () => primeChime();
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => {
      window.removeEventListener("pointerdown", prime);
      window.removeEventListener("keydown", prime);
    };
  }, []);

  useEffect(() => {
    if (!wanted) return;
    const supabase = createClient();
    let disposed = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Fetch the session token before the join is built, or the join can go
    // out as the anon role and receive nothing (see QueueClient, issue #1).
    void supabase.realtime
      .setAuth()
      .catch(() => undefined)
      .then(() => {
        if (disposed) return;
        channel = supabase
          .channel("city-alerts")
          .on("postgres_changes", { event: "*", schema: "public", table: "incident_reports" }, (payload) => {
            if (disposed) return;
            const row = payload.new as { id?: unknown; entry_tier?: unknown; priority_name?: unknown };
            if (typeof row.id !== "string") return;
            const before = payload.old as { priority_name?: unknown } | null;
            let sound = false;
            if (
              payload.eventType === "INSERT" &&
              row.entry_tier === "emergency" &&
              !chimedEmergencies.has(row.id)
            ) {
              chimedEmergencies.add(row.id);
              if (prefsRef.current.cityAlertNewEmergency) sound = true;
            }
            const nowCritical = row.priority_name === "Critical";
            const wasCritical = payload.eventType === "UPDATE" && before?.priority_name === "Critical";
            if (nowCritical && !wasCritical && !chimedCritical.has(row.id)) {
              chimedCritical.add(row.id);
              if (prefsRef.current.cityAlertCritical) sound = true;
            }
            if (sound) playChime();
          })
          .subscribe();
      });

    return () => {
      disposed = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [wanted]);

  return null;
}
