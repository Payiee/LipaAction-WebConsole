"use client";

import { useT } from "@/lib/i18n";
// Type-only import from a server-only module — erased at compile time.
import type { CityAgenciesData, CityAgency } from "@/lib/data/cityAgencies";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * The agencies registry, read-only: each agency and the report categories
 * routing sends to it, lead categories marked.
 */
export function AgencyList({ data }: { data: CityAgenciesData }) {
  const t = useT();

  return (
    <section aria-labelledby="city-agencies-title" className="mb-6">
      <div className="mb-3">
        <h2 id="city-agencies-title" className="text-sm font-semibold text-ink-900">
          {t("city.agencies.title")}
        </h2>
        <p className="text-xs text-ink-500">{t("city.agencies.intro")}</p>
      </div>

      {data.agencies.length === 0 ? (
        !data.loadFailed && (
          <EmptyState icon="agencies">
            <p className="text-sm text-ink-500">{t("city.agencies.empty")}</p>
          </EmptyState>
        )
      ) : (
        <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel">
          <table className="w-full min-w-[640px] text-left text-sm">
            <caption className="sr-only">{t("city.agencies.caption")}</caption>
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.agencies.col.agency")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.agencies.col.code")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.agencies.col.tier")}</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.agencies.col.categories")}</th>
              </tr>
            </thead>
            <tbody>
              {data.agencies.map((a) => (
                <tr key={a.id} className="border-b border-ink-100 align-top last:border-0">
                  <th scope="row" className="px-4 py-2.5 text-xs font-medium text-ink-900">
                    {a.name ?? t("city.unnamedAgency")}
                  </th>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-700">{a.code ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-700">{a.tier ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-700">
                    <Categories agency={a} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-ink-500">{t("city.agencies.footer")}</p>
    </section>
  );
}

function Categories({ agency }: { agency: CityAgency }) {
  const t = useT();
  if (agency.categories === null) return <span className="text-ink-500">{t("city.agencies.mappingUnavailable")}</span>;
  if (agency.categories.length === 0) return <span className="text-ink-500">{t("city.agencies.none")}</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {agency.categories.map((c) => (
        <li
          key={c.category}
          className={
            c.isPrimary
              ? "rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-700"
              : "rounded-full bg-ink-100 px-2 py-0.5 text-ink-700"
          }
        >
          {c.category}
          {/* Said in words too, so the lead isn't shown by colour alone. */}
          {c.isPrimary && ` · ${t("city.agencies.lead")}`}
        </li>
      ))}
    </ul>
  );
}
