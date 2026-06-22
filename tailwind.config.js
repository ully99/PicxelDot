/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        pixel: ["Inter", "system-ui", "sans-serif"],
        ui: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        pixel: "inset -2px -2px 0 #111827, inset 2px 2px 0 #71717a",
      },
    },
  },
  plugins: [],
};
