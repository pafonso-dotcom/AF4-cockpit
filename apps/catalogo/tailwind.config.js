/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta AF4 — laranja + vermelho sobre preto.
        ink: "#0a0a0b",
        surface: "#141417",
        surface2: "#1c1c20",
        line: "#2a2a30",
        brand: "#e4121f", // vermelho ("4" do logo, CTA, detalhes)
        brandSoft: "#ef3b46",
        accent: "#f97316", // laranja ("AF" do logo, destaques, ícones)
        accentSoft: "#fb923c",
        money: "#22c55e", // verde (preços)
        moneySoft: "#4ade80",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Archivo'", "Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
