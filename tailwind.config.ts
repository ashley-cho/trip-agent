import type { Config } from "tailwindcss";

/**
 * Colours come from CSS custom properties rather than literals, so light and
 * dark are one palette with two sets of values instead of two sets of classes
 * scattered through the components. Nothing in the app writes `dark:`.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "var(--ink)",
          soft: "var(--ink-soft)",
          faint: "var(--ink-faint)",
        },
        paper: {
          DEFAULT: "var(--paper)",
          card: "var(--paper-card)",
          edge: "var(--paper-edge)",
          hover: "var(--paper-hover)",
          sunk: "var(--paper-sunk)",
          blank: "var(--paper-blank)",
          dashed: "var(--edge-dashed)",
        },
        warn: "var(--warn-bg)",
        good: { DEFAULT: "var(--good-bg)", ink: "var(--good-ink)" },
        accent: {
          DEFAULT: "var(--accent)",
          soft: "var(--accent-soft)",
        },
      },
      fontFamily: {
        serif: ["Georgia", "Times New Roman", "serif"],
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      maxWidth: { readable: "44rem" },
    },
  },
  plugins: [],
} satisfies Config;
