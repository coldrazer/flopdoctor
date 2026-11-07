/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B0D10",
        surface: "#14171C",
        raised: "#1C2027",
        line: "#242931",
        line2: "#3A414C",
        ink: "#E8EAED",
        muted: "#8A93A0",
        vital: "#3CF2A0",
        flat: "#FF4D5E",
        normal: "#5B6573",
        accent: "#FFC845",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
