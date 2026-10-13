// Shared domain types for the Barangay Web Console mockup.
// All data consumed by these types is static/dummy — see src/data/*.

import type { RejectReasonCode } from "@/lib/utils";

export type PriorityTier = "Critical" | "High" | "Medium" | "Low";

// null = not scored yet. priority_name is written by the inference service,
// and until it runs a report has none. That is not the same as Low, and an
// emergency must never be shown as Low because nothing has ranked it.
export type ReportPriority = PriorityTier | null;

export type QueueTabId = "emergency" | "standard" | "duplicates" | "validated";

export interface KpiSummary {
  fastTriageCount: number;
  standardIntakeCount: number;
  medianMinutes: number;
  // null when the count couldn't be loaded — rendered as a dash, not as 0.
  validatedCount: number | null;
}

export interface ReporterInfo {
  name: string; // or "Identity withheld"
  identityWithheld: boolean;
  trustScore?: number;
}

/**
 * One agency_routing row as the barangay desk can see it (ar_select_barangay).
 * There is no status column on agency_routing: progress is read from which
 * timestamps are set. The desk cannot change any of these — agency roles do.
 */
export interface AgencyRouting {
  agencyName: string;
  isPrimary: boolean;
  // Sent by the backend's automatic routing rather than by a desk official.
  // A desk can only ever insert false (ar_insert_barangay requires it).
  autoRouted: boolean;
  routedAt: string | null;
  acknowledgedAt: string | null;
  // Set by the agency when it starts work (the backend's fourth agency
  // stage, on prod since the October push). In progress means this is set
  // and resolvedAt isn't.
  inProgressAt: string | null;
  resolvedAt: string | null;
  // 'recalled' is written only by the backend's recall_auto_routed_report()
  // (20261031090000_recall_window): the desk took an auto-routed report back.
  // 'rejected' is written only by CDRRMO dispatch, when CDRRMO rejects a
  // report after it was routed (backend spec 3.4): the row was closed with
  // the report, not by the agency's own choice.
  resolutionOutcome: "resolved" | "confirmed-false" | "duplicate" | "out-of-scope" | "recalled" | "rejected" | null;
}

/** An agency that routing this report would send it to (category_agency_routing). */
export interface RoutingPlanEntry {
  // The agency's id, so the picker an Other-report opens can tick the mapped
  // agencies in advance.
  agencyId: string;
  agencyName: string;
  isPrimary: boolean;
}

/**
 * An agency an official may choose: for a validated Other-report, which is
 * routed to the agencies the desk picks, and for a report every agency it
 * went to sent back as out of scope. The id is what routeReportToAgencies or
 * rerouteReport receives; the server checks it again, since the choice
 * arrives from the browser.
 */
export interface RoutingOption {
  agencyId: string;
  agencyName: string;
}

/**
 * The fuller picture of a report, shown in the detail drawer.
 *
 * Every field here is a real incident_reports column, except the two routing
 * fields, which come from agency_routing and category_agency_routing. The
 * free-text ones (severitySelfRating, anyoneHurt, safetyNetConfirmation) are
 * rendered verbatim rather than mapped to friendlier labels — their value
 * vocabulary is set by the mobile app, not by this console, so relabelling
 * them here would be guessing.
 */
export interface ReportDetails {
  entryTier: "emergency" | "other_reports";
  status: string;
  description: string | null;
  severitySelfRating: string | null;
  safetyNetConfirmation: string | null;
  anyoneHurt: string | null;
  isOngoing: boolean | null;
  hasPhoto: boolean;
  hasVideo: boolean;
  discreetReporting: boolean;
  priorityClass: number | null;
  priorityScore: number | null;
  confidenceBand: string | null;
  // The finer category an Other-report carries (e.g. under Minor
  // infrastructure), display form. null on emergencies.
  subCategory: string | null;
  clusterId: string | null;
  submittedAt: string; // exact ISO timestamp, not the relative display string
  // Agencies this report has been sent to. Empty until it is routed. On a
  // validated report it is non-empty in two cases: a routing attempt stopped
  // part-way, which the UI offers to finish, or every agency sent the report
  // back as out of scope, which the UI offers to route elsewhere.
  routing: AgencyRouting[];
  // Where routing would send it, from category_agency_routing. Carried by
  // pending reports too, for the drawer's preview before a decision. [] when
  // the category has no mapping — shown as [needs barangay review], never
  // filled with a guess; null when the mapping couldn't be loaded, and on
  // routed or resolved reports, where it no longer applies.
  routingPlan: RoutingPlanEntry[] | null;
  // The agencies that don't hold the report yet, sorted by name, for the
  // agency picker. Set on a validated report that already has agency rows
  // (the returned case) and on a validated Other-report no agency holds yet
  // (the desk chooses where it goes); null there when the agency list
  // couldn't be loaded, and null on every other report.
  routingOptions: RoutingOption[] | null;
  // Where the reporter's phone was when they filed, for the drawer's map.
  position: ReportPosition;
}

/**
 * A report's position, as the drawer may show it.
 * - point: a usable position.
 * - none: the report carries none (no fix, or an Other-report).
 * - hidden: identity-withheld or discreet; the position is never read for
 *   these, so it can't be shown by mistake.
 * - unavailable: the lookup failed.
 */
export type ReportPosition =
  | { kind: "point"; lat: number; lng: number }
  | { kind: "none" }
  | { kind: "hidden" }
  | { kind: "unavailable" };

