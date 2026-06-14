/* ============================================================
   Gerador de jogos · estratégias
   - aleatorio:    distribuição uniforme
   - ponderado:    amostragem ponderada por score (freq + atraso)
   - balanceado:   força faixa de pares e soma típica
   - bayesiano:    usa scoring Bayesiano (prior Beta + posterior)
   - estratificado: gera N jogos em estratos disjuntos do espaço amostral
                   para maximizar diversidade e cobertura. Não aumenta
                   P(prêmio em um jogo isolado) mas aumenta P(prêmio em
                   ALGUM jogo) quando se gera vários.
   ============================================================ */

import { NUMEROS, LOTOFACIL, validarJogo, analisarJogo } from "./lotofacil.js";
import { scores as calcScores } from "./stats.js";

function sampleSemReposicao(weights, k) {
  const pool = Object.entries(weights).map(([n, w]) => ({ n: +n, w }));
  const out = [];
  for (let i = 0; i < k && pool.length; i++) {
    const total = pool.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length; idx++) {
      r -= pool[idx].w;
      if (r <= 0) break;
    }
    if (idx >= pool.length) idx = pool.length - 1;
    out.push(pool[idx].n);
    pool.splice(idx, 1);
  }
  return out.sort((a, b) => a - b);
}

function gerarAleatorio() {
  const w = Object.fromEntries(NUMEROS.map(n => [n, 1]));
  return sampleSemReposicao(w, LOTOFACIL.numerosPorJogo);
}

function gerarPonderado(historico, opts = {}) {
  const s = calcScores(historico, opts);
  return sampleSemReposicao(s, LOTOFACIL.numerosPorJogo);
}

function gerarBayesiano(historico) {
  return gerarPonderado(historico, { bayesian: true, janela: historico.length });
}

function gerarBalanceado(historico, { paresAlvo = [7, 8] } = {}) {
  // Tenta até 200 vezes até cair dentro dos pares-alvo
  for (let tentativa = 0; tentativa < 200; tentativa++) {
    const candidato = historico.length ? gerarPonderado(historico) : gerarAleatorio();
    const { pares } = analisarJogo(candidato);
    if (paresAlvo.includes(pares)) return candidato;
  }
  return gerarPonderado(historico);
}

/**
 * Estratégia "Zonas": divide o volante em dois quadrantes (1-15 e 16-25)
 * e escolhe um número fixo de dezenas em cada, priorizando primos.
 *
 * Default: 8 dezenas de 1-15 + 7 dezenas de 16-25 (= 15 total).
 *
 * Primos por quadrante:
 *   1-15:  2, 3, 5, 7, 11, 13   (6 primos)
 *   16-25: 17, 19, 23            (3 primos)
 *
 * Algoritmo:
 *   1. Para cada quadrante, separa primos e não-primos
 *   2. Pega TODOS os primos do quadrante (até o limite)
 *   3. Completa com não-primos ponderados pelo score (freq+atraso)
 */
function gerarPorZonas(historico, { de1a15 = 8, de16a25 = 7 } = {}) {
  if (de1a15 + de16a25 !== LOTOFACIL.numerosPorJogo) {
    throw new Error(`Soma das zonas deve ser ${LOTOFACIL.numerosPorJogo}, recebeu ${de1a15 + de16a25}`);
  }
  const PRIMOS = new Set([2, 3, 5, 7, 11, 13, 17, 19, 23]);
  const quadrantes = [
    { range: NUMEROS.filter(n => n <= 15), quantos: de1a15 },
    { range: NUMEROS.filter(n => n >= 16), quantos: de16a25 },
  ];
  const s = historico.length ? calcScores(historico) : Object.fromEntries(NUMEROS.map(n => [n, 1]));

  const out = [];
  for (const q of quadrantes) {
    const primos = q.range.filter(n => PRIMOS.has(n));
    const naoPrimos = q.range.filter(n => !PRIMOS.has(n));

    // pega TODOS os primos do quadrante (até `quantos`)
    const escolhidos = primos.slice(0, q.quantos);
    const faltam = q.quantos - escolhidos.length;
    if (faltam > 0) {
      // completa com não-primos ponderados
      const pesos = Object.fromEntries(naoPrimos.map(n => [n, s[n] || 0.01]));
      const extras = sampleSemReposicao(pesos, faltam);
      escolhidos.push(...extras);
    }
    out.push(...escolhidos);
  }
  return out.sort((a, b) => a - b);
}

/**
 * Gera N jogos estratificados: cada jogo tenta cair num "estrato" diferente
 * do espaço amostral (combinação de faixa de pares + faixa de soma). Isso
 * maximiza a probabilidade de ALGUM jogo ganhar prêmio dado um número fixo
 * de jogos, em vez de fazer N amostras independentes que tendem a colidir
 * na mesma região central do espaço.
 *
 * NÃO aumenta P(prêmio numa aposta isolada). AUMENTA P(prêmio em alguma
 * aposta do conjunto). Tradeoff: jogos individuais podem cair em regiões
 * estatisticamente "ruins" pra cobrir os estratos.
 */
