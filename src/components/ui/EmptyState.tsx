import { cx } from "@/lib/utils";
import { Icon, type IconName } from "./Icon";

/**
 * A page or section with nothing to show, said in a card of its own with an
 * icon for what is empty, so it reads as a state of the data and not as a
 * page that failed to draw. The words are the caller's.
 */
export function EmptyState({
  icon,
  role,
  className,
  children,
}: {
  icon: IconName;
  role?: "alert" | "status";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role={role}
      className={cx("rounded-card border border-dashed border-ink-300 bg-white px-6 py-12 text-center", className)}
    >
      <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-ink-50 text-ink-500">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      {children}
    </div>
  );
}
