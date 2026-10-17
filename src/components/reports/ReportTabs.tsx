"use client";

import { useRef } from "react";
import { cx } from "@/lib/utils";
import { useT, type MessageKey } from "@/lib/i18n";

export type ReportView = "daily" | "weekly" | "monthly";

const VIEWS: { id: ReportView; label: MessageKey; hint: MessageKey }[] = [
  { id: "daily", label: "reports.tab.daily", hint: "reports.tab.dailyHint" },
  { id: "weekly", label: "reports.tab.weekly", hint: "reports.tab.weeklyHint" },
  { id: "monthly", label: "reports.tab.monthly", hint: "reports.tab.monthlyHint" },
];

export function reportTabId(id: ReportView): string {
  return `report-tab-${id}`;
}

export const REPORT_PANEL_ID = "report-panel";

/**
 * Daily, Weekly, Monthly: one report at a time instead of all three down the
 * page, in large buttons with a line under each saying what it holds
 * (reviewer feedback, October 2026). The WAI-ARIA tabs pattern, like the
 * queue's tabs: only the chosen tab is in the Tab order, and the arrow keys,
 * Home and End move between them.
 */
export function ReportTabs({ view, onChange }: { view: ReportView; onChange: (view: ReportView) => void }) {
  const t = useT();
  const refs = useRef<Partial<Record<ReportView, HTMLButtonElement | null>>>({});

  function moveTo(index: number) {
    const next = VIEWS[(index + VIEWS.length) % VIEWS.length];
    onChange(next.id);
    refs.current[next.id]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const target =
      event.key === "ArrowRight"
        ? index + 1
        : event.key === "ArrowLeft"
          ? index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? VIEWS.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    moveTo(target);
  }

  return (
    <div role="tablist" aria-label={t("reports.tabsLabel")} className="mb-6 grid gap-3 sm:grid-cols-3 print:hidden">
      {VIEWS.map((v, index) => {
        const active = v.id === view;
        return (
          <button
            key={v.id}
            ref={(el) => {
              refs.current[v.id] = el;
            }}
            id={reportTabId(v.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={REPORT_PANEL_ID}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(v.id)}
            onKeyDown={(e) => onKeyDown(e, index)}
            className={cx(
              "flex min-h-20 flex-col items-start justify-center gap-1 rounded-card border-2 px-5 py-3 text-left transition-colors",
              active
                ? "border-brand-500 bg-brand-50 text-brand-800"
                : "border-ink-100 bg-white text-ink-900 hover:border-ink-300"
            )}
          >
            <span className="text-lg font-semibold">{t(v.label)}</span>
            <span className={cx("text-sm", active ? "text-brand-700" : "text-ink-500")}>{t(v.hint)}</span>
          </button>
        );
      })}
    </div>
  );
}