export interface QueueReport {
  id: string; // e.g. "24-2024-2312"
  category: string; // e.g. "Vehicular accident"
  priority: ReportPriority;
  summary: string;
  location?: string; // no address text in real data — only present for mock/demo data
  timestamp: string; // display string, e.g. "2m ago"
  reporter: ReporterInfo;
  isClusterMember?: boolean;
  details: ReportDetails;
}

export interface SituationCluster {
  id: string; // e.g. "CL-083"
  // Every category among the members, display form, in member order. The
  // duplicate flagger weighs category rather than requiring it to match, so
  // one group can mix a fire, a medical emergency and an accident; a single
  // headline category taken from one member would misdescribe the rest.
  categories: string[];
  memberCount: number;
  barangaysAffected: string[];
  identityWithheldMembers: number;
  members: QueueReport[];
}

export interface ClusterMemberDetail {
  reportId: string;
  category: string;
  priority: ReportPriority;
  relationship: "Primary" | "Related";
  timestamp: string;
  submittedAt: string; // exact ISO timestamp, for ages that keep moving (timeAgo)
  reporter: ReporterInfo;
  // Where the reporter's phone was when they filed, same privacy rule as the
  // queue drawer's LocationPreview (see loadPositions): hidden for an
  // identity-withheld or discreet report, none for a report with no fix,
  // unavailable only when the lookup itself failed.
  position: ReportPosition;
  visualHash?: number; // pairwise proximity signal
  temporalDeltaSeconds?: number;
  sitio?: string;
}

export interface ClusterExplorerEntry {
  id: string;
  // Every category among the members, in member order; see SituationCluster.
  categories: string[];
  memberCount: number;
  // The highest tier any member was scored; null when no member has been
  // scored yet, shown as [Not scored] rather than defaulted to a tier.
  status: "Critical" | "High" | "Standard" | null;
  radiusMeters?: number; // no real geospatial computation exists yet — mock/demo only
  centroidLabel: string;
  members: ClusterMemberDetail[];
}

export interface ValidationRecord {
  reportId: string;
  category: string;
  // The report's real priority_name. Previously a derived "tier"
  // (Critical/Standard/Log) that the table then re-mapped onto a priority
  // badge — which displayed a Low report as "High". Priority and intake tier
  // are separate axes and are now carried, and rendered, separately.
  priority: ReportPriority;
  entryTier: "emergency" | "other_reports";
  verdict: "Confirmed" | "Rejected";
  validatingOfficial: string;
  timestamp: string; // display string, e.g. "Sep 05, 21:47"
  // Raw ISO of the same moment. `timestamp` is preformatted for display and
  // can't be compared, so date-range filtering reads this instead.
  reviewedAt: string;
  reporter: ReporterInfo;
  trustDelta?: string; // no real trust-score column — mock/demo only
  // Real data from the review_report() cutover (incident_reports.review_reason).
  // Only present on rejected rows — the RPC only fills it on rejection.
  reason?: string;
  // The category prefix parsed out of `reason` (parseRejectReason) and the
  // note after it. reasonCode is null for a reason without a known prefix —
  // older rejections, or the other dashboard's — and reasonNote is then the
  // whole text, shown as it stands.
  reasonCode?: RejectReasonCode | null;
  reasonNote?: string;
  // What the desk wrote when it resolved the report itself
  // (barangay_resolutions.note). Absent on every other report, and when the
  // notes couldn't be read.
  resolutionNote?: string;
  // What became of a confirmed report after the desk (A.3.7's resolution
  // outcome), from its agency rows. null on a rejected report, which never
  // reaches an agency, and when the agency rows couldn't be read.
  resolution: ResolutionStatus | null;
}

/**
 * Where a confirmed report ended up: not routed yet, still with an agency,
 * or closed — resolved, confirmed false or a duplicate by an agency, or sent
 * back as out of scope by every agency that had it.
 */
export type ResolutionStatus =
  | "notRouted"
  // Closed by the desk itself, with no agency (resolveAtBarangay): the
  // report carries incident_reports.barangay_resolved_at.
  | "resolvedAtBarangay"
  | "withAgencies"
  | "resolved"
  | "confirmedFalse"
  | "duplicate"
  | "returned";

export interface ValidationSummary {
  total: number;
  confirmed: number;
  rejected: number;
  identityWithheld: number;
}

/**
 * One row of the barangay's access trail, exactly as
 * `barangay_audit_log` returns it (plus the category, resolved separately).
 *
 * `action` and `actorRole` are free text on purpose: the function returns
 * the action as text and the role as text rather than the app_role enum, so
 * a value this console doesn't know renders as itself. No official is named
 * — the function excludes actor_id — so the mockup's per-row actor name and
 * its [Unique actors] tile are not buildable and are gone.
 */
export interface AuditLogEntry {
  id: string;
  action: string;
  actorRole: string;
  timestamp: string;
  // The same moment as an ISO instant, for the date filters: `timestamp` is
  // formatted for display and can't be compared.
  at: string;
  reportId: string | null;
  category: string | null;
}

export interface AuditSummary {
  totalEvents: number;
  decisions: number;
  routings: number;
  openings: number;
}

export type SettingsSectionId =
  | "profile"
  | "language"
  | "notifications"
  | "privacy"
  | "about";