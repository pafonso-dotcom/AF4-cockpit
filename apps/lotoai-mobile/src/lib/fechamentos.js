/* ============================================================
   FECHAMENTOS · Lotofácil
   - Fechamento completo: todas as C(K, 15) combinações de K dezenas-base
   - Garantia: dado K dezenas-base, se T saírem no sorteio, no PIOR caso
     o melhor jogo tem max(11, 15 - (K - T)) pontos.
   - Cálculo de custo total e melhor ponto teórico
   ============================================================ */

import { combinacoes as comb, LOTOFACIL, contarAcertos } from "./lotofacil.js";

/** Combinatória C(n, k) — alias claro para o módulo */
export const combinacoes = comb;

/** Custo total em R$ de um fechamento de K dezenas (jogando todas as C(K,15)) */
export function custoFechamentoCompleto(K) {
  return +(combinacoes(K, LOTOFACIL.numerosPorJogo) * LOTOFACIL.precoAposta).toFixed(2);
}

/**
 * Garantia matemática teórica do fechamento completo.
 * Se você joga K dezenas (15 ≤ K ≤ 20) em todas as C(K, 15) apostas, e T das
 * suas K dezenas saem no sorteio, o MELHOR jogo terá pelo menos:
 *   pontos = max(11, T - (15 - T))  …limitado ao mínimo premiável (11)
 * No fechamento completo, garante-se: T pontos no melhor jogo sempre que T ≤ 15
 * (porque uma das apostas é exatamente as T dezenas + (15-T) das (K-T) que não saíram).
 *
 * Retorna a tabela de garantias para diferentes T.
 */
export function tabelaGarantias(K) {
  const rows = [];
  for (let T = 11; T <= 15; T++) {
    const garantia = Math.min(T, 15);
    rows.push({ acertosBase: T, garantiaPontos: garantia });
  }
  return rows;
}

/**
 * Gera o fechamento completo: todas as C(K, 15) combinações das dezenas-base.
 * Para K=15 → 1 aposta. K=16 → 16. K=17 → 136. K=18 → 816. K=19 → 3876. K=20 → 15504.
 * Use com cuidado em K ≥ 19 (memória + custo financeiro).
 */
export function gerarFechamentoCompleto(dezenas) {
  if (dezenas.length < 15 || dezenas.length > 20) {
    throw new Error(`Fechamento aceita 15–20 dezenas, recebido ${dezenas.length}`);
  }
  const base = [...dezenas].sort((a, b) => a - b);
  const k = LOTOFACIL.numerosPorJogo;
  const out = [];
  const indices = Array.from({ length: k }, (_, i) => i);

  while (true) {
    out.push(indices.map(i => base[i]));
    let i = k - 1;
    while (i >= 0 && indices[i] === base.length - k + i) i--;
    if (i < 0) break;
    indices[i]++;
    for (let j = i + 1; j < k; j++) indices[j] = indices[j - 1] + 1;
  }
  return out;
}

/**
 * Analisa o fechamento contra um sorteio:
 *  - melhor pontuação em qualquer aposta
 *  - distribuição de pontos por aposta (11-15)
 *  - prêmio estimado (usando tabela média de PREMIO_MEDIO)
 */
export function analisarFechamento(jogos, sorteio, PREMIO_MEDIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 }) {
  const dist = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0, "<11": 0 };
  let melhor = 0;
  let premio = 0;
  for (const j of jogos) {
    const p = contarAcertos(j, sorteio);
    if (p > melhor) melhor = p;
    if (p in dist) {
      dist[p]++;
      premio += PREMIO_MEDIO[p] || 0;
    } else {
      dist["<11"]++;
    }
  }
  return { melhor, dist, premioEstimado: +premio.toFixed(2) };
}

/**
 * Heurística para sugerir K dezenas-base partindo de scores por dezena
 * (frequência+atraso, vindo de stats.scores). Pega as top-K com maior score.
 */
export function sugerirBase(scoresMap, K = 18) {
  return Object.entries(scoresMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, K)
    .map(([n]) => +n)
    .sort((a, b) => a - b);
}

/** Resumo financeiro completo para a UI */
export function resumoFechamento(K) {
  const apostas = combinacoes(K, LOTOFACIL.numerosPorJogo);
  const custo = custoFechamentoCompleto(K);
  return {
    dezenasBase: K,
    apostas,
    custo,
    garantias: tabelaGarantias(K),
  };
}

/* ============================================================
   Matrizes de cobertura reduzidas
   ============================================================ */

let _coveringsCache = null;

/** Carrega as matrizes pré-calculadas (lazy, cacheado) */
export async function loadCoverings() {
  if (_coveringsCache) return _coveringsCache;
  try {
    const res = await fetch("./coverings.json");
    if (res.ok) {
      _coveringsCache = await res.json();
      return _coveringsCache;
    }
  } catch {}
  _coveringsCache = {};
  return _coveringsCache;
}

/** Aplica uma matriz salva (índices 1..K) sobre a base real */
export function aplicarMatriz(matrizIdx, dezenasBase) {
  const ord = [...dezenasBase].sort((a, b) => a - b);
  return matrizIdx.map(linha => linha.map(i => ord[i - 1]).sort((a, b) => a - b));
}

/** Lista as matrizes disponíveis para uma dada base K */
export function matrizesPara(coverings, K) {
  return Object.values(coverings || {})
    .filter(m => m.K === K)
    .sort((a, b) => b.g - a.g); // garantia maior primeiro
}

/* ============================================================
   FIXAS & ROTATIVAS
   Estratégia popular: usuário fixa N dezenas que "acredita" que
   vão sair (aparecem em TODOS os jogos), e escolhe um pool de M
   rotativas. Gera todas as C(M, 15-N) combinações.
   Ex: 12 fixas + 6 rotativas → C(6, 3) = 20 jogos, R$ 70.
   ============================================================ */

/** Gera todos os jogos possíveis com N fixas + rotação pelo resto */
export function gerarFixasRotativas(fixas, rotativas) {
  const nFixas = fixas.length;
  const restam = LOTOFACIL.numerosPorJogo - nFixas;
  if (restam < 0) throw new Error(`fixas > ${LOTOFACIL.numerosPorJogo}`);
  if (restam > rotativas.length) throw new Error(`rotativas insuficientes (${rotativas.length}, precisa ${restam})`);
  if (restam === 0) return [[...fixas].sort((a, b) => a - b)];

  // Enumera todas as C(rotativas, restam) combinações
  const jogos = [];
  const idx = Array.from({ length: restam }, (_, i) => i);
  while (true) {
    const escolhidas = idx.map(i => rotativas[i]);
    jogos.push([...fixas, ...escolhidas].sort((a, b) => a - b));
    let i = restam - 1;
    while (i >= 0 && idx[i] === rotativas.length - restam + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < restam; j++) idx[j] = idx[j - 1] + 1;
  }
  return jogos;
}

/** Resumo custo/jogos pra Fixas & Rotativas */
export function resumoFixasRotativas(nFixas, nRotativas) {
  const restam = LOTOFACIL.numerosPorJogo - nFixas;
  const apostas = restam >= 0 && restam <= nRotativas
    ? combinacoes(nRotativas, restam)
    : 0;
  return {
    fixas: nFixas,
    rotativas: nRotativas,
    apostas,
    custo: +(apostas * LOTOFACIL.precoAposta).toFixed(2),
    valido: nFixas + nRotativas >= LOTOFACIL.numerosPorJogo && nFixas <= LOTOFACIL.numerosPorJogo,
  };
}
