"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap } from "leaflet";
import { PriorityBadge } from "@/components/ui/Badge";
import { FilterBar, FilterGroup } from "@/components/ui/FilterGroup";
import { Tile } from "@/components/ui/Tile";
import { buttonClassName } from "@/components/ui/Button";
import { statusLabel } from "@/components/queue/useReportReview";
import { useT, type Translate } from "@/lib/i18n";
// Type-only imports from a server-only module — erased at compile time.
import type { CityMapData, MapBarangayCount, MapPoint } from "@/lib/data/cityMap";

// Lipa City's centre, for a map with nothing on it yet.
const LIPA_CENTER: [number, number] = [13.9411, 121.1631];

// Dot colours, from the priority tokens. Leaflet draws each dot as an SVG
// path and puts these classes on it; a CSS fill outranks the colour Leaflet
// writes as an attribute. Full class names, so Tailwind finds them here.
const DOT_CLASS: Record<string, string> = {
  Critical: "fill-priority-critical stroke-priority-critical",
  High: "fill-priority-high stroke-priority-high",
  Medium: "fill-priority-medium stroke-priority-medium",
  Low: "fill-priority-low stroke-priority-low",
};
const UNSCORED_DOT = "fill-ink-500 stroke-ink-500";
const LEGEND_DOT: Record<string, string> = {
  Critical: "bg-priority-critical",
  High: "bg-priority-high",
  Medium: "bg-priority-medium",
  Low: "bg-priority-low",
};

// The priority filter's value for a report the model hasn't scored.
const UNSCORED = "unscored";

// Where a dot or a row leads: the report's drawer in the city report list,
// which records the opening in the access log like any other.
const reportHref = (id: string) => `/city/reports?open=${id}`;

/**
 * The city map: open reports from the last week as dots on OpenStreetMap,
 * with counts per barangay beside it and the same reports as a table below.
 *
 * Read-only. A dot's label names the category, the priority, the stage, the
 * barangay and the time, nothing the resident wrote, so the map itself needs
 * no access-log entry; clicking a dot, or Details in the table, opens the
 * report in the city report list, whose drawer records the opening. A report
 * whose resident withheld their identity, or asked for discreet reporting,
 * never reaches this component with a position; it exists here only as a
 * number in the barangay counts and the priority counts.
 *
 * The table is the map's text equivalent: the dots can't be reached by
 * keyboard or read by a screen reader, so everything they show is listed.
 */
