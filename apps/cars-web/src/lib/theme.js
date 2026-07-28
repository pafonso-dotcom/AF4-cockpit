/* ============================================================
   THEME · NUMVI · 7 paletas escuras + 3 claras (estilo demo v7)
   ============================================================ */

const FONTS = {
  serif: '"Inter", "Nunito", system-ui, -apple-system, sans-serif',
  body:  '"Inter", "Nunito", system-ui, -apple-system, sans-serif',
  mono:  '"Inter", ui-monospace, monospace',
  sans:  '"Inter", "Nunito", system-ui, -apple-system, sans-serif',
};

// Base ESCURA — todas as variantes mudam só o acento
const DARK_BASE = {
  dark: true,
  // Base grafite (#23272E) em vez de quase-preto — fundo mais elegante,
  // mantendo a hierarquia de profundidade (bg < bgSoft < card < cardHi).
  bg: "#23272E", bgSoft: "#282c34", card: "#2d323b", cardHi: "#333945",
  border: "#343a44", borderHi: "#3f4550",
  ink: "#f5f5f7", muted: "#a3a8b3", faint: "#6e7480",
  green: "#4ade80", red: "#f87171", blue: "#ed9355", yellow: "#fbbf24",
};

// Base CLARA — fundo bege quente + cards sem borda visível (inspirado no
// editorial "menos caixa, mais respiro": a separação vem do tom e do espaço,
// não de linha). Card levemente mais claro que o fundo pra "levantar" sozinho;
// a borda é quase invisível. As variantes claras mudam só acento e texto.
// Espelha os blocos [data-c] claros no index.css — os dois andam juntos.
const LIGHT_BASE = {
  dark: false,
  bg: "#f0e9db", bgSoft: "#e8dfcd", card: "#fbf8f2", cardHi: "#f5efe4",
  border: "#e9e0cf", borderHi: "#d8ccb6",
};

const THEMES = {
  // ----- DARK -----
  gold:    { ...DARK_BASE, id: "gold",    nome: "Esmeralda Suave", subtitulo: "Verde-água suave · padrão", gold: "#5bbf9a", goldHi: "#7ccdb0", blue: "#6f9fd8" },
  emerald: { ...DARK_BASE, id: "emerald", nome: "Esmeralda",      subtitulo: "Verde profissional",        gold: "#10b981", goldHi: "#34d399" },
  cyan:    { ...DARK_BASE, id: "cyan",    nome: "Cyan",           subtitulo: "Tech moderno",              gold: "#06b6d4", goldHi: "#22d3ee" },
  violet:  { ...DARK_BASE, id: "violet",  nome: "Violeta",        subtitulo: "Sofisticado",               gold: "#8b5cf6", goldHi: "#a78bfa" },
  rose:    { ...DARK_BASE, id: "rose",    nome: "Rosé",           subtitulo: "Acento quente",             gold: "#f43f5e", goldHi: "#fb7185" },
  amber:   { ...DARK_BASE, id: "amber",   nome: "Âmbar",          subtitulo: "Dourado vivo",              gold: "#f59e0b", goldHi: "#fbbf24" },
  ice:     { ...DARK_BASE, id: "ice",     nome: "Gelo",           subtitulo: "Mono · clean",              gold: "#e5e7eb", goldHi: "#f3f4f6" },

  // ----- LIGHT (fundo bege · cards sem borda) -----
  nevoa: {
    ...LIGHT_BASE, id: "nevoa", nome: "Névoa", subtitulo: "Sálvia suave · fundo bege",
    ink: "#1f2429", muted: "#5c6570", faint: "#949ba4",
    gold: "#5b9279", goldHi: "#74a992",
    green: "#4f9d76", red: "#cf7d6a", blue: "#6d8fb3", yellow: "#c1954b",
  },
  papel: {
    ...LIGHT_BASE, id: "papel", nome: "Papel", subtitulo: "Sépia · fundo bege",
    ink: "#2a2218", muted: "#4f432f", faint: "#796a52",
    gold: "#8a5a28", goldHi: "#a87440",
    green: "#56784f", red: "#9a4032", blue: "#3f6a8c", yellow: "#b8862a",
  },
  linho: {
    ...LIGHT_BASE, id: "linho", nome: "Linho", subtitulo: "Verde oliva · fundo bege",
    ink: "#222018", muted: "#4b463a", faint: "#766e5d",
    gold: "#5d7548", goldHi: "#7a9460",
    green: "#56784f", red: "#a14a3a", blue: "#3f6a8c", yellow: "#a87a2a",
  },
  perola: {
    ...LIGHT_BASE, id: "perola", nome: "Pérola", subtitulo: "Azul suave · fundo bege",
    ink: "#1a1a1f", muted: "#4c4c57", faint: "#76768c",
    gold: "#4a5a8a", goldHi: "#6a7aaa",
    green: "#3c8c5a", red: "#c14a4a", blue: "#3f6a8c", yellow: "#b88c2a",
  },
  moderno: {
    ...LIGHT_BASE, id: "moderno", nome: "Moderno", subtitulo: "Índigo · fundo bege",
    ink: "#14151a", muted: "#5b6172", faint: "#9aa0b0",
    gold: "#4f46e5", goldHi: "#6366f1",
    green: "#15a06b", red: "#e0566a", blue: "#3b82f6", yellow: "#d99a2b",
  },
};

// Lê overrides de texto do usuário no localStorage (escala + cor do ink).
// Aplicados em cima do tema escolhido.
const readTextOverrides = () => {
  if (typeof localStorage === "undefined") return {};
  const scale = Number(localStorage.getItem("af4:ui:text-scale"));
  const color = localStorage.getItem("af4:ui:text-color") || "";
  return {
    scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
    color: color || null,
  };
};

const getTheme = (id) => {
  const base = { ...(THEMES[id] || THEMES.gold), ...FONTS };
  const { color } = readTextOverrides();
  // Cor custom de texto sobrescreve T.ink (afeta títulos e textos principais
  // do app que usam style={{ color: T.ink }}).
  if (color) base.ink = color;
  return base;
};

export { THEMES };

export const T = { ...getTheme("gold") };

// Aplica vars CSS de tamanho/cor de texto no root. Idempotente.
export const applyTextStyle = () => {
  if (typeof document === "undefined") return;
  const { scale, color } = readTextOverrides();
  const root = document.documentElement;
  root.style.setProperty("--text-scale", String(scale));
  if (color) root.style.setProperty("--text-color", color);
  else root.style.removeProperty("--text-color");
};

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
  applyTextStyle();
};
