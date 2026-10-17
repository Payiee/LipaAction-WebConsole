"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CircleMarker, Map as LeafletMap, Popup } from "leaflet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MapLightbox } from "@/components/ui/MapLightbox";
import { useT, type Translate } from "@/lib/i18n";
import type { ClusterExplorerEntry, ClusterMemberDetail } from "@/types";

// Dot colour by tier, from the priority tokens; an unscored report is neutral.
const DOT_CLASS: Record<string, string> = {
  Critical: "fill-priority-critical stroke-priority-critical",
  High: "fill-priority-high stroke-priority-high",
  Medium: "fill-priority-medium stroke-priority-medium",
  Low: "fill-priority-low stroke-priority-low",
};
const UNSCORED_DOT = "fill-ink-500 stroke-ink-500";

// Two dots closer than this on screen read as one spot. A tap there can't
// tell them apart, so the map asks which report was meant instead of
// picking the top one silently.
const NEARBY_PX = 20;

type PositionedMember = ClusterMemberDetail & { position: { kind: "point"; lat: number; lng: number } };

/**
 * Each member's real position — the same geom the queue drawer plots,
 * loaded under the same privacy rule (see loadPositions): never for an
 * identity-withheld or discreet report, and a member with no usable
 * position just isn't a dot, counted apart below the map instead of guessed
 * at. There is still no real centroid or radius to draw, so the map fits
 * itself to whichever points it has rather than claiming a shape for the
 * cluster.
 *
 * A dot is a control: tapping it selects that member, and the member list
 * beside the map highlights it and shows its details. The selection flows
 * the other way too, so a row picked in the list lights its dot.
 *
 * No access-log entry of its own: a dot's label carries only the report id,
 * category and priority — nothing the resident wrote — the same reasoning
 * the city map uses for why its dots need none either. The reporter's own
 * words stay behind the queue drawer, which does log its opening.
 */
export function MapPanel({
  cluster,
  selectedId,
  onSelect,
}: {
  cluster: ClusterExplorerEntry;
  selectedId: string | null;
  onSelect: (reportId: string) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const points = useMemo(
    () => cluster.members.filter((m): m is PositionedMember => m.position.kind === "point"),
    [cluster.members]
  );
  const hiddenCount = cluster.members.filter((m) => m.position.kind === "hidden").length;
  const missingCount = cluster.members.filter(
    (m) => m.position.kind === "none" || m.position.kind === "unavailable"
  ).length;
  const shownLine = t("cluster.map.shown", { shown: points.length, total: cluster.members.length });

  return (
    <div className="flex w-full shrink-0 flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-panel lg:w-72">
      <div className="flex items-start justify-between gap-2 border-b border-ink-100 py-2.5 pl-3 pr-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t("cluster.map.title")}</p>
          <p className="text-xs text-ink-500">{shownLine}</p>
        </div>
        {points.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="min-w-11 shrink-0"
            onClick={() => setExpanded(true)}
            aria-label={t("map.expand")}
          >
            <Icon name="expand" />
          </Button>
        )}
      </div>

      <div className="relative min-h-[220px] flex-1 bg-ink-50">
        {points.length > 0 ? (
          <PointsMap points={points} selectedId={selectedId} onSelect={onSelect} />
        ) : (
          <NoPoints />
        )}
      </div>

      {/* The same points and selection at full size; a dot picked here still
          lights its row in the list behind. */}
      {expanded && points.length > 0 && (
        <MapLightbox title={t("cluster.map.title")} caption={shownLine} onClose={() => setExpanded(false)}>
          <PointsMap points={points} selectedId={selectedId} onSelect={onSelect} />
        </MapLightbox>
      )}

      <div className="border-t border-ink-100 px-3 py-2.5 text-xs text-ink-500">
        <p>{t("cluster.map.area", { name: cluster.centroidLabel })}</p>
        {points.length > 0 && <p className="mt-1">{t("cluster.map.tapHint")}</p>}
        {hiddenCount > 0 && <p className="mt-1">{t("cluster.map.hiddenNote", { count: hiddenCount })}</p>}
        {missingCount > 0 && <p className="mt-1">{t("cluster.map.missingNote", { count: missingCount })}</p>}
      </div>
    </div>
  );
}

function NoPoints() {
  const t = useT();
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <p className="text-xs text-ink-500">{t("cluster.map.noneUsable")}</p>
    </div>
  );
}

/**
 * Leaflet, loaded only in the browser: it touches window when it loads, so a
 * static import would fail the server render. Fits itself to whichever
 * points this cluster has, the same way the city map does.
 */
