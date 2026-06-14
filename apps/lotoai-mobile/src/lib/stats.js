/* ============================================================
   Estatísticas sobre concursos passados
   - frequência, atrasos, dezenas quentes/frias
   ============================================================ */

import { NUMEROS, LOTOFACIL } from "./lotofacil.js";

/**
 * Frequência absoluta de cada dezena no histórico.
 * @param {number[][]} historico  array de sorteios (cada sorteio é array de 15 dezenas)
 * @returns {Record<number, number>}
 */
export function frequencias(historico) {
  const f = Object.fromEntries(NUMEROS.map(n => [n, 0]));
  for (const s of historico) for (const n of s) f[n] = (f[n] || 0) + 1;
  return f;
}

/** Quantos concursos cada dezena está sem sair (a partir do último concurso) */
export function atrasos(historico) {
  const a = Object.fromEntries(NUMEROS.map(n => [n, historico.length]));
  for (let i = historico.length - 1, k = 0; i >= 0; i--, k++) {
    for (const n of historico[i]) if (a[n] === historico.length) a[n] = k;
  }
  return a;
}

/** Top N dezenas mais frequentes */
export function quentes(historico, n = 8) {
  const f = frequencias(historico);
  return Object.entries(f)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([num]) => +num);
}

/** Top N dezenas menos frequentes */
export function frias(historico, n = 8) {
  const f = frequencias(historico);
  return Object.entries(f)
    .sort((a, b) => a[1] - b[1])
    .slice(0, n)
    .map(([num]) => +num);
}

/**
 * Pontuação heurística por dezena: combina frequência e atraso.
 * Defaults vêm do grid search sobre 500 concursos reais (ver
 * data/grid-top.json e RELATORIO-EXECUTIVO.md):
 *   wFreq=0.7, wAtraso=0.0, janela=100 → menor prejuízo no backtest (-29.67%).
 *
 * Modo bayesiano (bayesian=true): usa posterior Beta(α0+sucessos, β0+falhas)
 * com prior Beta(15, 10) que favorece P=0.6 (P teórica = 15/25). Mais
 * rigoroso pra janelas curtas; em janelas longas converge pra frequência.
 */
export function scores(historico, { pesoFreq = 0.7, pesoAtraso = 0.0, janela = 100, bayesian = false } = {}) {
  const fonte = janela > 0 && historico.length > janela ? historico.slice(-janela) : historico;
  const a = atrasos(historico);
  const maxA = Math.max(...Object.values(a), 1);
  const out = {};

  if (bayesian) {
    const N = fonte.length;
    const sucessos = Object.fromEntries(NUMEROS.map(n => [n, 0]));
    for (const s of fonte) for (const n of s) sucessos[n]++;
    for (const n of NUMEROS) {
      const pBay = (15 + sucessos[n]) / (25 + N);
      out[n] = pBay * pesoFreq + (a[n] / maxA) * pesoAtraso;
    }
    return out;
  }

  const f = frequencias(fonte);
  const maxF = Math.max(...Object.values(f), 1);
  for (const n of NUMEROS) {
    out[n] = (f[n] / maxF) * pesoFreq + (a[n] / maxA) * pesoAtraso;
  }
  return out;
}

/** Distribuição empírica de pares por sorteio (0–15) */
export function distPares(historico) {
  const dist = Array(LOTOFACIL.numerosPorJogo + 1).fill(0);
  for (const s of historico) {
    const p = s.filter(n => n % 2 === 0).length;
    dist[p]++;
  }
  return dist;
}
