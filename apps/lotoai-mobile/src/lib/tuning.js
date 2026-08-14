/* ============================================================
   TUNING · leitura + recompute client-side dos pesos do Guru IA
   ─────────────────────────────────────────────────────────────
   Estratégia dupla:
   - loadTuning(): puxa public/tuning.json (baseline pré-calculado no CI)
   - recomputarTuningLocal(historico): re-avalia estratégias sobre o
     histórico ATUAL do usuário (que pode estar mais novo que o CI).
     Roda no cliente em ~1-2s, atualiza localStorage.
   ============================================================ */

import { gerarJogos } from "./generator.js";
import { contarAcertos } from "./lotofacil.js";

const KEY_LOCAL = "lotoai:tuning-local";
const ESTRATEGIAS = ["zonas", "cinco5", "ciclo", "balanceado", "bayesiano", "ponderado"];
const NOME = {
  zonas: "Zonas + Primos",
  cinco5: "5×5 Balanceada",
  ciclo: "Ciclo Atrasado",
  balanceado: "Balanceada",
  bayesiano: "Bayesiana",
  ponderado: "IA Ponderada",
};
const PREMIO_MEDIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 };

let _cache = null;

/**
 * Carrega tuning:
 * 1. Se há tuning local mais recente que o do bundle, usa esse (o usuário
 *    já atualizou o histórico e re-tunou).
 * 2. Senão, carrega public/tuning.json (baseline do CI).
 */
export async function loadTuning() {
  if (_cache !== null) return _cache;

  // Tenta local
  try {
    const local = JSON.parse(localStorage.getItem(KEY_LOCAL) || "null");
    if (local && local.ultimoConcurso) {
      _cache = local;
      // Ainda tenta baseline pra comparar por segurança
      try {
        const res = await fetch("./tuning.json", { cache: "no-cache" });
        if (res.ok) {
          const remote = await res.json();
          if (remote.ultimoConcurso > local.ultimoConcurso) {
            _cache = remote;
          }
        }
      } catch {}
      return _cache;
    }
  } catch {}

  // Fallback: baseline
  try {
    const res = await fetch("./tuning.json", { cache: "no-cache" });
    if (res.ok) {
      _cache = await res.json();
      return _cache;
    }
  } catch {}

  _cache = null;
  return null;
}

/** Força recarregar do disco (usado após um recompute) */
export function invalidarCacheTuning() {
  _cache = null;
}

/**
 * Recomputa o tuning sobre o histórico local. Roda 6 estratégias ×
 * `janela` concursos × 5 jogos, num total ~3000 apostas — leva ~1-2s
 * em celular moderno. Salva em localStorage e retorna o resultado.
 *
 * Progresso opcional via onProgresso({estrategia, i, total}).
 */
