import type { MessageKey } from "@/lib/i18n";
import type { ResolutionStatus } from "@/types";

// The priority filter's value for a report the model hasn't scored. Never a
// tier: an unscored report isn't Low.
export const NOT_SCORED = "not-scored";

// The resolution outcomes, in the order a report moves through them.
export const RESOLUTION_ORDER: ResolutionStatus[] = [
  "notRouted",
  "resolvedAtBarangay",
  "withAgencies",
  "resolved",
  "confirmedFalse",
  "duplicate",
  "returned",
  "rejectedByCdrrmo",
  "overriddenByCdrrmo",
];

export const RESOLUTION_LABELS: Record<ResolutionStatus, MessageKey> = {
  notRouted: "history.resolution.notRouted",
  resolvedAtBarangay: "history.resolution.resolvedAtBarangay",
  withAgencies: "history.resolution.withAgencies",
  resolved: "history.resolution.resolved",
  confirmedFalse: "history.resolution.confirmedFalse",
  duplicate: "history.resolution.duplicate",
  returned: "history.resolution.returned",
  rejectedByCdrrmo: "history.resolution.rejectedByCdrrmo",
  overriddenByCdrrmo: "history.resolution.overriddenByCdrrmo",
};
