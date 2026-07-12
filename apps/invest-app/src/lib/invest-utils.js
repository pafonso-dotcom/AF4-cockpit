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

/**
 * Calcula o score de saúde da carteira (0-100) e métricas auxiliares.
 *
 * Score = 30 (base) + scoreDiversidade (0-30) + scoreLucro (0-25) + scoreQtd (0-15),
 * limitado em 100.
 *
 * - scoreDiversidade: cai de 30 (HHI ≤ 0.10) a 0 (HHI ≥ 0.40).
 * - scoreLucro: pctLucro / 100 × 25.
 * - scoreQtd: validos.length × 1.5, cap 15 (10 ativos).
 *
 * Ativos com `qtd × preco ≤ 0` (ou valores não-numéricos) são ignorados em
 * todas as métricas. Quando `tipo` está ausente, cai em "outro". Aceita `pm`
 * (campo atual nas telas) ou `precoMedio` como alias.
 *
 * @param {Array<{ tipo?: string, qtd?: number, preco?: number, pm?: number, precoMedio?: number }>} ativos
 * @returns {{ score: number, herfindahl: number, totalAtivos: number, noLucro: number, pctLucro: number, total: number }}
 */
export function calcCarteiraSaude(ativos) {
  const zeros = { score: 0, herfindahl: 0, totalAtivos: 0, noLucro: 0, pctLucro: 0, total: 0 };
  if (!Array.isArray(ativos) || ativos.length === 0) return zeros;

  const validos = [];
  const porClasse = {};
  let total = 0;
  for (const a of ativos) {
    const qtd = Number(a?.qtd);
    const preco = Number(a?.preco);
    if (!Number.isFinite(qtd) || !Number.isFinite(preco)) continue;
    if (qtd <= 0 || preco <= 0) continue;
    const valor = qtd * preco;
    const tipo = a?.tipo || "outro";
    porClasse[tipo] = (porClasse[tipo] || 0) + valor;
    total += valor;
    validos.push(a);
  }

  if (validos.length === 0 || total <= 0) return zeros;

  const herfindahl = Object.values(porClasse).reduce(
    (s, v) => s + (v / total) ** 2,
    0,
  );

  let noLucro = 0;
  for (const a of validos) {
    const preco = Number(a.preco);
    const pmFonte = a.pm !== undefined && a.pm !== null ? a.pm : a.precoMedio;
    const pmRaw = Number(pmFonte);
    const pm = Number.isFinite(pmRaw) ? pmRaw : 0;
    if (preco > pm) noLucro++;
  }
  const pctLucro = (noLucro / validos.length) * 100;

  const scoreDiversidade = Math.max(
    0,
    Math.min(30, 30 * (1 - (herfindahl - 0.10) / 0.30)),
  );
  const scoreLucro = (pctLucro / 100) * 25;
  const scoreQtd = Math.min(15, validos.length * 1.5);
  const score = Math.min(
    100,
    Math.round(30 + scoreDiversidade + scoreLucro + scoreQtd),
  );

  return {
    score,
    herfindahl,
    totalAtivos: validos.length,
    noLucro,
    pctLucro,
    total,
  };
}

/**
 * Soma dos proventos REALMENTE recebidos por ticker, a partir do histórico da
 * carteira de proventos (entradas tipo "recebimento" baixadas na tela
 * Proventos). Base do "Proventos acumulados" por posição na Carteira.
 * @param {Array} historico  carteiraProventos.historico
 * @returns {{ [TICKER]: number }}
 */
export function proventosRecebidosPorTicker(historico = []) {
  const m = {};
  for (const h of historico || []) {
    if (!h || h.tipo !== "recebimento" || !h.ticker) continue;
    const tk = String(h.ticker).trim().toUpperCase();
    m[tk] = (m[tk] || 0) + (Number(h.valor) || 0);
  }
  return m;
}
