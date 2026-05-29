/**
 * Yields-base estimados por classe de ativo (rentabilidade mensal líquida).
 * Usado pra estimar renda mensal de uma carteira composta.
 *
 * Valores conservadores baseados em médias históricas (2020-2025).
 * Refinamento futuro: buscar yields em tempo real via Brapi.
 */

export const YIELDS_MENSAIS = {
  fii:     0.0080, // 0.80% — DY médio FIIs
  acao:    0.0045, // 0.45% — DY médio blue chips BR
  stock:   0.0020, // 0.20% — DY médio S&P500
  reit:    0.0060, // 0.60% — DY médio REITs
  etf:     0.0020,
  cripto:  0.0000, // não paga dividendos
  rf:      0.0080, // ~0.80% líquido — Selic / CDB liquidez
  tesouro: 0.0085, // ~0.85% líquido — Tesouro IPCA+ longo
  cdb:     0.0080,
  outro:   0.0000,
};

/**
 * Calcula renda mensal estimada (líquida) somando valor × yield por classe.
 *
 * @param {Array<{ tipo: string, valor: number }>} carteira
 * @returns {{ rendaMensal: number, breakdown: Array<{ tipo, valor, yield, renda }> }}
 */
export function calcularRendaMensalCarteira(carteira) {
  const breakdown = [];
  let total = 0;
  for (const c of carteira || []) {
    const yieldM = YIELDS_MENSAIS[c.tipo] ?? 0;
    const renda = (c.valor || 0) * yieldM;
    total += renda;
    breakdown.push({ tipo: c.tipo, valor: c.valor, yield: yieldM, renda });
  }
  return { rendaMensal: total, breakdown };
}