export function CityMap({ data }: { data: CityMapData }) {
  const t = useT();
  const { points, barangays, totals, loadFailed } = data;
  // The thesis's map filters (A.5.2), over the dots already loaded. The
  // barangay and priority counts keep describing every open report.
  const [priority, setPriority] = useState("all");
  const [category, setCategory] = useState("all");
  const categoryOptions = useMemo(() => [...new Set(points.map((p) => p.category))].sort(), [points]);
  const shown = useMemo(
    () =>
      points.filter(
        (p) =>
          (priority === "all" || (p.priority ?? UNSCORED) === priority) &&
          (category === "all" || p.category === category)
      ),
    [points, priority, category]
  );
  const byPriority = data.byPriority ?? { Critical: 0, High: 0, Medium: 0, Low: 0, unscored: 0 };

  return (
    <section aria-labelledby="city-map-title" className="mb-6">
      <div className="mb-3">
        <h2 id="city-map-title" className="text-sm font-semibold text-ink-900">
          {t("city.map.title")}
        </h2>
        <p className="text-xs text-ink-500">{t("city.map.intro", { days: data.windowDays })}</p>
      </div>

      {!loadFailed && (
        <div className="mb-6 flex flex-wrap gap-4">
          <Tile label="Critical" value={byPriority.Critical} accent="critical" />
          <Tile label="High" value={byPriority.High} />
          <Tile label="Medium" value={byPriority.Medium} />
          <Tile label="Low" value={byPriority.Low} />
          <Tile label={t("priority.unscored")} value={byPriority.unscored} />
        </div>
      )}

      {points.length > 0 && (
        <FilterBar>
        <FilterGroup label={t("filters.refine")} className="flex-1">
          <select
            aria-label={t("history.filterPriority")}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="min-h-11 rounded-full border border-ink-100 bg-white px-4 text-sm font-medium text-ink-700"
          >
            <option value="all">{t("history.allPriorities")}</option>
            {["Critical", "High", "Medium", "Low"].map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
            <option value={UNSCORED}>{t("priority.unscored")}</option>
          </select>
          {categoryOptions.length > 1 && (
            <select
              aria-label={t("history.filterCategory")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-11 rounded-full border border-ink-100 bg-white px-4 text-sm font-medium text-ink-700"
            >
              <option value="all">{t("history.allCategories")}</option>
              {categoryOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {shown.length !== points.length && (
            <p role="status" className="text-xs text-ink-500">
              {t("city.map.filteredNote", { shown: shown.length, total: points.length })}
            </p>
          )}
        </FilterGroup>
        </FilterBar>
      )}

      {!loadFailed && totals.open === 0 && (
        <div className="mb-4 rounded-card border border-ink-100 bg-white px-4 py-6 text-center shadow-panel">
          <p className="text-sm text-ink-500">{t("city.map.empty", { days: data.windowDays })}</p>
        </div>
      )}
      {!loadFailed && totals.open > 0 && totals.mapped === 0 && (
        <p role="note" className="mb-3 text-xs text-ink-700">
          {t("city.map.noneMapped")}
        </p>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <MapCanvas points={shown} />
        </div>
        <aside className="flex flex-col gap-4">
          <Legend />
          <BarangayCounts barangays={barangays} totals={totals} />
        </aside>
      </div>

      {shown.length > 0 && <PointList points={shown} />}

      <p className="mt-3 text-xs text-ink-500">
        {t("city.map.footer", { time: formatTime(data.asOf) })}
        {data.capped && ` ${t("city.map.capped", { limit: data.limit })}`}
      </p>
    </section>
  );
}

/**
 * Leaflet, loaded only in the browser and only on this page: it touches
 * window when it loads, so a static import would fail the server render.
 */
function MapCanvas({ points }: { points: MapPoint[] }) {
  const t = useT();
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    setState("loading");

    import("leaflet")
      .then((mod) => {
        // Leaflet is a CommonJS module, so the bundler hands it over as a
        // default export; the fallback covers a build that doesn't.
        const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
        if (cancelled || !container.current) return;
        map = L.map(container.current, {
          center: LIPA_CENTER,
          zoom: 13,
          // A wheel over the map would zoom it instead of scrolling the page.
          scrollWheelZoom: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        for (const p of points) {
          L.circleMarker([p.lat, p.lng], {
            radius: 8,
            weight: 2,
            fillOpacity: 0.7,
            className: (p.priority && DOT_CLASS[p.priority]) || UNSCORED_DOT,
          })
            // An element, not an HTML string: Leaflet would parse a string as
            // markup, and these labels carry database values.
            .bindTooltip(dotLabel(p, t))
            .on("click", () => router.push(reportHref(p.id)))
            .addTo(map);
        }

        if (points.length > 0) {
          map.fitBounds(
            points.map((p) => [p.lat, p.lng] as [number, number]),
            { padding: [32, 32], maxZoom: 16 }
          );
        }
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [points, t, router]);

  return (
    // isolate: Leaflet stacks its panes at z-index 400 and up, which would
    // otherwise draw them over the account menu and any dialog opened above
    // the page. Isolated, they stack only against each other.
    <div className="relative isolate overflow-hidden rounded-card border border-ink-100 bg-white shadow-panel">
      <div
        ref={container}
        role="region"
        aria-label={t("city.map.label")}
        className="h-[420px] w-full"
      />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 px-6 text-center">
          <p role="status" className="text-sm text-ink-700">
            {t(state === "failed" ? "city.map.failed" : "city.map.loading")}
          </p>
        </div>
      )}
    </div>
  );
}

// [Fire · Critical 97.2 · Routed to agency] / [Inosluban · Oct 1, 2026, 20:44]
function dotLabel(p: MapPoint, t: Translate): HTMLElement {
  const box = document.createElement("div");
  const first = document.createElement("div");
  first.style.fontWeight = "600";
  first.textContent = [p.category, priorityText(p, t), statusLabel(p.status, t)].join(" · ");
  const second = document.createElement("div");
  second.textContent = `${p.barangayName ?? t("city.unnamedBarangay")} · ${formatTimestamp(p.submittedAt)}`;
  const third = document.createElement("div");
  third.style.fontStyle = "italic";
  third.textContent = t("city.map.openHint");
  box.append(first, second, third);
  return box;
}

function priorityText(p: MapPoint, t: Translate): string {
  if (p.priority === null) return t("priority.unscored");
  return p.priorityScore === null ? p.priority : `${p.priority} ${Math.trunc(p.priorityScore * 10) / 10}`;
}

function Legend() {
  const t = useT();
  return (
    <div className="rounded-card border border-ink-100 bg-white px-4 py-3 shadow-panel">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{t("city.map.legend")}</h3>
      <ul className="flex flex-col gap-1.5 text-xs text-ink-700">
        {["Critical", "High", "Medium", "Low"].map((tier) => (
          <li key={tier} className="flex items-center gap-2">
            <span aria-hidden className={`h-3 w-3 rounded-full ${LEGEND_DOT[tier]}`} />
            {tier}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="h-3 w-3 rounded-full bg-ink-500" />
          {t("priority.unscored")}
        </li>
      </ul>
    </div>
  );
}

function BarangayCounts({ barangays, totals }: { barangays: MapBarangayCount[]; totals: CityMapData["totals"] }) {
  const t = useT();
  return (
    <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel">
      <h3 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">{t("city.map.byBarangay")}</h3>
      <table className="w-full text-left text-xs">
        <caption className="sr-only">{t("city.map.countsCaption")}</caption>
        <thead>
          <tr className="border-b border-ink-100 text-xs text-ink-500">
            <th scope="col" className="px-4 py-2 font-semibold">{t("city.col.barangay")}</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">{t("city.map.col.mapped")}</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">{t("city.map.col.withheld")}</th>
            <th scope="col" className="px-2 py-2 text-right font-semibold">{t("row.discreet")}</th>
            <th scope="col" className="px-4 py-2 text-right font-semibold">{t("city.map.col.unlocated")}</th>
          </tr>
        </thead>
        <tbody>
          {barangays.map((b) => (
            <tr key={b.barangayId ?? "none"} className="border-b border-ink-100">
              <th scope="row" className="px-4 py-2 font-medium text-ink-900">
                {b.barangayId === null ? t("city.noBarangay") : b.name ?? t("city.unnamedBarangay")}
              </th>
              <td className="px-2 py-2 text-right tabular-nums text-ink-700">{b.mapped}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-700">{b.withheld}</td>
              <td className="px-2 py-2 text-right tabular-nums text-ink-700">{b.discreet}</td>
              <td className="px-4 py-2 text-right tabular-nums text-ink-700">{b.unlocated}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" className="px-4 py-2 font-semibold text-ink-900">{t("city.map.total")}</th>
            <td className="px-2 py-2 text-right font-semibold tabular-nums text-ink-900">{totals.mapped}</td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums text-ink-900">{totals.withheld}</td>
            <td className="px-2 py-2 text-right font-semibold tabular-nums text-ink-900">{totals.discreet}</td>
            <td className="px-4 py-2 text-right font-semibold tabular-nums text-ink-900">{totals.unlocated}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function PointList({ points }: { points: MapPoint[] }) {
  const t = useT();
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold text-ink-900">{t("city.map.listTitle")}</h3>
      <div className="overflow-x-auto rounded-card border border-ink-100 bg-white shadow-panel">
        <table className="w-full min-w-[640px] text-left text-sm">
          <caption className="sr-only">{t("city.map.listCaption")}</caption>
          <thead>
            <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.reports.col.submitted")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("city.col.barangay")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("reports.col.category")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("drawer.priority")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">{t("drawer.status")}</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">
                <span className="sr-only">{t("city.reports.col.open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.id} className="border-b border-ink-100 last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-700">{formatTimestamp(p.submittedAt)}</td>
                <td className="px-4 py-2.5 text-xs text-ink-900">{p.barangayName ?? t("city.unnamedBarangay")}</td>
                <th scope="row" className="px-4 py-2.5 text-xs font-medium text-ink-900">{p.category}</th>
                <td className="px-4 py-2.5">
                  <PriorityBadge priority={p.priority} score={p.priorityScore} />
                </td>
                <td className="px-4 py-2.5 text-xs text-ink-700">{statusLabel(p.status, t)}</td>
                <td className="px-4 py-2.5 text-right">
                  {/* The keyboard's way into a report, as the dot is the
                      pointer's. Opening it is recorded on the reports page. */}
                  <Link
                    href={reportHref(p.id)}
                    prefetch={false}
                    aria-label={t("row.viewDetails", { id: p.id })}
                    className={buttonClassName("secondary", "sm")}
                  >
                    {t("city.reports.open")}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// [Oct 1, 2026, 20:44], in Manila, like the city report list.
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "Asia/Manila",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
