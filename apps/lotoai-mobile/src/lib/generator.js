/* ============================================================
   Gerador de jogos · estratégias
   - aleatorio: distribuição uniforme
   - ponderado: amostragem ponderada por score (freq + atraso)
   - balanceado: força faixa de pares e soma típica
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

function gerarPonderado(historico) {
  const s = calcScores(historico);
  return sampleSemReposicao(s, LOTOFACIL.numerosPorJogo);
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
 * Gera N jogos segundo a estratégia escolhida.
 * @param {object} opts
 * @param {number} opts.quantidade
 * @param {"aleatorio"|"ponderado"|"balanceado"} opts.estrategia
 * @param {number[][]} opts.historico
 * @param {number[]} [opts.fixos]    dezenas que devem aparecer em todos os jogos
 * @param {number[]} [opts.excluir]  dezenas que nunca devem aparecer
 */
export function gerarJogos({ quantidade = 1, estrategia = "ponderado", historico = [], fixos = [], excluir = [] } = {}) {
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
