// What the console writes to the access trail when data leaves it as a file
// or a print. Plain values, so both the Server Action and the buttons that
// call it can import them.

/** The backend's audit action for an export, written through log_audit. */
export const DATA_EXPORTED = "data_exported";

/**
 * The exports that are recorded: every one that names people, and every one
 * of the trail itself. An export of counts alone (the Reports page, the city
 * overview and response times) carries no personal data and writes nothing.
 *
 * Each name is what the record's metadata says was exported. The backend
 * takes any text up to 64 characters there; the action accepts only these,
 * so the trail's vocabulary is the console's own.
 */
export const EXPORT_KINDS = [
  "validation_history_csv",
  "validation_history_print",
  "audit_log_csv",
  "access_log_csv",
  "access_log_print",
  "verification_activity_csv",
  "verification_activity_print",
  // The city's report list: no names, but every report in the city one row
  // at a time, which is more than a count, so it is recorded like the rest.
  "city_reports_csv",
] as const;

export type ExportKind = (typeof EXPORT_KINDS)[number];

export function isExportKind(value: unknown): value is ExportKind {
  return typeof value === "string" && (EXPORT_KINDS as readonly string[]).includes(value);
}

// No export of this console comes near it: the largest page loads 500 rows.
export const MAX_EXPORT_ROWS = 100_000;

/**
 * How recording an export ended. Anything but `recorded` means the export
 * does not happen: a file or a print of names that the trail doesn't know
 * about is exactly what the record exists to prevent.
 */
export type ExportRecordOutcome = "recorded" | "invalid" | "refused" | "session-expired" | "unreachable" | "failed";
