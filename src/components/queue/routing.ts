import type { AgencyRouting, QueueReport, RoutingOption, RoutingPlanEntry } from "@/types";
// Type-only: the helpers below take a Translate function rather than calling
// a hook, so they stay plain functions the row and the drawer can share.
import type { Translate } from "@/lib/i18n";
import { BARANGAY_RESOLVE_LIVE } from "@/lib/features";
import { canRecordBarangayValidation } from "@/lib/cdrrmo-dispatch";

/**
 * Where a report stands with respect to agencies — one reading shared by the
 * queue row and the detail drawer, so the two can never disagree about
 * whether a report still needs routing.
 */
export type RoutingState =
  // Pending or rejected: routing doesn't apply.
  | { kind: "none" }
  // Validated, mapping known, not yet sent anywhere.
  | { kind: "ready"; plan: RoutingPlanEntry[] }
  // Validated but some agencies already hold it: a previous attempt stopped
  // part-way. routeReport is idempotent, so the same action finishes it.
  | { kind: "incomplete"; routing: AgencyRouting[]; plan: RoutingPlanEntry[] | null }
  // Validated again after every agency it went to sent it back as out of
  // scope — the backend's handback returns such a report to the barangay.
  // Its category mapping is exactly who returned it, so the next agency is a
  // person's choice: options lists the agencies that don't hold it yet, and
  // is null when the agency list couldn't be loaded.
  | { kind: "returned"; routing: AgencyRouting[]; options: RoutingOption[] | null }
  // A validated Other-report no agency holds yet. The desk chooses which
  // agencies it belongs to, like tagging it, rather than confirming the
  // category mapping: an Other-report's category is broad (public order,
  // welfare…) and the right office depends on what was reported. suggested
  // holds the mapped agencies' ids, lead first, ticked in advance; it is []
  // when the category maps to none or the mapping couldn't be loaded.
  // options lists every named agency, and is null when that list couldn't
  // be loaded.
  | { kind: "choose"; options: RoutingOption[] | null; suggested: string[]; plan: RoutingPlanEntry[] | null }
  // Validated, and the category maps to no agency (e.g. other_emergency).
  | { kind: "no-mapping" }
  // Validated, but the mapping couldn't be loaded. Not the same claim as
  // no-mapping, and must not be shown as one.
  | { kind: "unavailable" }
  // Routed or resolved: agencies own it now; the desk watches.
  | { kind: "downstream"; status: "routed" | "resolved"; routing: AgencyRouting[] }
  // Routed, then rejected by CDRRMO (CDRRMO dispatch's reject after routing,
  // backend spec 3.4). Only CDRRMO dispatch closes a row 'rejected', so a
  // rejected report with such a row is exactly this case. Final: the
  // barangay can't overturn it.
  | { kind: "rejectedByCdrrmo"; routing: AgencyRouting[] };

export function routingState(report: QueueReport): RoutingState {
  const { status, routing, routingPlan, routingOptions } = report.details;

  if (status === "validated") {
    if (routing.length > 0) {
      // Before [incomplete]: [Finish routing] on a returned report would send
      // it back to the agencies that just returned it, and mark it routed
      // with nobody holding it.
      if (everyAgencyReturned(routing)) {
        return { kind: "returned", routing, options: routingOptions ?? null };
      }
      return { kind: "incomplete", routing, plan: routingPlan };
    }
    if (report.details.entryTier === "other_reports") {
      return {
        kind: "choose",
        options: routingOptions ?? null,
        suggested: suggestedAgencies(routingPlan),
        plan: routingPlan,
      };
    }
    if (routingPlan === null) return { kind: "unavailable" };
    if (routingPlan.length === 0) return { kind: "no-mapping" };
    return { kind: "ready", plan: routingPlan };
  }

  if (status === "routed" || status === "resolved") {
    return { kind: "downstream", status, routing };
  }

  if (isRejectedByCdrrmo(status, routing)) return { kind: "rejectedByCdrrmo", routing };

  return { kind: "none" };
}

