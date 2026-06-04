/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta do catálogo — preto + vermelho, igual à arte de referência.
        ink: "#0a0a0b",
        surface: "#141417",
        surface2: "#1c1c20",
        line: "#2a2a30",
        brand: "#e4121f",
        brandSoft: "#ef3b46",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Archivo'", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
