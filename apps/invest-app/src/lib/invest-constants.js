/**
 * Constantes compartilhadas do módulo Invest.
 *
 * Deduplica:
 * - CLASS_LABEL / CLASS_COR antes inline em InvestPainel, CarteiraSaude,
 *   AnaliseCarteira, Projecao e Proventos.
 * - PROV_RE antes inline em InvestPainel e Proventos.
 */

export const ASSET_CLASS_LABELS = {
  acao: "Ações BR",
  fii: "FIIs",
  stock: "Stocks US",
  reit: "REITs",
  etf: "ETFs",
  cripto: "Cripto",
  fundo: "Fundos",
  rf: "Renda Fixa",
  tesouro: "Tesouro",
  cdb: "CDB",
  outro: "Outros",
};

export const ASSET_CLASS_COLORS = {
  acao: "#f5a524",
  fii: "#10b981",
  stock: "#3b82f6",
  reit: "#0ea5e9",
  cripto: "#8b5cf6",
  fundo: "#a855f7",
  etf: "#fbbf24",
  rf: "#06b6d4",
  tesouro: "#22c55e",
  cdb: "#14b8a6",
  outro: "#9ca3af",
};

export const PROVENTO_REGEX = /provent|dividend|rendiment|juros sobre|jcp\b/i;