/**
 * A report CDRRMO rejected after it was routed: rejected, with a routing row
 * closed 'rejected'. Data-driven, so it needs no switch check: no such row
 * exists unless CDRRMO dispatch wrote it.
 */
export function isRejectedByCdrrmo(status: string, routing: AgencyRouting[]): boolean {
  return status === "rejected" && routing.some((r) => r.resolutionOutcome === "rejected");
}

/**
 * Whether the desk may close this report itself instead of routing it: a
 * validated Other-report that no agency has held. Emergencies always go to
 * an agency, and a report with agency rows keeps its routing actions.
 * resolveAtBarangay on the server checks the same things again.
 */
export function canResolveAtBarangay(report: QueueReport, state: RoutingState): boolean {
  return (
    BARANGAY_RESOLVE_LIVE &&
    report.details.entryTier === "other_reports" &&
    (state.kind === "ready" || state.kind === "no-mapping" || state.kind === "choose")
  );
}

// The mapped agencies, lead first, then in mapping order: the order the
// picker ticks them, and so the order that decides which one leads.
function suggestedAgencies(plan: RoutingPlanEntry[] | null): string[] {
  if (!plan) return [];
  const ids = [...plan.filter((p) => p.isPrimary), ...plan.filter((p) => !p.isPrimary)].map((p) => p.agencyId);
  return [...new Set(ids)];
}

/**
 * True when every agency the report went to closed it as out of scope. The
 * same rule decides the [returned] state here and is checked again by
 * routeReport and rerouteReport on the server, which must agree with it.
 * 'recalled' is not counted: a re-validated recalled report is [Routing
 * incomplete], and [Finish routing] sends it back to its mapped agencies
 * through the backend's reopen trigger (20261031090000_recall_window,
 * item 7). See the server copy in src/app/actions/reports.ts.
 */
export function everyAgencyReturned(rows: AgencyRouting[]): boolean {
  return rows.length > 0 && rows.every((r) => Boolean(r.resolvedAt) && r.resolutionOutcome === "out-of-scope");
}

/**
 * Splits a report's agency rows into the latest routing and what came
 * before it. An out-of-scope or recalled closure is history once the report
 * was routed to some agency after it: the desk chose another agency, and
 * [Returned by X] (or the recalled auto-route, with its auto_routed flag) is
 * no longer what the report is waiting on. Any other closure stays current,
 * so a fix is never hidden. A row without usable timestamps is never moved
 * to history.
 */
export function splitRouting(rows: AgencyRouting[]): { current: AgencyRouting[]; earlier: AgencyRouting[] } {
  const current: AgencyRouting[] = [];
  const earlier: AgencyRouting[] = [];
  for (const r of rows) {
    const closed = time(r.resolvedAt);
    // NaN compares false either way, so an undated row stays current.
    const superseded =
      (r.resolutionOutcome === "out-of-scope" || r.resolutionOutcome === "recalled") &&
      rows.some((other) => time(other.routedAt) > closed);
    (superseded ? earlier : current).push(r);
  }
  // Can't happen with consistent timestamps (the latest routing is never
  // superseded), but an empty current list would read as [not routed].
  return current.length > 0 ? { current, earlier } : { current: rows, earlier: [] };
}

function time(iso: string | null): number {
  return iso ? Date.parse(iso) : Number.NaN;
}

// resolution_outcome is a closed list on the backend, one message key per
// value (routing.outcome.*). [resolved] needs no qualifier; the others are
// closures without a fix, and say so.
function outcomeLabel(outcome: NonNullable<AgencyRouting["resolutionOutcome"]>, t: Translate): string {
  return t(`routing.outcome.${outcome}`);
}

/**
 * One agency's progress. There is no status column on agency_routing; the
 * stage is whichever timestamp the agency has set last.
 */