export async function recomputarTuningLocal(historico, { janela = 100, jogosPorConcurso = 5, onProgresso } = {}) {
  if (!historico?.length || historico.length < janela + 20) return null;

  const sorteios = historico.map(c => c.dezenas);
  const inicio = sorteios.length - janela;
  const ultimo = historico[historico.length - 1];

  const stats = {};
  for (let idx = 0; idx < ESTRATEGIAS.length; idx++) {
    const estrategia = ESTRATEGIAS[idx];
    onProgresso?.({ estrategia, i: idx, total: ESTRATEGIAS.length, nome: NOME[estrategia] });

    let totalApostas = 0;
    let acertos11plus = 0;
    let somaAcertos = 0;
    const dist = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
    let premio = 0;

    for (let i = inicio; i < sorteios.length; i++) {
      const histAte = sorteios.slice(0, i);
      let jogos;
      try {
        jogos = gerarJogos({ quantidade: jogosPorConcurso, estrategia, historico: histAte });
      } catch { continue; }
      for (const j of jogos) {
        totalApostas++;
        const acertos = contarAcertos(j, sorteios[i]);
        somaAcertos += acertos;
        if (acertos >= 11) {
          acertos11plus++;
          if (acertos in dist) { dist[acertos]++; premio += PREMIO_MEDIO[acertos]; }
        }
      }
      // pequena pausa a cada 20 concursos pra não travar UI
      if ((i - inicio) % 20 === 0) await new Promise(r => setTimeout(r, 0));
    }
    const pctPremio = totalApostas ? acertos11plus / totalApostas : 0;
    const acertosMedio = totalApostas ? somaAcertos / totalApostas : 0;
    stats[estrategia] = {
      totalApostas, acertos11plus,
      pctPremio, acertosMedio: +acertosMedio.toFixed(3),
      dist, premioEstimado: +premio.toFixed(2),
    };
  }

  // Softmax regularizado
  const T = 0.05;
  const scoresBase = Object.fromEntries(Object.entries(stats).map(([k, s]) => [k, s.pctPremio]));
  const maxS = Math.max(...Object.values(scoresBase), 0.001);
  const expS = Object.fromEntries(Object.entries(scoresBase).map(([k, s]) => [k, Math.exp((s - maxS) / T)]));
  const soma = Object.values(expS).reduce((a, b) => a + b, 0) || 1;
  const pesos = Object.fromEntries(Object.entries(expS).map(([k, v]) => [k, +(v / soma).toFixed(4)]));
  // Floor 5%
  const FLOOR = 0.05;
  let ajuste = 0;
  for (const k of Object.keys(pesos)) if (pesos[k] < FLOOR) { ajuste += FLOOR - pesos[k]; pesos[k] = FLOOR; }
  if (ajuste > 0) {
    const acima = Object.entries(pesos).filter(([_, v]) => v > FLOOR);
    const somaAcima = acima.reduce((a, [_, v]) => a + v, 0);
    for (const [k] of acima) pesos[k] = +(pesos[k] - (pesos[k] / somaAcima) * ajuste).toFixed(4);
  }

  const ranking = Object.entries(stats)
    .sort((a, b) => b[1].pctPremio - a[1].pctPremio)
    .map(([k, s]) => ({
      estrategia: k,
      nome: NOME[k],
      pctPremio: +(s.pctPremio * 100).toFixed(2),
      acertosMedio: s.acertosMedio,
      peso: pesos[k],
    }));

  // Contexto: quentes/frias últimos 30
  const NUM = 25;
  const fr = Object.fromEntries(Array.from({ length: NUM }, (_, i) => [i + 1, 0]));
  for (const s of sorteios.slice(-30)) for (const n of s) fr[n]++;
  const quentes30 = Object.entries(fr).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => +n);
  const frias30 = Object.entries(fr).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([n]) => +n);
  const atrasos = Object.fromEntries(Array.from({ length: NUM }, (_, i) => [i + 1, sorteios.length]));
  for (let i = sorteios.length - 1, k = 0; i >= 0; i--, k++) {
    for (const n of sorteios[i]) if (atrasos[n] === sorteios.length) atrasos[n] = k;
  }
  const maisAtrasadas = Object.entries(atrasos).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([n, a]) => ({ dezena: +n, atraso: a }));

  const melhor = ranking[0];
  const pior = ranking[ranking.length - 1];
  const insight = {
    cabecalho: `Análise sobre ${janela} concursos (até #${ultimo.numero})`,
    paragrafos: [
      `Nos últimos ${janela} concursos, **${melhor.nome}** teve o melhor desempenho: ${melhor.pctPremio}% das apostas premiadas (≥11 pts), média de ${melhor.acertosMedio.toFixed(2)} acertos por jogo. Recebeu peso ${Math.round(melhor.peso * 100)}% no Combo IA.`,
      `A menos performática foi **${pior.nome}** (${pior.pctPremio}%), mas mantida com peso mínimo ${Math.round(FLOOR * 100)}% pra diversificação.`,
      `Dezenas quentes nos últimos 30: ${quentes30.map(pad2).join(", ")}. Frias: ${frias30.map(pad2).join(", ")}.`,
      `Mais atrasadas: ${maisAtrasadas.map(m => `${pad2(m.dezena)}(${m.atraso}c)`).join(", ")}.`,
    ],
  };

  const output = {
    atualizadoEm: new Date().toISOString(),
    ultimoConcurso: ultimo.numero,
    totalConcursos: historico.length,
    janelaBacktest: janela,
    jogosPorConcurso,
    origem: "client-local",
    pesos, estatisticas: stats, ranking, insight,
    contexto: { quentes30, frias30, maisAtrasadas },
  };

  localStorage.setItem(KEY_LOCAL, JSON.stringify(output));
  _cache = output;
  return output;
}

export function pesosAjustados(tuning) { return tuning?.pesos || null; }
export function insightAtual(tuning) { return tuning?.insight || null; }

function pad2(n) { return String(n).padStart(2, "0"); }
