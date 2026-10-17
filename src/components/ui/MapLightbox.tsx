"use client";

import { Button } from "./Button";
import { Icon } from "./Icon";
import { useDismissOnEscape } from "./useDismissOnEscape";
import { useFocusTrap } from "./useFocusTrap";
import { useT } from "@/lib/i18n";

/**
 * A map at full size, over whatever opened it. The small maps in the report
 * pop-up and the Cluster Explorer are too small to read a street from on a
 * phone; this shows the same map, same points, same privacy rule, filling
 * the screen until closed. It mounts a second Leaflet instance rather than
 * moving the first, because Leaflet sizes a map to the container it was
 * created in.
 *
 * Sits above the report pop-up (z-50), so it stacks like the reject prompt
 * does: the pop-up must disable its own Escape and focus trap while this is
 * open (see ReportDetailPanel's `stacked`).
 */
export function MapLightbox({
  title,
  caption,
  onClose,
  children,
}: {
  title: string;
  caption?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  useDismissOnEscape(onClose);
  const dialogRef = useFocusTrap<HTMLDivElement>();

  return (
    <div className="fixed inset-0 z-[60] flex bg-ink-900/60 p-2 sm:p-6 motion-safe:animate-scrimIn">
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="map-lightbox-title"
        className="relative flex h-full w-full flex-col overflow-hidden rounded-card border border-ink-100 bg-white shadow-panel focus:outline-none motion-safe:animate-dialogIn"
      >
        <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-2">
          <p id="map-lightbox-title" className="truncate text-sm font-semibold text-ink-900">
            {title}
          </p>
          <Button variant="ghost" size="sm" className="min-w-11" onClick={onClose} aria-label={t("map.collapse")}>
            <Icon name="shrink" />
          </Button>
        </div>
        {/* isolate: Leaflet's panes sit at z-index 400 and up; kept inside
            this box so they never reach the header above. */}
        <div className="relative isolate min-h-0 flex-1">{children}</div>
        {caption && <p className="border-t border-ink-100 px-4 py-2 text-xs text-ink-500">{caption}</p>}
      </div>
    </div>
  );
}
