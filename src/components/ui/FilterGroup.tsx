import { cx } from "@/lib/utils";

/**
 * One kind of control above a list, in a box of its own with a small label:
 * the dates together, the other filters together, export and print
 * together. Side by side in a FilterBar, the boxes keep the three kinds
 * apart, where one long row of chips read as one jumble (reviewer feedback,
 * October 2026).
 */
export function FilterGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx("flex flex-col gap-2 rounded-card border border-ink-100 bg-white p-3 shadow-panel", className)}
    >
      <span aria-hidden className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** The row the groups sit in; they wrap onto new lines on a narrow screen. */
export function FilterBar({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx("mb-5 flex flex-wrap items-stretch gap-4 print:hidden", className)}>{children}</div>;
}
