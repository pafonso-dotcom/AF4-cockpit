/* ============================================================
   ANÁLISE AVANÇADA · Lotofácil
   ─────────────────────────────────────────────────────────────
   Ferramentas usadas por apostadores/canais especializados:
   - Linhas e colunas do volante (grid 5×5)
   - Ciclos de dezenas (quando todas as 25 saem)
   - Ranking móvel duplo (janela recente + histórico global)
   - Detecção de sequências consecutivas
   - Repetições do concurso anterior
   ============================================================ */

import { NUMEROS, LOTOFACIL } from "./lotofacil.js";

/* ---------- LINHAS E COLUNAS DO VOLANTE (grid 5×5) ---------- */

// Linhas: horizontal, 5 grupos de 5
//   L1: 1-5     L2: 6-10   L3: 11-15   L4: 16-20   L5: 21-25
export const LINHAS = [
  [1, 2, 3, 4, 5],
  [6, 7, 8, 9, 10],
  [11, 12, 13, 14, 15],
  [16, 17, 18, 19, 20],
  [21, 22, 23, 24, 25],
];

// Colunas: vertical (leitura como no volante impresso)
//   C1: 1,6,11,16,21   C2: 2,7,12,17,22   ...   C5: 5,10,15,20,25
export const COLUNAS = [
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
  [5, 10, 15, 20, 25],
];

/** Quantas dezenas do jogo caem em cada linha */
export function distPorLinha(jogo) {
  return LINHAS.map(linha => jogo.filter(n => linha.includes(n)).length);
}

/** Quantas dezenas do jogo caem em cada coluna */
export function distPorColuna(jogo) {
  return COLUNAS.map(col => jogo.filter(n => col.includes(n)).length);
}

/** Jogo é "5×5 balanceado" quando cada linha tem entre 2 e 4 dezenas */
export function eBalanceado5x5(jogo, { min = 2, max = 4 } = {}) {
  const dist = distPorLinha(jogo);
  return dist.every(d => d >= min && d <= max);
}

/* ---------- CICLOS DE DEZENAS ---------- */

/**
 * Um "ciclo" começa a cada concurso após todas as 25 dezenas terem sido
 * sorteadas ao menos 1 vez. Retorna:
 *   - dezenasFaltando: quais dezenas ainda não saíram no ciclo atual
 *   - concursosNoCiclo: quantos concursos desde o início do ciclo
 *   - historicoCiclos: array com o comprimento (em concursos) de cada
 *     ciclo passado (útil pra ver quanto tempo geralmente demora)
 */
export function analisarCiclos(historico) {
  if (!historico?.length) {
    return { dezenasFaltando: [...NUMEROS], concursosNoCiclo: 0, historicoCiclos: [], cicloAtual: 1 };
  }
  const ciclos = [];
  let vistas = new Set();
  let inicio = 0;
  let cicloAtual = 1;
  for (let i = 0; i < historico.length; i++) {
    for (const n of historico[i]) vistas.add(n);
    if (vistas.size === LOTOFACIL.totalNumeros) {
      ciclos.push({ inicio, fim: i, tamanho: i - inicio + 1 });
      vistas = new Set();
      inicio = i + 1;
      cicloAtual++;
    }
  }
  return {
    dezenasFaltando: NUMEROS.filter(n => !vistas.has(n)),
    concursosNoCiclo: historico.length - inicio,
    historicoCiclos: ciclos,
    cicloAtual,
    tamanhoMedio: ciclos.length
      ? ciclos.reduce((a, c) => a + c.tamanho, 0) / ciclos.length
      : null,
  };
}

/* ---------- RANKING MÓVEL DUPLO ---------- */

/**
 * Combina frequência recente (janela curta) + histórico global,
 * ponderando. Detecta tendências emergentes sem ignorar o macro.
 *
 * Score(n) = pesoJanela × freqNormalizada(n, janela) +
 *            pesoGlobal × freqNormalizada(n, tudo)
 */
export function rankingMovelDuplo(historico, { janela = 20, pesoJanela = 0.5, pesoGlobal = 0.5 } = {}) {
  const contarFreq = (lista) => {
    const f = Object.fromEntries(NUMEROS.map(n => [n, 0]));
    for (const s of lista) for (const n of s) f[n]++;
    return f;
  };
  const normalizar = (f) => {
    const max = Math.max(...Object.values(f), 1);
    const out = {};
    for (const n of NUMEROS) out[n] = f[n] / max;
    return out;
  };
  const recente = historico.slice(-janela);
  const nRec = normalizar(contarFreq(recente));
  const nGlob = normalizar(contarFreq(historico));
  const out = {};
  for (const n of NUMEROS) {
    out[n] = pesoJanela * nRec[n] + pesoGlobal * nGlob[n];
  }
  return out;
}

/* ---------- SEQUÊNCIAS CONSECUTIVAS ---------- */

