/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          darkBg: "#08090b",
          darkCard: "#111216",
          darkSubtle: "#171920",
          lightBg: "#f8f9fa",
          lightCard: "#ffffff",
          lightSubtle: "#f1f3f5",
          emerald: "#10b981",
          indigo: "#6366f1",
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        'studio-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'studio-card': '0 4px 20px -2px rgba(0, 0, 0, 0.1)',
        'studio-glow': '0 0 25px -5px rgba(99, 102, 241, 0.15)',
      }
    },
  },
  plugins: [],
};
