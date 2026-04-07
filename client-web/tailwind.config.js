const daisyui = require('daisyui');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 4px 24px -4px rgba(0, 119, 182, 0.12), 0 8px 16px -8px rgba(0, 180, 216, 0.08)',
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0, 119, 182, 0.06)',
        'card-hover': '0 8px 30px rgba(0, 119, 182, 0.12), 0 4px 12px rgba(0,0,0,0.05)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  darkMode: "class",
  corePlugins: {
    preflight: false,
  },
  plugins: [daisyui],
  daisyui: {
    prefix: "d-",
    themes: [
      {
        wcothailand: {
          "primary": "#0077B6",
          "primary-content": "#ffffff",
          "secondary": "#00B4D8",
          "secondary-content": "#ffffff",
          "accent": "#48CAE4",
          "accent-content": "#0a1628",
          "neutral": "#1e293b",
          "neutral-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#f8fafc",
          "base-300": "#e2e8f0",
          "base-content": "#1e293b",
          "info": "#0ea5e9",
          "info-content": "#ffffff",
          "success": "#22c55e",
          "success-content": "#ffffff",
          "warning": "#f59e0b",
          "warning-content": "#1e293b",
          "error": "#ef4444",
          "error-content": "#ffffff",
        },
      },
    ],
    defaultTheme: "wcothailand",
  },
};
