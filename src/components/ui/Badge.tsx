import { cx } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import type { PriorityTier, ReportPriority } from "@/types";

const priorityStyles: Record<PriorityTier, string> = {
  Critical: "bg-priority-criticalBg text-priority-critical",
  High: "bg-priority-highBg text-priority-high",
  Medium: "bg-priority-mediumBg text-priority-medium",
  Low: "bg-priority-lowBg text-priority-low",
};

/**
 * An unscored report gets a neutral outline badge with no dot: visibly a
 * different kind of thing from the four tiers, so it can't be read as the
 * lowest of them. Every loader used to default a missing priority_name to
 * Low, which put a Low badge on emergencies the inference service simply
 * hadn't reached yet.
 */
/**
 * `score`, when given, is shown beside the tier. The frozen model scores
 * nearly every emergency Critical (351 of 378 input combinations), so on a
 * real queue every badge is the same red and the tier alone ranks nothing —
 * the order lives in priority_score. Showing it is what lets an official, or
 * a panel, see why one Critical report sits above another.
 */
export function PriorityBadge({
  priority,
  score = null,
}: {
  priority: ReportPriority;
  score?: number | null;
}) {
  const t = useT();
  if (priority === null) {
    return (
      <span className="inline-flex items-center rounded-full border border-ink-300 px-2.5 py-0.5 text-xs font-medium text-ink-500">
        {t("priority.unscored")}
      </span>
    );
  }
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        priorityStyles[priority]
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {priority}
      {score !== null && (
        <>
          <span className="sr-only">, priority score</span>
          <span aria-hidden className="opacity-60">
            ·
          </span>
          <span className="font-mono font-medium tabular-nums">{formatScore(score)}</span>
        </>
      )}
    </span>
  );
}

// One decimal: scores cluster between roughly 83 and 99.9, so whole numbers
// would tie reports the queue has actually ordered. Truncated, not rounded —
// rounding would show 99.95 as 100.0, a score the model doesn't produce and
// one that reads as certainty. The epsilon absorbs float error (99.9 * 10 can
// land a hair under 999).
function formatScore(score: number): string {
  return (Math.floor(score * 10 + 1e-9) / 10).toFixed(1);
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "success" | "warning" | "danger";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-100 text-ink-700",
    brand: "bg-brand-100 text-brand-700",
    success: "bg-brand-100 text-brand-700",
    warning: "bg-priority-highBg text-priority-high",
    danger: "bg-priority-criticalBg text-priority-critical",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

// The coloured bar down a card's left edge, matching its priority badge.
// Never the only sign of priority: the badge beside the category says it in
// words. Literal class names, so Tailwind keeps them.
const PRIORITY_BAR: Record<PriorityTier, string> = {
  Critical: "border-l-priority-critical",
  High: "border-l-priority-high",
  Medium: "border-l-priority-medium",
  Low: "border-l-priority-low",
};

export function priorityBar(priority: ReportPriority): string {
  return priority ? PRIORITY_BAR[priority] : "border-l-ink-300";
}