export function agencyProgressLabel(row: AgencyRouting, t: Translate): string {
  if (row.resolvedAt) {
    return row.resolutionOutcome && row.resolutionOutcome !== "resolved"
      ? t("routing.progress.closed", { outcome: outcomeLabel(row.resolutionOutcome, t) })
      : t("status.resolved");
  }
  // In progress outranks acknowledged: the agency sets it after
  // acknowledging, and an agency may set it without acknowledging first.
  if (row.inProgressAt) return t("routing.progress.inProgress");
  if (row.acknowledgedAt) return t("routing.progress.acknowledged");
  return t("routing.progress.awaiting");
}

/** [ +2] after the lead agency's name, or nothing for a single agency. */
function moreThan(rows: AgencyRouting[]): string {
  return rows.length > 1 ? ` +${rows.length - 1}` : "";
}

/**
 * The one-line version for a queue row. Leads with the primary agency (the
 * loader sorts it first) and counts the rest, because a row has room for one
 * name and the drawer lists them all.
 */
export function downstreamSummary(
  state: Extract<RoutingState, { kind: "downstream" }>,
  t: Translate
): string {
  const { status } = state;
  // Only the latest routing: an agency that sent the report back before the
  // desk routed it elsewhere is history. The drawer still lists it.
  const routing = splitRouting(state.routing).current;
  if (routing.length === 0) {
    // Routed by a path whose rows this desk can't see, or the routing load
    // failed. The status is still true; the detail just isn't available.
    return t(status === "resolved" ? "status.resolved" : "status.routed");
  }

  const lead = routing[0];
  const more = moreThan(routing);
  const open = routing.filter((r) => !r.resolvedAt);

  // The agency that fixed it is named, whichever it was. This used to name
  // the lead agency whenever every row was closed, even when another agency
  // did the resolving.
  const fixer = routing.find((r) => r.resolvedAt && (r.resolutionOutcome ?? "resolved") === "resolved");

  if (open.length === 0) {
    if (fixer) return t("routing.summary.resolvedBy", { agency: fixer.agencyName, more });
    // Every agency closed it, none with a fix.
    if (everyAgencyReturned(routing)) {
      return t("routing.summary.returned", { agency: lead.agencyName, more });
    }
    return lead.resolutionOutcome
      ? t("routing.summary.closedBy", {
          agency: lead.agencyName,
          more,
          outcome: outcomeLabel(lead.resolutionOutcome, t),
        })
      : t("routing.summary.resolvedBy", { agency: lead.agencyName, more });
  }

  // The report's own status leads. Once it is resolved, an agency row still
  // open must not read it back down to [Acknowledged] or [awaiting].
  if (status === "resolved") {
    return fixer ? t("routing.summary.resolvedBy", { agency: fixer.agencyName, more }) : t("status.resolved");
  }

  // One agency has closed its part while others still hold the report. Say
  // both: a partial closure must never read as the whole report finished —
  // the rule since routing was built (2026-09-11), briefly lost on
  // 2026-09-22 when [Resolved by] was made to name the resolving agency.
  const stillOpen = agencyCount(open.length, t);
  if (fixer) return t("routing.summary.resolvedOpen", { agency: fixer.agencyName, agencies: stillOpen });
  // An agency sent it back as outside its remit (the paper returns
  // out-of-scope closures to the barangay, p.224).
  const returned = routing.find((r) => r.resolvedAt && r.resolutionOutcome === "out-of-scope");
  if (returned) return t("routing.summary.returnedOpen", { agency: returned.agencyName, agencies: stillOpen });

  // Only agencies still holding it count from here: a closed lead is not the
  // one to wait on. An agency at work outranks one that has only
  // acknowledged.
  const working = open.find((r) => r.inProgressAt);
  if (working) return t("routing.summary.inProgressAt", { agency: working.agencyName, more });

  const acknowledging = open.find((r) => r.acknowledgedAt);
  if (acknowledging) {
    return t("routing.summary.acknowledgedBy", { agency: acknowledging.agencyName, more });
  }

  return t("routing.summary.routedTo", { agency: open[0].agencyName, more });
}

