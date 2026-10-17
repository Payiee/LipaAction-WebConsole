export function Tile({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: string | number;
  accent?: "default" | "brand" | "critical";
}) {
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
      <span className={`text-2xl font-semibold tabular-nums ${accentText}`}>{value}</span>
    </div>
  );
}
