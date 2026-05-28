import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "var(--bg)",
        surface:  "var(--surface)",
        surface2: "var(--surface-2)",
        border:   "var(--border)",
        border2:  "var(--border-2)",
        ink:      "var(--ink)",
        ink2:     "var(--ink-2)",
        muted:    "var(--muted)",
        faint:    "var(--faint)",
        primary:  "var(--primary)",
        primary2: "var(--primary-hover)",
        accent:   "var(--accent)",
        good:     "var(--good)",
        warn:     "var(--warn)",
        bad:      "var(--bad)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        pop:  "0 4px 6px -1px rgba(16,24,40,0.08), 0 2px 4px -2px rgba(16,24,40,0.06)",
        lift: "0 12px 28px -8px rgba(16,24,40,0.16)",
      },
    },
  },
  plugins: [],
};
export default config;