/**
 * The [Returned by X] line for a returned report's row: the agencies of the
 * latest routing, which are the ones that just sent it back.
 */
export function returnedSummary(
  state: Extract<RoutingState, { kind: "returned" }>,
  t: Translate
): string {
  const routing = splitRouting(state.routing).current;
  const vars = { agency: routing[0].agencyName, more: moreThan(routing) };
  // With no other agency to offer, the barangay is the only place left.
  return t(state.options && state.options.length === 0 ? "routing.summary.returned" : "row.returned", vars);
}

/**
 * True when a routed report's latest routing was the backend's automatic one,
 * sent without a review at the desk. Only the latest routing counts: once the
 * desk routes a returned report elsewhere, the routing is the desk's,
 * whatever came before.
 */
export function isAutoRouted(state: RoutingState): boolean {
  return state.kind === "downstream" && splitRouting(state.routing).current.some((r) => r.autoRouted);
}

/**
 * True when every agency closed a routed report as out of scope. Before the
 * backend's handback is live, such a report stays 'routed', and only the
 * returned state (status 'validated') can be sent to another agency — so
 * for this one the console can only say it is back with the barangay.
 */
export function isReturnedToBarangay(state: RoutingState): boolean {
  return state.kind === "downstream" && everyAgencyReturned(splitRouting(state.routing).current);
}

/**
 * Copy for the routing confirmation. States the one thing an official most
 * needs before clicking: it can't be taken back from here — the desk has no
 * DELETE on agency_routing, and the status only moves forward.
 */
export function routeConfirmCopy(
  report: QueueReport,
  plan: RoutingPlanEntry[] | null,
  resuming: boolean,
  t: Translate
): { title: string; description: string; confirmLabel: string } {
  const names = plan && plan.length > 0 ? describePlan(plan, t) : null;
  const count = plan?.length ?? 0;
  const agencies = agencyCount(count, t);
  // Said at the moment the report leaves the barangay. The drawer already
  // showed the flag; the confirmation used to be the one place it didn't.
  const discreet = discreetNote(report, t);

  if (resuming) {
    return {
      title: t("routing.finishTitle", { id: report.id }),
      description: t("routing.finishDescription") + discreet,
      confirmLabel: t("routing.finish"),
    };
  }

  return {
    title: t("routing.routeTitle", { id: report.id, agencies }),
    description: t("routing.routeDescription", { names: names ?? t("routing.mappedAgencies") }) + discreet,
    confirmLabel: t("routing.routeConfirm", { agencies }),
  };
}

/**
 * Copy for the Validate confirmation of an Emergency report while CDRRMO
 * dispatch is on. Names the default set the database will send it to, read
 * only (backend spec 3.4): the category's mapped agencies, lead first, plus
 * CDRRMO, which is always included. The database decides the final list;
 * this is the desk's preview of it, and the barangay can't change it.
 */
export function dispatchValidateCopy(
  report: QueueReport,
  cdrrmo: RoutingOption | null,
  mode: "send" | "record",
  t: Translate
): { title: string; description: string; confirmLabel: string } {
  if (mode === "record") {
    // Already with its agencies: validating records the barangay's word and
    // routes nothing.
    return {
      title: t("cdrrmo.validateTitle", { id: report.id }),
      description: t("cdrrmo.recordDescription"),
      confirmLabel: t("cdrrmo.recordConfirm"),
    };
  }
  return {
    title: t("cdrrmo.validateTitle", { id: report.id }),
    description: t("cdrrmo.validateDescription", { names: dispatchDefaultSet(report.details.routingPlan, cdrrmo, t) }) + discreetNote(report, t),
    confirmLabel: t("cdrrmo.validateConfirm"),
  };
}

