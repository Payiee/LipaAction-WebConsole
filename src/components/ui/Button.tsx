import { cx } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantStyles: Record<string, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "bg-white text-ink-700 border border-ink-100 hover:bg-ink-50",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-white text-priority-critical border border-priority-critical/30 hover:bg-priority-criticalBg",
};

const sizeStyles: Record<string, string> = {
  // Both sizes are at least 44px tall: the manuscript (NFR-03, Batas
  // Pambansa 344) asks for 44 by 44 targets on every surface. sm keeps the
  // smaller type and tighter sides; only the height is the same.
  sm: "min-h-11 text-xs px-3",
  md: "min-h-11 text-sm px-4",
  // The report dialog's decision buttons: the action an official came to
  // take, made easy to see.
  lg: "min-h-12 text-base px-6 font-semibold",
};

/**
 * The button's classes on their own, for a link that should look like one.
 * A <button> nested in an <a> is invalid interactive nesting — screen readers
 * announce two controls, and keyboard activation is inconsistent. Style the
 * anchor instead.
 */
export function buttonClassName(
  variant: ButtonProps["variant"] = "secondary",
  size: ButtonProps["size"] = "md",
  className?: string
): string {
  return cx(
    "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    variantStyles[variant],
    sizeStyles[size],
    className
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={buttonClassName(variant, size, className)} {...props} />;
}
