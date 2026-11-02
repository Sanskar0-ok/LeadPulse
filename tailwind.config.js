/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/renderer/**/*.{js,jsx,ts,tsx}"
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        slate: {
          950: "#020617"
        },
        teal: {
          450: "#2dd4bf"
        }
      },
      boxShadow: {
        glow: "0 0 30px rgba(20, 184, 166, 0.12)"
      }
    }
  },
  plugins: []
};