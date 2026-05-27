/* ============================================================
   COVERINGS · matrizes reduzidas com garantia matemática
   ─────────────────────────────────────────────────────────────
   Dado K dezenas-base (15 ≤ K ≤ 20), queremos um conjunto pequeno
   de apostas de 15 das K tal que SE g das suas K dezenas saírem
   no sorteio, ALGUMA aposta acerta pelo menos g pontos.

   Condição SUFICIENTE: todo subconjunto de tamanho g das K
   está contido em pelo menos uma aposta. (Se sair um conjunto
   T de tamanho ≥ g das suas K, qualquer subconjunto de g dele
   está em algum bloco → bloco tem ≥ g acertos.)

   Algoritmo: greedy set-cover. Em cada passo escolhe a aposta
   que cobre o máximo de g-subconjuntos ainda não cobertos.
   Verificação final garante que TODA cobertura foi feita.
   ============================================================ */

import { LOTOFACIL, combinacoes } from "./lotofacil.js";

/* ---------- combinatória ---------- */

/** gera todas as combinações de k elementos a partir do array `arr` */
export function combinacoesDe(arr, k) {
  const out = [];
  const n = arr.length;
  if (k > n) return out;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    out.push(idx.map(i => arr[i]));
    let i = k - 1;
    while (i >= 0 && idx[i] === n - k + i) i--;
    if (i < 0) break;
    idx[i]++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1] + 1;
  }
  return out;
}

/** chave canônica para um subconjunto (ordenado, separador "-") */
const keyOf = (arr) => [...arr].sort((a, b) => a - b).join("-");

/* ---------- greedy set-cover ---------- */

/**
 * Constrói um covering C(K, 15, g) por greedy.
 * @param {number[]} base       array de K dezenas (15 ≤ K ≤ 20)
 * @param {number} g            tamanho do subconjunto a cobrir (g ≤ 15)
 * @param {object} opts
 * @param {number} opts.maxBlocos limite duro (corta antes de cobrir tudo) — útil pra UI
 * @returns {{ blocos: number[][], coberto: boolean, gapTotal: number, gapInicial: number }}
 */
export function coberturaGreedy(base, g, { maxBlocos = 200 } = {}) {
  const K = base.length;
  const blockSize = LOTOFACIL.numerosPorJogo; // 15
  if (g > blockSize) throw new Error(`g (${g}) > 15`);
  if (g > K) throw new Error(`g (${g}) > K (${K})`);

  // 1. todos os g-subconjuntos da base, indexados
  const gSubs = combinacoesDe(base, g);
  const idxOf = new Map();
  gSubs.forEach((s, i) => idxOf.set(keyOf(s), i));
  const gapInicial = gSubs.length;

  // 2. todos os blocos candidatos (15-subconjuntos da base) e os g-subs que cada um cobre
  const candidatos = combinacoesDe(base, blockSize);
  const cobertosPor = candidatos.map(b => combinacoesDe(b, g).map(s => idxOf.get(keyOf(s))));

  // 3. greedy
  const cobertos = new Uint8Array(gSubs.length);
  const usados = new Uint8Array(candidatos.length);
  const blocos = [];
  let cobertosCount = 0;

  while (cobertosCount < gSubs.length && blocos.length < maxBlocos) {
    let best = -1;
    let bestGain = 0;
    for (let i = 0; i < candidatos.length; i++) {
      if (usados[i]) continue;
      let gain = 0;
      for (const j of cobertosPor[i]) if (!cobertos[j]) gain++;
      if (gain > bestGain) { bestGain = gain; best = i; }
    }
    if (best < 0 || bestGain === 0) break;
    usados[best] = 1;
    for (const j of cobertosPor[best]) {
      if (!cobertos[j]) { cobertos[j] = 1; cobertosCount++; }
    }
    blocos.push([...candidatos[best]].sort((a, b) => a - b));
  }

  const gapTotal = gSubs.length - cobertosCount;
  return { blocos, coberto: gapTotal === 0, gapTotal, gapInicial };
}

/**
 * Verifica explicitamente a garantia:
 * para todo subconjunto de tamanho g de `base`, retorna o bloco que o contém
 * (ou null se nenhum contém — quebra da garantia).
 */
export function verificarGarantia(base, g, blocos) {
  const gSubs = combinacoesDe(base, g);
  let cobertosCount = 0;
  const naoCobertos = [];
  for (const s of gSubs) {
    const setS = new Set(s);
    const ok = blocos.some(b => {
      let cnt = 0;
      for (const x of b) if (setS.has(x)) cnt++;
      return cnt === g;
    });
    if (ok) cobertosCount++;
    else naoCobertos.push(s);
  }
  return {
    total: gSubs.length,
    cobertos: cobertosCount,
    garantido: naoCobertos.length === 0,
    naoCobertos: naoCobertos.slice(0, 5), // amostra
  };
}

/**
 * Probabilidade empírica (por enumeração) de o usuário ter ≥ g pontos
 * quando exatamente T das K dezenas-base saírem. Útil para mostrar
 * "garantia parcial" quando a matriz é menor que o necessário.
 */
export function probabilidadeAcerto(base, blocos, T, g) {
  const alvos = combinacoesDe(base, T);
  let ok = 0;
  for (const alvo of alvos) {
    const setA = new Set(alvo);
    const sucesso = blocos.some(b => {
      let cnt = 0;
      for (const x of b) if (setA.has(x)) cnt++;
      return cnt >= g;
    });
    if (sucesso) ok++;
  }
  return { total: alvos.length, ok, p: alvos.length ? ok / alvos.length : 0 };
}

/* ---------- Materializa uma matriz pré-calculada com índices [1..K] ---------- */

/**
 * Aplica uma matriz salva (índices 1..K) sobre suas dezenas-base reais.
 * Ex: matriz [[1,2,...15]] + base [3,7,9,...] → [[3,7,9,...]]
 */
export function aplicarMatriz(matrizIdx, dezenasBase) {
  const ord = [...dezenasBase].sort((a, b) => a - b);
  return matrizIdx.map(linha => linha.map(i => ord[i - 1]).sort((a, b) => a - b));
}