function PointsMap({
  points,
  selectedId,
  onSelect,
}: {
  points: PositionedMember[];
  selectedId: string | null;
  onSelect: (reportId: string) => void;
}) {
  const t = useT();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, CircleMarker>());
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  // The latest callback, read from inside Leaflet's handlers so the map isn't
  // rebuilt every time the parent re-renders.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let map: LeafletMap | null = null;
    let popup: Popup | null = null;
    let cancelled = false;
    const markerMap = markers.current;
    setState("loading");

    import("leaflet")
      .then((mod) => {
        // Leaflet is a CommonJS module, so the bundler hands it over as a
        // default export; the fallback covers a build that doesn't.
        const L = (mod as unknown as { default?: typeof mod }).default ?? mod;
        if (cancelled || !container.current) return;
        map = L.map(container.current, {
          center: [points[0].position.lat, points[0].position.lng],
          zoom: 16,
          // A wheel over the map would zoom it instead of scrolling the page.
          scrollWheelZoom: false,
        });
        mapRef.current = map;
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);

        // Members whose dots sit within NEARBY_PX of this one on screen, the
        // tapped member first. Measured at the current zoom: zoomed out, more
        // dots overlap; zoomed in, they come apart and the picker goes away.
        const nearby = (m: PositionedMember): PositionedMember[] => {
          if (!map) return [m];
          const here = map.latLngToContainerPoint([m.position.lat, m.position.lng]);
          return points.filter(
            (p) => p === m || map!.latLngToContainerPoint([p.position.lat, p.position.lng]).distanceTo(here) <= NEARBY_PX
          );
        };

        const choose = (id: string) => {
          popup?.remove();
          popup = null;
          onSelectRef.current(id);
        };

        for (const m of points) {
          const pick = () => {
            const group = nearby(m);
            if (group.length === 1) {
              choose(m.reportId);
              return;
            }
            // Several reports at one spot: a short list to pick from,
            // built as elements for the same reason as the tooltip.
            popup?.remove();
            popup = L.popup({ closeButton: true, autoPan: true, maxWidth: 260 })
              .setLatLng([m.position.lat, m.position.lng])
              .setContent(pickList(group, t, choose))
              .openOn(map!);
          };
          const marker = L.circleMarker([m.position.lat, m.position.lng], {
            radius: 8,
            weight: 2,
            fillOpacity: 0.7,
            // Full class names, so Tailwind finds them here; a CSS fill
            // outranks the colour Leaflet writes as an attribute.
            className: (m.priority && DOT_CLASS[m.priority]) || UNSCORED_DOT,
          })
            // An element, not an HTML string: Leaflet would parse a string
            // as markup, and this label carries a database value.
            .bindTooltip(dotLabel(m, t))
            .on("click", pick)
            .addTo(map);
          // After addTo, so the SVG path exists (an "add" listener attached
          // here would miss the event, which addTo has already fired). The
          // dot is a control: a name for screen readers, a place in the Tab
          // order, and Enter or Space doing what a click does.
          const path = marker.getElement();
          if (path) {
            path.setAttribute("role", "button");
            path.setAttribute("tabindex", "0");
            path.setAttribute("aria-label", dotLabel(m, t).textContent ?? m.reportId);
            path.addEventListener("keydown", (event) => {
              // getElement() is typed as a plain Element, so the listener
              // sees a plain Event; it is a KeyboardEvent for keydown.
              const key = (event as KeyboardEvent).key;
              if (key === "Enter" || key === " ") {
                event.preventDefault();
                pick();
              }
            });
          }
          markerMap.set(m.reportId, marker);
        }

        if (points.length > 1) {
          map.fitBounds(
            points.map((m) => [m.position.lat, m.position.lng] as [number, number]),
            { padding: [24, 24], maxZoom: 18 }
          );
        }
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
      popup?.remove();
      markerMap.clear();
      mapRef.current = null;
      map?.remove();
    };
    // points is memoized on cluster.members (see the parent), so this only
    // re-runs when the selected cluster actually changes.
  }, [points, t]);

  // Selection styling, separate from the build so picking a member doesn't
  // redraw the map. The chosen dot grows and gains a heavier ring; the rest
  // keep their tier colour.
  useEffect(() => {
    if (state !== "ready") return;
    for (const [id, marker] of markers.current) {
      const selected = id === selectedId;
      marker.setStyle({ radius: selected ? 11 : 8, weight: selected ? 4 : 2, fillOpacity: selected ? 0.9 : 0.7 });
      if (selected) marker.bringToFront();
      marker.getElement()?.setAttribute("aria-pressed", String(selected));
    }
  }, [selectedId, state]);

  return (
    // isolate: Leaflet stacks its panes at z-index 400 and up, which would
    // otherwise draw them over the account menu and any dialog on the page.
    <div className="relative isolate h-full overflow-hidden">
      <div ref={container} role="region" aria-label={t("cluster.map.aria")} className="h-full w-full" />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 px-4 text-center">
          <p role="status" className="text-xs text-ink-700">
            {t(state === "failed" ? "cluster.map.failed" : "cluster.map.loading")}
          </p>
        </div>
      )}
    </div>
  );
}

// [018e5736… · Fire · Critical 97.2 · Primary]
function dotLabel(m: ClusterMemberDetail, t: Translate): HTMLElement {
  const box = document.createElement("div");
  box.textContent = [
    m.reportId,
    m.category,
    priorityText(m, t),
    m.relationship === "Primary" ? t("cluster.member.primary") : t("cluster.member.related"),
  ].join(" · ");
  return box;
}

// The picker for dots that share a spot: one 44 px button per report.
function pickList(group: ClusterMemberDetail[], t: Translate, choose: (id: string) => void): HTMLElement {
  const box = document.createElement("div");
  box.className = "flex flex-col gap-1";
  const heading = document.createElement("p");
  heading.className = "mb-1 text-xs font-semibold text-ink-700";
  heading.textContent = t("cluster.map.nearby", { count: group.length });
  box.appendChild(heading);
  for (const m of group) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "flex min-h-11 w-full items-center rounded-md border border-ink-100 px-3 text-left text-xs text-ink-900 hover:bg-ink-50";
    button.textContent = dotLabel(m, t).textContent;
    button.addEventListener("click", () => choose(m.reportId));
    box.appendChild(button);
  }
  return box;
}

function priorityText(m: ClusterMemberDetail, t: Translate): string {
  if (m.priority === null) return t("priority.unscored");
  return m.priority;
}
