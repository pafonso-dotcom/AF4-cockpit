/* ============================================================
   THEME · AF4 Cockpit · 7 paletas escuras + 3 claras (estilo demo v7)
   ============================================================ */

const FONTS = {
  serif: '"Poppins", system-ui, -apple-system, sans-serif',
  body:  '"Poppins", system-ui, -apple-system, sans-serif',
  mono:  '"Poppins", ui-monospace, monospace',
  sans:  '"Poppins", system-ui, -apple-system, sans-serif',
};

// Base ESCURA — todas as variantes mudam só o acento
const DARK_BASE = {
  dark: true,
  bg: "#0a0a0c", bgSoft: "#111114", card: "#131317", cardHi: "#17171c",
  border: "#1f1f24", borderHi: "#2a2a30",
  ink: "#f5f5f7", muted: "#8a8a93", faint: "#54545c",
  green: "#4ade80", red: "#f87171", blue: "#60a5fa", yellow: "#fbbf24",
};

const THEMES = {
  // ----- DARK -----
  gold:    { ...DARK_BASE, id: "gold",    nome: "Editorial Gold", subtitulo: "Preto e dourado · padrão", gold: "#c9a961", goldHi: "#d4b87a" },
  emerald: { ...DARK_BASE, id: "emerald", nome: "Esmeralda",      subtitulo: "Verde profissional",        gold: "#10b981", goldHi: "#34d399" },
  cyan:    { ...DARK_BASE, id: "cyan",    nome: "Cyan",           subtitulo: "Tech moderno",              gold: "#06b6d4", goldHi: "#22d3ee" },
  violet:  { ...DARK_BASE, id: "violet",  nome: "Violeta",        subtitulo: "Sofisticado",               gold: "#8b5cf6", goldHi: "#a78bfa" },
  rose:    { ...DARK_BASE, id: "rose",    nome: "Rosé",           subtitulo: "Acento quente",             gold: "#f43f5e", goldHi: "#fb7185" },
  amber:   { ...DARK_BASE, id: "amber",   nome: "Âmbar",          subtitulo: "Dourado vivo",              gold: "#f59e0b", goldHi: "#fbbf24" },
  ice:     { ...DARK_BASE, id: "ice",     nome: "Gelo",           subtitulo: "Mono · clean",              gold: "#e5e7eb", goldHi: "#f3f4f6" },

  // ----- LIGHT -----
  papel: {
    dark: false, id: "papel", nome: "Papel", subtitulo: "Sépia · papel antigo",
    bg: "#f4ecd8", bgSoft: "#ede3ca", card: "#fbf6e8", cardHi: "#f4ecd8",
    border: "#d9c9a3", borderHi: "#bfae87",
    ink: "#2a2218", muted: "#5e503c", faint: "#8a7b62",
    gold: "#8a5a28", goldHi: "#a87440",
    green: "#56784f", red: "#9a4032", blue: "#3f6a8c", yellow: "#b8862a",
  },
  linho: {
    dark: false, id: "linho", nome: "Linho", subtitulo: "Verde oliva sobre linho",
    bg: "#f3efe7", bgSoft: "#ebe5d8", card: "#fbf9f3", cardHi: "#f3efe7",
    border: "#d0c8b6", borderHi: "#a89d83",
    ink: "#222018", muted: "#5a5346", faint: "#857d6c",
    gold: "#5d7548", goldHi: "#7a9460",
    green: "#56784f", red: "#a14a3a", blue: "#3f6a8c", yellow: "#a87a2a",
  },
  perola: {
    dark: false, id: "perola", nome: "Pérola", subtitulo: "Branco perolado · azul",
    bg: "#f5f5f7", bgSoft: "#eaeaef", card: "#ffffff", cardHi: "#f5f5f7",
    border: "#d8d8de", borderHi: "#a8a8b0",
    ink: "#1a1a1f", muted: "#5a5a64", faint: "#8888a0",
    gold: "#4a5a8a", goldHi: "#6a7aaa",
    green: "#3c8c5a", red: "#c14a4a", blue: "#3f6a8c", yellow: "#b88c2a",
  },
};

const getTheme = (id) => ({ ...(THEMES[id] || THEMES.gold), ...FONTS });

export { THEMES };

export const T = { ...getTheme("gold") };

export const applyTheme = (id) => {
  const next = getTheme(id);
  for (const k of Object.keys(T)) delete T[k];
  Object.assign(T, next);
  if (typeof document !== "undefined") {
    document.body.dataset.c = id;
    const root = document.documentElement;
    root.style.setProperty("--ac", T.gold);
    root.style.setProperty("--ac2", T.goldHi);
  }
};
