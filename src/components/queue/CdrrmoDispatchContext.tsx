"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { QueueReport, RoutingOption } from "@/types";

interface CdrrmoDispatchState {
  /** The backend's cdrrmo_dispatch_enabled switch, as this page knows it. */
  active: boolean;
  /**
   * Corrects the page's copy of the switch from a write's answer: a
   * cdrrmo_dispatch_active refusal proves it is on, a cdrrmo_dispatch_disabled
   * one that it is off. The next page load reads it again.
   */
  setActive: (active: boolean) => void;
  /** CDRRMO's agency, for the Validate confirmation; null if unknown. */
  cdrrmoAgency: RoutingOption | null;
}

// Outside a provider the switch is OFF: every surface behaves as before.
const CdrrmoDispatchContext = createContext<CdrrmoDispatchState>({
  active: false,
  setActive: () => {},
  cdrrmoAgency: null,
});

/**
 * The CDRRMO dispatch switch for the queue page. `initial` is the server's
 * one read of cdrrmo_dispatch_enabled() for this page load
 * (src/lib/cdrrmo-dispatch.ts), false on any doubt. A refresh brings a new
 * read, which wins over a correction made from a write's answer.
 */
export function CdrrmoDispatchProvider({
  initial,
  cdrrmoAgency,
  children,
}: {
  initial: boolean;
  cdrrmoAgency: RoutingOption | null;
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(initial);
  useEffect(() => setActive(initial), [initial]);
  const value = useMemo(() => ({ active, setActive, cdrrmoAgency }), [active, cdrrmoAgency]);
  return <CdrrmoDispatchContext.Provider value={value}>{children}</CdrrmoDispatchContext.Provider>;
}

export function useCdrrmoDispatch(): CdrrmoDispatchState {
  return useContext(CdrrmoDispatchContext);
}

/**
 * Whether this report is validated through CDRRMO dispatch here: the switch
 * is on and it is an Emergency report. Other-reports keep the desk's own
 * agency choice whatever the switch says.
 */
export function usesDispatch(active: boolean, report: QueueReport): boolean {
  return active && report.details.entryTier === "emergency";
}
