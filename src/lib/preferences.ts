"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { ConsoleRole } from "@/lib/auth";

export type InterfaceLanguage = "en" | "tl";
export type BilingualEmphasis = "english-first" | "tagalog-first" | "english-only";

export interface ConsolePreferences {
  interfaceLanguage: InterfaceLanguage;
  bilingualEmphasis: BilingualEmphasis;
  audibleAlertNewEmergency: boolean;
  slaBreachBrowserNotification: boolean;
  // The city dashboard's sound alerts (CityAlerts): a new emergency anywhere
  // in the city, and a report newly scored Critical.
  cityAlertNewEmergency: boolean;
  cityAlertCritical: boolean;
}

/**
 * Console preferences live in this browser, on this device — deliberately.
 *
 * The thesis (Fig. 50, A.3.9) puts language, bilingual emphasis, an audible
 * Tier 0 alert, and an SLA-breach browser notification on the Settings page.
 * `profiles` has no column for any of them, and the two that matter are
 * per-device concerns by nature: whether this laptop chimes, and whether this
 * browser is allowed to show notifications (a permission the browser grants
 * per site, per profile — a server-side flag could not carry it). Storing
 * them here is the honest home, not a stand-in for a backend that's missing.
 *
 * Before this, both Settings sections held `useState` over a fixture and
 * forgot everything on navigation.
 */
const STORAGE_KEY = "lipaaction.console.preferences.v1";

export function defaultPreferences(role: ConsoleRole): ConsolePreferences {
  // The paper: "The interface defaults to Tagalog for this role" (A.3, senior
  // barangay admin). The only role-specific behaviour this console can
  // currently honour — everything else role-shaped needs backend tables that
  // don't exist.
  const tagalogFirst = role === "senior_barangay_admin";
  return {
    interfaceLanguage: tagalogFirst ? "tl" : "en",
    bilingualEmphasis: tagalogFirst ? "tagalog-first" : "english-first",
    audibleAlertNewEmergency: true,
    // Off until the official turns it on: switching it on is what asks the
    // browser for permission, and a default of [on] with permission never
    // granted would be a toggle that silently does nothing.
    slaBreachBrowserNotification: false,
    // On, like the queue's audible alert: a sound needs no browser permission.
    cityAlertNewEmergency: true,
    cityAlertCritical: true,
  };
}

function readStored(): Partial<ConsolePreferences> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return validStored(JSON.parse(raw));
  } catch {
    // Private window, storage disabled, or a corrupt value — behave as unset.
    return null;
  }
}

/**
 * Keeps only the stored fields that are well-formed. localStorage is written
 * by an older version of this page, by another tab, or by anyone with the
 * devtools open; spreading its parsed JSON straight over the defaults let a
 * non-boolean flag or an unknown language code reach every component that
 * reads preferences. A field that fails its check falls back to the default.
 */
function validStored(parsed: unknown): Partial<ConsolePreferences> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const raw = parsed as Record<string, unknown>;
  const out: Partial<ConsolePreferences> = {};
  if (raw.interfaceLanguage === "en" || raw.interfaceLanguage === "tl") out.interfaceLanguage = raw.interfaceLanguage;
  if (raw.bilingualEmphasis === "english-first" || raw.bilingualEmphasis === "tagalog-first" || raw.bilingualEmphasis === "english-only") {
    out.bilingualEmphasis = raw.bilingualEmphasis;
  }
  if (typeof raw.audibleAlertNewEmergency === "boolean") out.audibleAlertNewEmergency = raw.audibleAlertNewEmergency;
  if (typeof raw.slaBreachBrowserNotification === "boolean") out.slaBreachBrowserNotification = raw.slaBreachBrowserNotification;
  if (typeof raw.cityAlertNewEmergency === "boolean") out.cityAlertNewEmergency = raw.cityAlertNewEmergency;
  if (typeof raw.cityAlertCritical === "boolean") out.cityAlertCritical = raw.cityAlertCritical;
  return out;
}

function writeStored(prefs: Partial<ConsolePreferences>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Same cases as above. The in-memory value still applies for this page
    // load; it just won't survive a reload.
  }
}

// ---------------------------------------------------------------------------
// One shared store for every component that reads preferences.
//
// Each usePreferences() call used to keep its own copy in useState, so two
// components never saw each other's changes until a remount. That was
// harmless while only the Settings page wrote preferences; with a language
// toggle in the top bar, the whole console has to follow one value. The
// store holds only what the official has actually chosen — role defaults are
// merged on read, so an unset field keeps following the role. Another tab's
// change arrives through the storage event.
let stored: Partial<ConsolePreferences> | null | undefined; // undefined = not read yet
const listeners = new Set<() => void>();

function getStored(): Partial<ConsolePreferences> | null {
  if (stored === undefined) stored = readStored();
  return stored;
}

// One storage listener for the whole store, attached while anything is
// subscribed — not one per component, which re-read storage once per
// subscriber on every change from another tab.
function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  stored = readStored();
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

// The server has no localStorage: it renders with role defaults, and so does
// the hydrating client, so the two agree. The stored choice applies right
// after hydration.
const getServerStored = () => null;
const clientReady = () => true;
const serverReady = () => false;

/**
 * Preferences for the signed-in official: role defaults, overlaid with what
 * this browser has stored. `hydrated` is false during the server render and
 * the hydrating paint — controls should disable themselves until then so a
 * click can't land on a value that's about to be replaced.
 */
export function usePreferences(role: ConsoleRole) {
  const current = useSyncExternalStore(subscribe, getStored, getServerStored);
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const prefs = useMemo<ConsolePreferences>(() => ({ ...defaultPreferences(role), ...(current ?? {}) }), [role, current]);

  const update = useCallback((patch: Partial<ConsolePreferences>) => {
    stored = { ...(getStored() ?? {}), ...patch };
    writeStored(stored);
    listeners.forEach((l) => l());
  }, []);

  return { prefs, update, hydrated };
}
