/**
 * Utilitários puros do módulo Invest.
 *
 * Extrai lógica que estava duplicada nas telas InvestPainel, CarteiraSaude,
 * AnaliseCarteira, Projecao e Proventos. Cada função recebe e devolve dados
 * simples (sem dependência de React) para ser testável e reaproveitável.
 */

import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "./invest-constants.js";

const COR_FALLBACK = "#9ca3af";

/**
 * Agrega ativos por classe (`tipo`), somando `qtd * preco`, e devolve um
 * array ordenado por valor (desc) com label e cor anexados.
 *
 * Ativos com `qtd` ou `preco` ausente, zero ou negativo são descartados.
 * Quando `tipo` está ausente/null/vazio, cai em "outro".
 *
 * @param {Array<{ tipo?: string, qtd?: number, preco?: number }>} ativos
 * @returns {Array<{ tipo: string, label: string, valor: number, pct: number, cor: string }>}
 */
export function calcAlocacaoPorClasse(ativos) {
  if (!Array.isArray(ativos) || ativos.length === 0) return [];

  const acc = {};
  let total = 0;
  for (const a of ativos) {
    const qtd = Number(a?.qtd);
    const preco = Number(a?.preco);
    if (!Number.isFinite(qtd) || !Number.isFinite(preco)) continue;
    if (qtd <= 0 || preco <= 0) continue;
    const valor = qtd * preco;
    const tipo = a?.tipo || "outro";
    acc[tipo] = (acc[tipo] || 0) + valor;
    total += valor;
  }

  if (total <= 0) return [];

  return Object.entries(acc)
    .map(([tipo, valor]) => ({
      tipo,
      label: ASSET_CLASS_LABELS[tipo] || tipo,
      valor,
      pct: (valor / total) * 100,
      cor: ASSET_CLASS_COLORS[tipo] || COR_FALLBACK,
    }))
    .sort((a, b) => b.valor - a.valor);
}