/**
 * What the desk can do with an Emergency report past review while CDRRMO
 * dispatch is on (backend binding items 18-20 and the spec's state table):
 * - send: validated, and no agency has ever held it (a report validated the
 *   old way before the switch went on). validate_emergency_report() routes it.
 * - record: routed without this barangay's validation (auto-routed, or
 *   routed after CDRRMO validated). Validating records it, routing nothing.
 * - partial: validated with some agency rows from before the switch. The
 *   function refuses it (already_validated); only CDRRMO can add agencies.
 * - handedBack: every agency sent it back. CDRRMO sends it on, not the desk.
 * - null: nothing to do here.
 */
export type DispatchPastReview = "send" | "record" | "partial" | "handedBack" | null;

export function dispatchPastReview(report: QueueReport, state: RoutingState): DispatchPastReview {
  switch (state.kind) {
    case "ready":
    case "no-mapping":
    case "unavailable":
      return "send";
    case "incomplete":
      return "partial";
    case "returned":
      return "handedBack";
    case "downstream":
      return canRecordBarangayValidation(report.details.status, report.details.reviewedAt, report.details.partyDecisions)
        ? "record"
        : null;
    default:
      return null;
  }
}

/**
 * The default set in words: the mapped agencies, then CDRRMO unless the
 * mapping already names it. A mapping that couldn't be loaded is described
 * rather than guessed at.
 */
export function dispatchDefaultSet(plan: RoutingPlanEntry[] | null, cdrrmo: RoutingOption | null, t: Translate): string {
  if (plan === null) return t("cdrrmo.mappedAndCdrrmo");
  const mapped = plan.length > 0 ? describePlan(plan, t) : "";
  const cdrrmoMapped = cdrrmo !== null && plan.some((p) => p.agencyId === cdrrmo.agencyId);
  if (cdrrmoMapped) return mapped;
  const always = cdrrmo ? `${cdrrmo.agencyName} ${t("cdrrmo.alwaysSuffix")}` : t("cdrrmo.cdrrmoAlways");
  return mapped ? `${mapped}, ${always}` : always;
}

/**
 * Copy for the agency picker a returned report opens. Names who sent it back,
 * so the official doesn't have to remember while choosing, and says routing
 * can't be undone, like the ordinary confirmation.
 */
export function rerouteCopy(
  report: QueueReport,
  state: Extract<RoutingState, { kind: "returned" }>,
  t: Translate
): { title: string; description: string } {
  const names = splitRouting(state.routing)
    .current.map((r) => r.agencyName)
    .join(", ");
  return {
    title: t("reroute.title", { id: report.id }),
    description: t("reroute.description", { names }) + discreetNote(report, t),
  };
}

/**
 * Copy for the agency picker a validated Other-report opens. The mapped
 * agencies are already ticked when there are any, and the description says
 * so, so an official who agrees with them only has to confirm.
 */
export function chooseCopy(
  report: QueueReport,
  state: Extract<RoutingState, { kind: "choose" }>,
  t: Translate
): { title: string; description: string; hint: string } {
  return {
    title: t("choose.title", { id: report.id }),
    description:
      t(state.suggested.length > 0 ? "choose.descriptionSuggested" : "choose.description") + discreetNote(report, t),
    hint: t("choose.leadHint"),
  };
}

function discreetNote(report: QueueReport, t: Translate): string {
  return report.details.discreetReporting ? ` ${t("routing.discreetNote")}` : "";
}

/** [1 agency] / [3 agencies] — shared with the routed toast. */
export function agencyCount(count: number, t: Translate): string {
  return count === 1 ? t("routing.agencyCountOne") : t("routing.agencyCount", { count });
}

function describePlan(plan: RoutingPlanEntry[], t: Translate): string {
  return plan
    .map((p) => (p.isPrimary ? `${p.agencyName} ${t("routing.lead")}` : p.agencyName))
    .join(", ");
}
