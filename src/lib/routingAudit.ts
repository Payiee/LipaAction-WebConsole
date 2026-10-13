/**
 * Who a routing pass sent a report to, for the report_routed_manual audit
 * row. Pure, so it can be proven without a database.
 *
 * The plan a routing action carries is not always that answer. [Finish
 * routing] on an emergency uses the category mapping as its plan, and after
 * a re-route that stopped part-way the mapped agencies are the ones that
 * sent the report back, while the agency the desk chose instead holds it.
 * An Other-report's finish carries every agency that holds a row, including
 * ones that returned it. So the answer is built from the rows themselves:
 * the rows this pass inserted, plus every existing row a later routing has
 * not superseded.
 */

/** One agency_routing row as the routing actions read it. */
export interface HeldRow {
  agency_id: string;
  is_primary: boolean;
  routed_at: string | null;
  resolved_at: string | null;
  resolution_outcome: string | null;
}

export interface RoutedTo {
  agencyIds: string[];
  leadAgencyId: string | null;
}

function time(iso: string | null): number {
  return iso ? Date.parse(iso) : Number.NaN;
}

/**
 * existing: the rows read before the insert. inserted: the agencies this
 * pass inserted (or found already inserted by a concurrent writer), each
 * mapped to whether it leads; they were routed now, after every existing row.
 *
 * An existing row closed out of scope or recalled is superseded once the
 * report was routed to some agency after that closure: by a row inserted in
 * this pass, or by an existing row with a later routed_at. The same rule as
 * splitRouting in src/components/queue/routing.ts. A row without usable
 * timestamps is never superseded. Any other closure stays: the agency was
 * sent the report in the routing being recorded.
 *
 * The lead is the inserted primary if there is one, else the newest current
 * existing row with is_primary (after a re-route the old and the new lead
 * both carry is_primary, and only the newer one leads), else null.
 */
export function routedTo(existing: HeldRow[], inserted: Map<string, boolean>): RoutedTo {
  const current = existing.filter((r) => {
    if (inserted.has(r.agency_id.toLowerCase())) return false;
    if (r.resolution_outcome !== "out-of-scope" && r.resolution_outcome !== "recalled") return true;
    const closed = time(r.resolved_at);
    if (Number.isNaN(closed)) return true;
    if (inserted.size > 0) return false;
    return !existing.some((other) => time(other.routed_at) > closed);
  });

  const insertedLead = [...inserted].find(([, isPrimary]) => isPrimary)?.[0] ?? null;
  const existingLead =
    current
      .filter((r) => r.is_primary)
      .sort((a, b) => (time(b.routed_at) || 0) - (time(a.routed_at) || 0))[0]?.agency_id ?? null;

  return {
    agencyIds: [...inserted.keys(), ...current.map((r) => r.agency_id)],
    leadAgencyId: insertedLead ?? existingLead,
  };
}
