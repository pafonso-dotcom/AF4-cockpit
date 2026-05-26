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

/**
 * Calcula a rentabilidade de um ativo a partir de quantidade, preço atual e
 * preço médio de aquisição.
 *
 * Aceita `pm` (campo usado nas telas atuais) ou `precoMedio` como alias.
 * Quando ambos estão presentes, `pm` tem precedência. Valores ausentes ou
 * não-numéricos são tratados como zero.
 *
 * `pctGanho` é `0` quando `custo` é `0` para evitar divisão por zero.
 *
 * @param {{ qtd?: number, preco?: number, pm?: number, precoMedio?: number } | null | undefined} ativo
 * @returns {{ custo: number, valor: number, ganho: number, pctGanho: number }}
 */
export function calcRentabilidadeAtivo(ativo) {
  const qtdRaw = Number(ativo?.qtd);
  const precoRaw = Number(ativo?.preco);
  const pmFonte = ativo?.pm !== undefined && ativo?.pm !== null
    ? ativo.pm
    : ativo?.precoMedio;
  const pmRaw = Number(pmFonte);

  const qtd = Number.isFinite(qtdRaw) ? qtdRaw : 0;
  const preco = Number.isFinite(precoRaw) ? precoRaw : 0;
  const pm = Number.isFinite(pmRaw) ? pmRaw : 0;

  const custo = qtd * pm;
  const valor = qtd * preco;
  const ganho = valor - custo;
  const pctGanho = custo === 0 ? 0 : (ganho / custo) * 100;
  return { custo, valor, ganho, pctGanho };
}
