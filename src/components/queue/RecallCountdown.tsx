"use client";

import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { countdown } from "@/lib/recall";

/**
 * Time left in a recall window, m:ss, the figure in a <time> element.
 * Advisory: the browser's clock (RECALL-UI spec section 5, Q6); the server
 * decides. Under a minute the words change as well as the colour, so state is
 * never colour alone. Not a live region: the surface that shows it announces
 * only the one-minute mark and the close (spec section 11).
 */
export function RecallCountdown({ endsAt, now, className }: { endsAt: number; now: number; className?: string }) {
  const t = useT();
  const { msLeft, text, underMinute } = countdown(endsAt, now);
  const seconds = Math.max(0, Math.ceil(msLeft / 1000));
  // The message without vars keeps its {time} placeholder; the figure goes
  // where it stands, whatever the language's word order.
  const [before, after = ""] = t(underMinute ? "recall.timeLeftUnderMinute" : "recall.timeLeft").split("{time}");
  return (
    <span
      className={cx(
        "text-xs font-semibold tabular-nums",
        underMinute ? "text-priority-critical" : "text-priority-medium",
        className
      )}
    >
      {before}
      <time dateTime={`PT${seconds}S`}>{text}</time>
      {after}
    </span>
  );
}
