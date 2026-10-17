import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // LipaAction brand + semantic priority tokens.
        brand: {
          50: "#f0f7f2",
          100: "#dbeee0",
          200: "#b8ddc4",
          300: "#8bc6a0",
          400: "#59a878",
          500: "#357a53", // primary brand green (Validate / active nav / logo mark)
          600: "#276142",
          700: "#204e36",
          800: "#1b3f2c",
          900: "#173525",
        },
        priority: {
          // Text colours. Each must reach 4.5:1 on its own *Bg tint and on
          // white, because the same token colours notes on plain rows (WCAG
          // 2.2 AA 1.4.3, which the manuscript commits to). Measured 2026-09-24:
          // critical 4.74 / 5.52, high 5.12 / 5.74, medium 5.19 / 5.74,
          // low 5.15 / 5.86. The high, medium and low values were 3.16, 2.69
          // and 4.05 on their tints before that.
          critical: "#c0362c", // Critical badge red
          criticalBg: "#fbeae9",
          high: "#9c5314", // High badge orange
          highBg: "#fdf0e3",
          medium: "#7f620f", // Medium badge amber
          mediumBg: "#fbf3dd",
          low: "#3f6b78", // Low badge slate-teal
          lowBg: "#e9f2f4",
        },
        ink: {
          900: "#161c19",
          700: "#3a443f",
          500: "#657168",
          300: "#a4ada2",
          100: "#e4e8e2",
          50: "#f6f8f5",
        },
      },
      fontFamily: {
        // var() first: the self-hosted faces loaded in layout.tsx via next/font.
        // The names after it are the fallback if that ever fails to load.
        sans: [
          "var(--font-inter)",
          "Inter",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // Larger than Tailwind's defaults (12 and 14 px): the officials at the
      // desk are often older, and reviewer feedback in October 2026 found the
      // console's text too small. Everything that used to be set at 11 px
      // now uses xs, so 13 px is the smallest text on any page; the 9 and
      // 10 px left are the initials inside fixed-size avatar circles.
      fontSize: {
        xs: ["0.8125rem", { lineHeight: "1.25rem" }],
        sm: ["0.9375rem", { lineHeight: "1.375rem" }],
      },
      boxShadow: {
        panel: "0 1px 2px 0 rgb(22 28 25 / 0.06), 0 1px 3px 0 rgb(22 28 25 / 0.08)",
      },
      borderRadius: {
        card: "10px",
      },
      // Three animations, each carrying meaning rather than decoration: a
      // row that has just arrived on its own, a toast entering, and the
      // detail drawer coming in from the edge it sits on. All are applied
      // through Tailwind's `motion-safe:` variant, so a viewer who asks for
      // reduced motion gets the same information without movement — the
      // arrived row keeps a static tint and a New chip instead.
      keyframes: {
        arrival: {
          // Holds the tint long enough to be noticed if the official looked
          // away, then clears itself.
          "0%, 55%": { backgroundColor: "#dbeee0" },
          // White, not transparent: each report is a white card now.
          "100%": { backgroundColor: "#ffffff" },
        },
        toastIn: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        drawerIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        scrimIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        arrival: "arrival 4s ease-out forwards",
        toastIn: "toastIn 150ms ease-out",
        drawerIn: "drawerIn 200ms ease-out",
        scrimIn: "scrimIn 200ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
