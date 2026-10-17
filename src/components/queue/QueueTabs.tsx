"use client";

import { useRef } from "react";
import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { QueueTabId } from "@/types";

export function queueTabDomId(id: QueueTabId): string {
  return `queue-tab-${id}`;
}

export function queuePanelDomId(id: QueueTabId): string {
  return `queue-panel-${id}`;
}

/**
 * WAI-ARIA tabs pattern. The active tab was previously conveyed by colour
 * and an underline only — nothing a screen reader could report, and the
 * thesis's own design rule is that state is never conveyed by colour alone.
 *
 * Roving tabindex: only the active tab is in the Tab order; Left/Right/Home/
 * End move between tabs and select on move, which is the automatic-activation
 * variant — appropriate here because switching tabs is cheap and has no side
 * effects.
 */
export function QueueTabs({
  tabs,
  activeTab,
  onChange,
  trailing,
}: {
  tabs: { id: QueueTabId; label: string; count: number }[];
  activeTab: QueueTabId;
  onChange: (id: QueueTabId) => void;
  // Right-aligned control on the same row (the sort select). Kept outside
  // the tablist so the tabs stay its only children.
  trailing?: React.ReactNode;
}) {
  const buttonRefs = useRef<Partial<Record<QueueTabId, HTMLButtonElement | null>>>({});
  const t = useT();

  function moveTo(index: number) {
    const next = tabs[(index + tabs.length) % tabs.length];
    onChange(next.id);
    buttonRefs.current[next.id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        moveTo(index + 1);
        break;
      case "ArrowLeft":
        event.preventDefault();
        moveTo(index - 1);
        break;
      case "Home":
        event.preventDefault();
        moveTo(0);
        break;
      case "End":
        event.preventDefault();
        moveTo(tabs.length - 1);
        break;
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-2 border-b border-ink-100 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3">
      <div
        role="tablist"
        aria-label={t("queue.tabsLabel")}
        className="flex flex-nowrap items-center gap-1 overflow-x-auto sm:flex-wrap sm:overflow-visible"
      >
      {tabs.map((tab, index) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              buttonRefs.current[tab.id] = el;
            }}
            type="button"
            role="tab"
            id={queueTabDomId(tab.id)}
            aria-selected={active}
            aria-controls={queuePanelDomId(tab.id)}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cx(
              "relative flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap px-3 text-sm font-medium transition-colors",
              active ? "text-brand-700" : "text-ink-500 hover:text-ink-900"
            )}
          >
            {/* Named by id, not by the server's English label, so the tab
                follows the chosen language. */}
            {t(`queue.tab.${tab.id}`)}
            <span
              className={cx(
                "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                active ? "bg-brand-100 text-brand-700" : "bg-ink-100 text-ink-700"
              )}
            >
              {tab.count}
            </span>
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-500"
              />
            )}
          </button>
        );
      })}
      </div>
      {trailing}
    </div>
  );
}
