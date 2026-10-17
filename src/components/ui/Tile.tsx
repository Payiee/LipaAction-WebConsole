"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Layout effect in the browser, so the count starts before the first paint;
// a plain effect on the server, where a layout effect only warns.
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

// How long a tile's number takes to count up when the page opens.
const COUNT_UP_MS = 600;

/**
 * A number that counts up from zero once, when its tile first appears, and
 * after that simply shows each new value: on the live queue a figure that
 * re-animates on every update would draw the eye for no reason. Skipped for
 * a viewer who asks for reduced motion, and for anything that isn't a whole
 * number (a dash, a duration like [1h 42m]).
 */
function useCountUp(value: string | number): string | number {
  const [shown, setShown] = useState(value);
  const counted = useRef(false);

  useBrowserLayoutEffect(() => {
    if (counted.current) {
      setShown(value);
      return;
    }
    counted.current = true;
    const target = typeof value === "number" ? value : NaN;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!Number.isInteger(target) || target <= 0 || reduce) {
      setShown(value);
      return;
    }
    let frame = 0;
    let finished = false;
    const start = performance.now();
    const step = (time: number) => {
      const progress = Math.min(1, (time - start) / COUNT_UP_MS);
      // Ease out: quick at first, settling on the real number.
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
      else finished = true;
    };
    setShown(0);
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      // Stopped before it reached the number (React's development mode runs
      // every effect twice, or the value changed mid-count): count again.
      if (!finished) counted.current = false;
    };
  }, [value]);

  return shown;
}

export function Tile({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string | number;
  accent?: "default" | "brand" | "critical";
}) {
  const shown = useCountUp(value);
  const accentText =
    accent === "brand"
      ? "text-brand-600"
      : accent === "critical"
      ? "text-priority-critical"
      : "text-ink-900";

  return (
    <div className="flex min-w-[140px] flex-col gap-1 rounded-card border border-ink-100 bg-white px-5 py-3.5 shadow-panel">
      <span className="text-xs font-medium uppercase tracking-wide text-ink-500">
        {label}
      </span>
      {/* The count-up is for the eye; a screen reader is given the real
          value at once. */}
      <span className={`text-2xl font-semibold tabular-nums ${accentText}`} aria-hidden="true">
        {shown}
      </span>
      <span className="sr-only">{value}</span>
    </div>
  );
}
