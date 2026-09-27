/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        workbench: {
          bg: "#111215",
          ribbon: "#0d0e11",
          card: "#16181d",
          elevated: "#1c1f26",
          border: "#24262e",
          borderFocus: "#3b404d",
          text: "#ededed",
          muted: "#8a8f98",
          dim: "#525866",
          amber: "#f59e0b",
          amberGlow: "rgba(245, 158, 11, 0.15)",
          green: "#10b981",
          red: "#ef4444"
        }
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"IBM Plex Mono"', 'Menlo', 'Consolas', 'monospace'],
        sans: ['GeistSans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderRadius: {
        sharp: "2px",
        sm: "3px",
        md: "4px"
      }
    },
  },
  plugins: [],
};
