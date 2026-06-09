/* ============================================================
   FORMAT · helpers de formatação e utilidades
   ============================================================ */

// Number.isFinite descarta null/undefined/NaN/Infinity — evita "R$ NaN" na UI.
const safeNum = (v) => (Number.isFinite(v) ? v : 0);

export const fmt = (v, c = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: c, maximumFractionDigits: 2 }).format(safeNum(v));

export const fmtN = (v, d = 2) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }).format(safeNum(v));

export const fmtP = (v) => `${v >= 0 ? "+" : ""}${fmtN(v, 2)}%`;

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const todayISO = () => new Date().toISOString().slice(0, 10);

/* Máscara de moeda "estilo caixa": pega só os dígitos digitados e trata os
   2 últimos como centavos. Ex.: "150050" → 1500.50, "1500" → 15.00, "" → 0. */
export const digitosParaValor = (str) => {
  const digits = String(str ?? "").replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};

/* Simulação de variação de preço (fallback quando APIs não respondem) */
export const simulateTick = (preco, vol = 0.015) => {
  const drift = (Math.random() - 0.5) * 2 * vol;
  return Math.max(0.01, preco * (1 + drift));
};

/* Gera série histórica simulada (para gráficos quando não há dado real) */
export const generateHistory = (basePrice, days = 30, vol = 0.018) => {
  const out = [];
  let p = basePrice * (1 - vol * 4);
  for (let i = days; i >= 0; i--) {
    p = simulateTick(p, vol);
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push({ data: d.toISOString().slice(5, 10), preco: +p.toFixed(2) });
  }
  out[out.length - 1].preco = basePrice;
  return out;
};
