const { heroui } = require("@heroui/react");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
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
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: "#0077B6",
            secondary: "#00B4D8",
          },
        },
        dark: {
          colors: {
            primary: "#0077B6",
            secondary: "#00B4D8",
          },
        },
      },
    }),
  ],
};
