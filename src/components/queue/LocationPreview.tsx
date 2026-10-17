"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { MapLightbox } from "@/components/ui/MapLightbox";
import { useT, type MessageKey } from "@/lib/i18n";
import { cx } from "@/lib/utils";
import type { ReportPosition } from "@/types";

const NO_MAP: Record<Exclude<ReportPosition["kind"], "point">, MessageKey> = {
  none: "drawer.location.none",
  hidden: "drawer.location.hidden",
  unavailable: "drawer.location.unavailable",
};

/**
 * The drawer's map preview (A.3.2): where the reporter's phone was when they
 * filed. Shown only inside the drawer, whose opening is recorded in the
 * access log. An identity-withheld or discreet report never reaches this
 * component with a position (see loadPositions in queue.ts); for those, and
 * for a report without one, it says why there is no map.
 *
 * Expand opens the same point at full size (MapLightbox). The parent is told
 * so it can yield Escape and Tab to the lightbox while it is up, the way it
 * does for the reject prompt.
 */
export function LocationPreview({
  position,
  onExpandedChange,
}: {
  position: ReportPosition | undefined;
  onExpandedChange?: (expanded: boolean) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const shown = position ?? { kind: "unavailable" as const };

  function setOpen(open: boolean) {
    setExpanded(open);
    onExpandedChange?.(open);
  }

  if (shown.kind !== "point") return <p className="text-xs text-ink-500">{t(NO_MAP[shown.kind])}</p>;
  const caption = t("drawer.location.caption", { lat: shown.lat.toFixed(5), lng: shown.lng.toFixed(5) });
  return (
    <div>
      <div className="relative">
        <PointMap lat={shown.lat} lng={shown.lng} className="h-44 rounded-md border border-ink-100" />
        {/* Above Leaflet's panes (z-index 400 and up inside the isolated map
            box), below any dialog. */}
        <Button
          variant="secondary"
          size="sm"
          className="absolute right-2 top-2 z-10 min-w-11 shadow-panel"
          onClick={() => setOpen(true)}
          aria-label={t("map.expand")}
        >
          <Icon name="expand" />
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-ink-500">{caption}</p>
      {expanded && (
        <MapLightbox title={t("drawer.location.label")} caption={caption} onClose={() => setOpen(false)}>
          <PointMap lat={shown.lat} lng={shown.lng} className="h-full" />
        </MapLightbox>
      )}
    </div>
  );
}

/**
 * Leaflet, loaded only in the browser and only when a drawer with a position
 * opens: it touches window when it loads, so a static import would fail the
 * server render. Sized by the caller: the preview is a fixed strip, the
 * expanded view fills its box.
 */
function PointMap({ lat, lng, className }: { lat: number; lng: number; className?: string }) {
  const t = useT();
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
          center: [lat, lng],
          zoom: 17,
          // A wheel over the map would zoom it instead of scrolling the drawer.
          scrollWheelZoom: false,
        });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }).addTo(map);
        L.circleMarker([lat, lng], {
          radius: 9,
          weight: 2,
          fillOpacity: 0.7,
          // Full class names, so Tailwind finds them here; a CSS fill outranks
          // the colour Leaflet writes as an attribute.
          className: "fill-priority-critical stroke-priority-critical",
        }).addTo(map);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);

  return (
    // isolate: Leaflet stacks its panes at z-index 400 and up, which would
    // otherwise draw them over the reject prompt and any other dialog opened
    // above the drawer.
    <div className={cx("relative isolate overflow-hidden", className)}>
      <div ref={container} role="region" aria-label={t("drawer.location.label")} className="h-full w-full" />
      {state !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80 px-4 text-center">
          <p role="status" className="text-xs text-ink-700">
            {t(state === "failed" ? "drawer.location.failed" : "city.map.loading")}
          </p>
        </div>
      )}
    </div>
  );
}