/** Retorna comprimento da maior sequência consecutiva no jogo */
export function maiorSequencia(jogo) {
  const s = [...jogo].sort((a, b) => a - b);
  let melhor = 1, atual = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1] + 1) atual++;
    else atual = 1;
    if (atual > melhor) melhor = atual;
  }
  return melhor;
}

/** Filtro: rejeita jogos com sequências grandes (padrão: ≥ 6 consecutivas) */
export function passaFiltroSequencia(jogo, maxSeq = 5) {
  return maiorSequencia(jogo) <= maxSeq;
}

/* ---------- REPETIÇÃO DO CONCURSO ANTERIOR ---------- */

/**
 * Quantas dezenas do jogo se repetem do último sorteio. Distribuição
 * histórica na Lotofácil tem moda em 9 (32%), faixa 8-10 cobre 79%.
 */
export function dezenasRepetidas(jogo, ultimoSorteio) {
  if (!ultimoSorteio) return 0;
  const set = new Set(ultimoSorteio);
  return jogo.filter(n => set.has(n)).length;
}

/* ---------- TRINCAS DOURADAS (3-tuplas com maior lift) ---------- */

/**
 * Retorna as top N trincas de dezenas que aparecem juntas mais do que
 * seria estatisticamente esperado. Métrica: lift = P(A∩B∩C) / (P(A)·P(B)·P(C)).
 * lift > 1 → mais frequente que aleatório (associação positiva).
 *
 * Custo: O(N × 25³) ≈ ~40k operações · roda em <100ms
 */
export function topTrincas(sorteios, n = 10, { minCount = 30 } = {}) {
  const N = sorteios.length;
  if (!N) return [];

  const freq = Object.fromEntries(NUMEROS.map(x => [x, 0]));
  for (const s of sorteios) for (const x of s) freq[x]++;

  const contagem = new Map();
  for (const s of sorteios) {
    const ord = [...s].sort((a, b) => a - b);
    for (let i = 0; i < ord.length; i++) {
      for (let j = i + 1; j < ord.length; j++) {
        for (let k = j + 1; k < ord.length; k++) {
          const key = `${ord[i]}-${ord[j]}-${ord[k]}`;
          contagem.set(key, (contagem.get(key) || 0) + 1);
        }
      }
    }
  }

  const trincas = [];
  for (const [key, count] of contagem) {
    if (count < minCount) continue;
    const [a, b, c] = key.split("-").map(Number);
    const pEsperada = (freq[a] / N) * (freq[b] / N) * (freq[c] / N);
    const pReal = count / N;
    const lift = pEsperada ? pReal / pEsperada : 0;
    trincas.push({ dezenas: [a, b, c], count, pct: count / N, lift });
  }
  trincas.sort((x, y) => y.lift - x.lift);
  return trincas.slice(0, n);
}

/** Filtro: mantém jogos com N repetições do último sorteio na faixa típica */
export function passaFiltroRepeticao(jogo, ultimoSorteio, { min = 7, max = 11 } = {}) {
  if (!ultimoSorteio) return true;
  const r = dezenasRepetidas(jogo, ultimoSorteio);
  return r >= min && r <= max;
}

/* ---------- FILTRO COMBINADO (para gerador) ---------- */

/**
 * Aplica os principais filtros estatísticos ao mesmo tempo. Retorna
 * `true` se o jogo passa em todos (faixas típicas + sequência + repetição).
 */
export function passaFiltroCombinado(jogo, { ultimoSorteio, faixas } = {}) {
  const f = faixas || {
    pares:   { min: 6, max: 9 },
    soma:    { min: 170, max: 220 },
    primos:  { min: 4, max: 7 },
    moldura: { min: 8, max: 11 },
    linhas:  { min: 2, max: 4 },
    seq:     5,
    repeticao: { min: 7, max: 11 },
  };
  const pares = jogo.filter(n => n % 2 === 0).length;
  const soma = jogo.reduce((a, b) => a + b, 0);
  const primos = jogo.filter(n => [2,3,5,7,11,13,17,19,23].includes(n)).length;
  const moldura = jogo.filter(n => [1,2,3,4,5,6,10,11,15,16,20,21,22,23,24,25].includes(n)).length;

  if (f.pares && (pares < f.pares.min || pares > f.pares.max)) return false;
  if (f.soma && (soma < f.soma.min || soma > f.soma.max)) return false;
  if (f.primos && (primos < f.primos.min || primos > f.primos.max)) return false;
  if (f.moldura && (moldura < f.moldura.min || moldura > f.moldura.max)) return false;
  if (f.linhas && !eBalanceado5x5(jogo, f.linhas)) return false;
  if (f.seq && !passaFiltroSequencia(jogo, f.seq)) return false;
  if (ultimoSorteio && f.repeticao && !passaFiltroRepeticao(jogo, ultimoSorteio, f.repeticao)) return false;
  return true;
}
