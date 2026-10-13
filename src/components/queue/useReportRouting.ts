"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { rerouteReport, routeReport, routeReportToAgencies, type RouteResult } from "@/app/actions/reports";
import { callAction } from "@/lib/callAction";
import { useT } from "@/lib/i18n";
import { agencyCount } from "./routing";
import { useCdrrmoDispatch } from "./CdrrmoDispatchContext";

/**
 * The route-to-agency flow, shared by the queue row and the detail drawer,
 * for the same reason useReportReview is shared: two entry points must not
 * drift on the confirmation step or on how a partial run is reported.
 *
 * No local [routed] mark is kept. routeReport revalidates /queue, so the
 * report comes back with its new status and agency rows in the same
 * response — the server's answer is the only one shown.
 *
 * isConfirming opens whichever step the report's routing state calls for:
 * the plain confirmation for an emergency's first or unfinished routing, the
 * agency picker for an Other-report (routeTo) and for a report every agency
 * sent back (reroute).
 */
export function useReportRouting(reportId: string) {
  const { showToast } = useToast();
  const t = useT();
  const [isPending, startTransition] = useTransition();
  const [isConfirming, setIsConfirming] = useState(false);
  const dispatch = useCdrrmoDispatch();

  function run(action: () => Promise<RouteResult>) {
    startTransition(async () => {
      const result = await callAction(action);
      setIsConfirming(false);
      if (result === null) {
        // Routing is irreversible: never guess which way it went. The queue's
        // live update shows whether the agencies have it.
        showToast(t("common.noAnswer"), "danger");
        return;
      }
      if (result.success) {
        const count = result.agencyCount ?? 0;
        showToast(t("routing.routedToast", { id: reportId, agencies: agencyCount(count, t) }), "success");
      } else if (result.reason === "cdrrmo-dispatch-active") {
        // CDRRMO dispatch is on: an Emergency report is validated here and
        // routed by the database. The page's copy of the switch turns on,
        // which swaps the report's routing buttons for that flow.
        dispatch.setActive(true);
        showToast(t("cdrrmo.useValidate"), "danger");
      } else {
        // A lost lead race has wording in both languages; other refusals are
        // the action's English text.
        const message = result.reason === "lead-taken" ? t("routing.leadTaken") : result.message;
        showToast(message ?? t("routing.failed"), "danger");
      }
    });
  }

  return {
    isPending,
    isConfirming,
    openConfirm: () => setIsConfirming(true),
    cancelConfirm: () => setIsConfirming(false),
    route: () => run(() => routeReport(reportId)),
    reroute: (agencyIds: string[]) => run(() => rerouteReport(reportId, agencyIds)),
    routeTo: (agencyIds: string[]) => run(() => routeReportToAgencies(reportId, agencyIds)),
  };
}
