"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Icon } from "./Icon";

/**
 * Which rows a category choice keeps. An empty choice means every category,
 * so a fresh page shows everything and the filter only ever narrows.
 */
export function matchesCategories(category: string | null | undefined, chosen: readonly string[]): boolean {
  return chosen.length === 0 || (category != null && chosen.includes(category));
}

/**
 * A filter by several categories at once, asked for by the agencies
 * (2026-10-14) so an export can hold only the categories an office wants.
 * A button opens a short list of checkboxes; nothing ticked means all.
 *
 * The list is placed with fixed positioning under the button: the filter
 * rows it sits in scroll sideways on a phone, and an absolutely placed list
 * inside them would be cut off. It closes on Escape (focus back on the
 * button), on a click outside, and on any scroll, which would otherwise
 * leave it floating away from its button.
 */
export function CategoryMultiSelect({
  options,
  chosen,
  onChange,
}: {
  // The categories present in the loaded rows, in display order.
  options: string[];
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Only categories still offered count: a refresh can drop one.
  const active = chosen.filter((c) => options.includes(c));
  const label =
    active.length === 0
      ? t("history.allCategories")
      : active.length === 1
        ? active[0]
        : t("categories.count", { count: active.length });

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = 288; // w-72
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setPlace({ top: rect.bottom + 4, left });
  }, [open]);

  // Once the list is placed and rendered, the first checkbox takes focus.
  useEffect(() => {
    if (open && place) panelRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    function close(returnFocus: boolean) {
      setOpen(false);
      if (returnFocus) buttonRef.current?.focus();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close(true);
    }
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close(false);
    }
    function onScroll(e: Event) {
      if (panelRef.current?.contains(e.target as Node)) return;
      close(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  function toggle(category: string) {
    onChange(active.includes(category) ? active.filter((c) => c !== category) : [...active, category]);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${t("history.filterCategory")}: ${label}`}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
          active.length > 0
            ? "border-brand-500 bg-brand-100 text-brand-700"
            : "border-ink-100 bg-white text-ink-700 hover:bg-ink-50"
        )}
      >
        <span className="max-w-[14rem] truncate">{label}</span>
        <Icon name="chevron-down" className="h-4 w-4" />
      </button>

      {open && place && (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={t("history.filterCategory")}
          style={{ top: place.top, left: place.left }}
          className="fixed z-50 max-h-80 w-72 overflow-y-auto rounded-card border border-ink-100 bg-white py-1 shadow-panel print:hidden"
        >
          {options.map((category) => (
            <label
              key={category}
              className="flex min-h-11 cursor-pointer items-center gap-3 px-3.5 text-sm text-ink-900 hover:bg-ink-50"
            >
              <input
                type="checkbox"
                checked={active.includes(category)}
                onChange={() => toggle(category)}
                className="h-4 w-4 shrink-0 accent-brand-500"
              />
              <span className="min-w-0 flex-1">{category}</span>
            </label>
          ))}
          <div className="border-t border-ink-100 px-3.5 py-1">
            <button
              type="button"
              disabled={active.length === 0}
              onClick={() => onChange([])}
              className="inline-flex min-h-11 items-center text-xs font-medium text-brand-700 underline-offset-2 hover:underline disabled:text-ink-500 disabled:no-underline"
            >
              {t("categories.clear")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
