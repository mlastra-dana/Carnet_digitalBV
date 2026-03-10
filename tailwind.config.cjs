const colors = require("tailwindcss/colors");

const tremor = {
  brand: {
    faint: "#eff6ff",
    muted: "#bfdbfe",
    subtle: "#60a5fa",
    DEFAULT: "#3b82f6",
    emphasis: "#1d4ed8",
    inverted: "#ffffff"
  },
  background: {
    muted: "#0f172a",
    subtle: "#020617",
    DEFAULT: "#020617",
    emphasis: "#111827"
  },
  border: {
    DEFAULT: "#1f2937"
  },
  ring: {
    DEFAULT: "#3b82f6"
  },
  content: {
    subtle: "#6b7280",
    DEFAULT: "#e5e7eb",
    emphasis: "#f9fafb",
    strong: "#ffffff",
    inverted: "#111827"
  }
};

const darkTremor = {
  brand: {
    faint: "#0f172a",
    muted: "#1d4ed8",
    subtle: "#60a5fa",
    DEFAULT: "#3b82f6",
    emphasis: "#93c5fd",
    inverted: "#0b1120"
  },
  background: {
    muted: "#020617",
    subtle: "#020617",
    DEFAULT: "#020617",
    emphasis: "#111827"
  },
  border: {
    DEFAULT: "#1f2937"
  },
  ring: {
    DEFAULT: "#93c5fd"
  },
  content: {
    subtle: "#6b7280",
    DEFAULT: "#e5e7eb",
    emphasis: "#f9fafb",
    strong: "#ffffff",
    inverted: "#020617"
  }
};

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        transparent: "transparent",
        current: "currentColor",
        black: colors.black,
        white: colors.white,
        tremor: {
          brand: tremor.brand,
          background: tremor.background,
          border: tremor.border,
          ring: tremor.ring,
          content: tremor.content
        },
        "dark-tremor": {
          brand: darkTremor.brand,
          background: darkTremor.background,
          border: darkTremor.border,
          ring: darkTremor.ring,
          content: darkTremor.content
        }
      },
      boxShadow: {
        "tremor-card": "0 1px 3px 0 rgba(15, 23, 42, 0.4)",
        "tremor-dropdown": "0 4px 6px -1px rgba(15, 23, 42, 0.4)"
      },
      borderRadius: {
        "tremor-small": "0.375rem",
        "tremor-default": "0.5rem",
        "tremor-full": "9999px"
      },
      fontSize: {
        "tremor-default": ["0.875rem", { lineHeight: "1.25rem" }],
        "tremor-title": ["1.125rem", { lineHeight: "1.75rem" }],
        "tremor-metric": ["1.875rem", { lineHeight: "2.25rem" }]
      }
    }
  },
  plugins: []
};

