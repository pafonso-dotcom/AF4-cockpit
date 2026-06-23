/**
 * Constantes compartilhadas do módulo Invest.
 *
 * Deduplica:
 * - CLASS_LABEL / CLASS_COR antes inline em InvestPainel, CarteiraSaude,
 *   AnaliseCarteira, Projecao e Proventos.
 * - PROV_RE antes inline em InvestPainel e Proventos.
 */

import { fmt, fmtUSD } from "./format.js";

export const ASSET_CLASS_LABELS = {
  acao: "Ações BR",
  fii: "FIIs",
  stock: "Stocks US",
  reit: "REITs",
  etf: "ETFs",
  cripto: "Cripto",
  rf: "Renda Fixa",
  tesouro: "Tesouro",
  cdb: "CDB",
  capitalSocial: "Capital Social",
  outro: "Outros",
};

export const ASSET_CLASS_COLORS = {
  acao: "#f5a524",
  fii: "#10b981",
  stock: "#3b82f6",
  reit: "#0ea5e9",
  cripto: "#8b5cf6",
  etf: "#fbbf24",
  rf: "#06b6d4",
  tesouro: "#22c55e",
  cdb: "#14b8a6",
  capitalSocial: "#0d9488",
  outro: "#9ca3af",
};

export const PROVENTO_REGEX = /provent|dividend|rendiment|juros sobre|jcp\b/i;

// Capital Social: conta no patrimônio, mas fica FORA dos cálculos de estratégia
// (alocação, saúde, rebalanceamento, objetivos, simulação — os "bots").
export const CAPITAL_SOCIAL_TIPO = "capitalSocial";
export const semCapitalSocial = (ativos = []) =>
  (ativos || []).filter(a => a?.tipo !== CAPITAL_SOCIAL_TIPO);

// Ativos US (preço em dólar) — Stocks e REITs.
export const US_TIPOS = new Set(["stock", "reit"]);
export const ehUS = (a) => US_TIPOS.has(a?.tipo);

// Tipos com análise técnica/fundamentalista disponível.
export const TIPOS_ANALISAVEIS = ["acao", "fii", "stock", "reit", "etf", "cripto"];

// Formata no padrão da moeda do ativo (US$ para Stocks/REITs, R$ para o resto).
export const fmtMoedaAtivo = (a, v) => (ehUS(a) ? fmtUSD(v) : fmt(v));