function gerarConjuntoEstratificado(quantidade, historico, opts = {}) {
  // estratos: 4 faixas de pares × 3 faixas de soma = 12 estratos
  const faixasPares = [[5, 6], [7, 7], [8, 8], [9, 10]];
  const faixasSoma = [[150, 180], [180, 210], [210, 240]];
  const estratos = [];
  for (const fp of faixasPares) for (const fs of faixasSoma) estratos.push({ fp, fs });

  const jogos = [];
  for (let i = 0; i < quantidade; i++) {
    const e = estratos[i % estratos.length];
    let escolhido = null;
    for (let t = 0; t < 80; t++) {
      const candidato = historico.length ? gerarPonderado(historico, opts) : gerarAleatorio();
      const a = analisarJogo(candidato);
      if (a.pares >= e.fp[0] && a.pares <= e.fp[1] &&
          a.soma >= e.fs[0] && a.soma <= e.fs[1]) {
        escolhido = candidato;
        break;
      }
      if (!escolhido) escolhido = candidato;
    }
    jogos.push(escolhido);
  }
  return jogos;
}

/**
 * Gera N jogos segundo a estratégia escolhida.
 * @param {object} opts
 * @param {number} opts.quantidade
 * @param {"aleatorio"|"ponderado"|"balanceado"|"bayesiano"|"estratificado"} opts.estrategia
 * @param {number[][]} opts.historico
 * @param {number[]} [opts.fixos]    dezenas que devem aparecer em todos os jogos
 * @param {number[]} [opts.excluir]  dezenas que nunca devem aparecer
 */
export function gerarJogos({ quantidade = 1, estrategia = "ponderado", historico = [], fixos = [], excluir = [] } = {}) {
  // Estratificado precisa gerar o conjunto inteiro de uma vez (coordena estratos)
  if (estrategia === "estratificado" && historico.length) {
    const conjunto = gerarConjuntoEstratificado(quantidade, historico);
    return conjunto.map(j => aplicarFixosExcluir(j, fixos, excluir, historico, estrategia))
                   .filter(validarJogo);
  }

  const jogos = [];
  for (let i = 0; i < quantidade; i++) {
    let jogo;
    let tentativas = 0;
    do {
      jogo = pickStrategy(estrategia, historico);
      jogo = aplicarFixosExcluir(jogo, fixos, excluir, historico, estrategia);
      tentativas++;
    } while (!validarJogo(jogo) && tentativas < 50);
    jogos.push(jogo);
  }
  return jogos;
}

function pickStrategy(estrategia, historico) {
  if (estrategia === "aleatorio") return gerarAleatorio();
  if (estrategia === "balanceado") return gerarBalanceado(historico);
  if (estrategia === "bayesiano") return historico.length ? gerarBayesiano(historico) : gerarAleatorio();
  if (estrategia === "zonas") return gerarPorZonas(historico);
  return historico.length ? gerarPonderado(historico) : gerarAleatorio();
}

function aplicarFixosExcluir(jogo, fixos, excluir, historico, estrategia) {
  const fixosSet = new Set(fixos);
  const exclSet = new Set(excluir);

  // Remove excluídos e completa com novos
  let base = jogo.filter(n => !exclSet.has(n));

  // Garante fixos
  for (const f of fixosSet) if (!base.includes(f)) base.push(f);

  // Se sobrou, corta os de menor score
  if (base.length > LOTOFACIL.numerosPorJogo) {
    const s = historico.length ? calcScores(historico) : Object.fromEntries(NUMEROS.map(n => [n, 1]));
    base.sort((a, b) => {
      if (fixosSet.has(a) && !fixosSet.has(b)) return -1;
      if (!fixosSet.has(a) && fixosSet.has(b)) return 1;
      return (s[b] || 0) - (s[a] || 0);
    });
    base = base.slice(0, LOTOFACIL.numerosPorJogo);
  }

  // Se faltou, completa com pool ponderado
  while (base.length < LOTOFACIL.numerosPorJogo) {
    const usados = new Set(base);
    const pool = NUMEROS.filter(n => !usados.has(n) && !exclSet.has(n));
    if (!pool.length) break;
    const s = historico.length ? calcScores(historico) : Object.fromEntries(pool.map(n => [n, 1]));
    const weights = Object.fromEntries(pool.map(n => [n, s[n] || 0.01]));
    const [pick] = sampleSemReposicao(weights, 1);
    base.push(pick);
  }

  return base.sort((a, b) => a - b);
}
