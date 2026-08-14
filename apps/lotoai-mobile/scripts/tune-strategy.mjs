#!/usr/bin/env node
/* ============================================================
   TUNE STRATEGY · o "Guru IA"
   ─────────────────────────────────────────────────────────────
   Rodado automaticamente após cada import de concursos.
   Para cada estratégia individual:
     1. Backtesta sobre os últimos N concursos (janela deslizante)
     2. Gera 5 jogos por concurso, conta acertos ≥ 11 e prêmio estimado
     3. Calcula score = P(prêmio 11+) × premio_medio
   Depois:
     - Regulariza (softmax com temperatura) pra evitar overfitting
     - Salva pesos ajustados + insight narrativo em public/tuning.json
   ============================================================ */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gerarJogos } from "../src/lib/generator.js";
import { contarAcertos } from "../src/lib/lotofacil.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONCURSOS_JSON = path.join(ROOT, "public", "concursos.json");
const OUT_JSON = path.join(ROOT, "public", "tuning.json");
const OUT_DATA = path.join(ROOT, "data", "tuning.json");

const ESTRATEGIAS = [
  "zonas", "cinco5", "ciclo", "balanceado", "bayesiano", "ponderado",
];

const JANELA_BACKTEST = 100; // últimos N concursos
const JOGOS_POR_CONCURSO = 5;
const PREMIO_MEDIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 };

/* ---------- carregar histórico ---------- */

if (!existsSync(CONCURSOS_JSON)) {
  console.error("[tune] concursos.json não encontrado em", CONCURSOS_JSON);
  process.exit(1);
}
const concursos = JSON.parse(readFileSync(CONCURSOS_JSON, "utf-8"));
console.log(`[tune] ${concursos.length} concursos carregados`);
if (concursos.length < JANELA_BACKTEST + 50) {
  console.error(`[tune] histórico insuficiente (< ${JANELA_BACKTEST + 50})`);
  process.exit(1);
}

/* ---------- backtest por estratégia ---------- */

const sorteios = concursos.map(c => c.dezenas);
const inicio = sorteios.length - JANELA_BACKTEST;

console.log(`\n[tune] janela: últimos ${JANELA_BACKTEST} concursos (${inicio} até ${sorteios.length - 1})\n`);

const stats = {};
for (const estrategia of ESTRATEGIAS) {
  const t0 = Date.now();
  let totalApostas = 0;
  let acertos11plus = 0;
  const dist = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
  let premio = 0;
  let somaAcertos = 0;

  for (let i = inicio; i < sorteios.length; i++) {
    const histAte = sorteios.slice(0, i);
    let jogos;
    try {
      jogos = gerarJogos({
        quantidade: JOGOS_POR_CONCURSO,
        estrategia,
        historico: histAte,
      });
    } catch { continue; }
    for (const j of jogos) {
      totalApostas++;
      const acertos = contarAcertos(j, sorteios[i]);
      somaAcertos += acertos;
      if (acertos >= 11) {
        acertos11plus++;
        if (acertos in dist) {
          dist[acertos]++;
          premio += PREMIO_MEDIO[acertos];
        }
      }
    }
  }
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const pctPremio = totalApostas ? acertos11plus / totalApostas : 0;
  const acertosMedio = totalApostas ? somaAcertos / totalApostas : 0;
  stats[estrategia] = {
    totalApostas,
    acertos11plus,
    pctPremio,
    acertosMedio: +acertosMedio.toFixed(3),
    dist,
    premioEstimado: +premio.toFixed(2),
    dt,
  };
  console.log(`  ${estrategia.padEnd(12)} · ${(pctPremio * 100).toFixed(2)}% premiadas · média ${acertosMedio.toFixed(2)} acertos · ${dt}s`);
}

/* ---------- ajustar pesos (softmax regularizado) ---------- */

const temperatura = 0.05; // pequeno → mais peso pra melhor, maior → mais uniforme
const scoreBase = Object.fromEntries(
  Object.entries(stats).map(([k, s]) => [k, s.pctPremio])
);
const maxScore = Math.max(...Object.values(scoreBase), 0.001);
const expScores = Object.fromEntries(
  Object.entries(scoreBase).map(([k, s]) => [k, Math.exp((s - maxScore) / temperatura)])
);
const somaExp = Object.values(expScores).reduce((a, b) => a + b, 0);
const pesos = Object.fromEntries(
  Object.entries(expScores).map(([k, v]) => [k, +(v / somaExp).toFixed(4)])
);

// Regularização: floor de 5% pra cada estratégia (sempre exposição mínima)
const FLOOR = 0.05;
let totalAjuste = 0;
for (const k of Object.keys(pesos)) {
  if (pesos[k] < FLOOR) {
    totalAjuste += FLOOR - pesos[k];
    pesos[k] = FLOOR;
  }
}
// remove o ajuste dos maiores proporcionalmente
if (totalAjuste > 0) {
  const acimaFloor = Object.entries(pesos).filter(([_, v]) => v > FLOOR);
  const somaAcima = acimaFloor.reduce((a, [_, v]) => a + v, 0);
  for (const [k] of acimaFloor) {
    pesos[k] = +(pesos[k] - (pesos[k] / somaAcima) * totalAjuste).toFixed(4);
  }
}

/* ---------- gerar insight narrativo ---------- */

const ranking = Object.entries(stats)
  .sort((a, b) => b[1].pctPremio - a[1].pctPremio);
const [melhor, ...resto] = ranking;
const pior = ranking[ranking.length - 1];

// detecta padrões
const ultimo = concursos[concursos.length - 1];
const NUM = 25;
const freqRecent = Object.fromEntries(Array.from({ length: NUM }, (_, i) => [i + 1, 0]));
for (const s of sorteios.slice(-30)) for (const n of s) freqRecent[n]++;
const quentes30 = Object.entries(freqRecent).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => +n);
const frias30 = Object.entries(freqRecent).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([n]) => +n);

// atrasos
const atrasos = Object.fromEntries(Array.from({ length: NUM }, (_, i) => [i + 1, sorteios.length]));
for (let i = sorteios.length - 1, k = 0; i >= 0; i--, k++) {
  for (const n of sorteios[i]) if (atrasos[n] === sorteios.length) atrasos[n] = k;
}
const maisAtrasadas = Object.entries(atrasos).sort((a, b) => b[1] - a[1]).slice(0, 5);

const insight = {
  cabecalho: `Análise sobre ${JANELA_BACKTEST} concursos (até #${ultimo.numero})`,
  paragrafos: [
    `Nos últimos ${JANELA_BACKTEST} concursos, a estratégia **${nomeAmigavel(melhor[0])}** teve o melhor desempenho: ${(melhor[1].pctPremio * 100).toFixed(2)}% das apostas premiadas (≥11 pts), média de ${melhor[1].acertosMedio.toFixed(2)} acertos por jogo. Recebeu peso ${(pesos[melhor[0]] * 100).toFixed(0)}% no Combo IA.`,
    `A menos performática foi **${nomeAmigavel(pior[0])}** (${(pior[1].pctPremio * 100).toFixed(2)}%), mas mantida com peso mínimo ${(FLOOR * 100).toFixed(0)}% pra diversificação.`,
    `Dezenas quentes nos últimos 30: ${quentes30.map(pad2).join(", ")}. Frias: ${frias30.map(pad2).join(", ")}.`,
    `Dezenas mais atrasadas: ${maisAtrasadas.map(([n, a]) => `${pad2(+n)}(${a}c)`).join(", ")}.`,
  ],
};

/* ---------- salvar output ---------- */

const output = {
  atualizadoEm: new Date().toISOString(),
  ultimoConcurso: ultimo.numero,
  totalConcursos: concursos.length,
  janelaBacktest: JANELA_BACKTEST,
  jogosPorConcurso: JOGOS_POR_CONCURSO,
  pesos,
  estatisticas: stats,
  ranking: ranking.map(([k, s]) => ({
    estrategia: k,
    nome: nomeAmigavel(k),
    pctPremio: +(s.pctPremio * 100).toFixed(2),
    acertosMedio: s.acertosMedio,
    peso: pesos[k],
  })),
  insight,
  contexto: {
    quentes30,
    frias30,
    maisAtrasadas: maisAtrasadas.map(([n, a]) => ({ dezena: +n, atraso: a })),
  },
};

writeFileSync(OUT_JSON, JSON.stringify(output, null, 2));
writeFileSync(OUT_DATA, JSON.stringify(output, null, 2));

console.log(`\n[tune] pesos ajustados:`);
for (const r of output.ranking) {
  const bar = "█".repeat(Math.round(r.peso * 40));
  console.log(`  ${r.nome.padEnd(18)} ${(r.peso * 100).toFixed(0).padStart(3)}% ${bar}`);
}

console.log(`\n[tune] insight:`);
console.log(`  ${insight.cabecalho}`);
for (const p of insight.paragrafos) console.log(`  · ${p.replace(/\*\*/g, "")}`);

console.log(`\n[tune] ✓ salvo em public/tuning.json + data/tuning.json`);

function nomeAmigavel(id) {
  return {
    zonas: "Zonas + Primos",
    cinco5: "5×5 Balanceada",
    ciclo: "Ciclo Atrasado",
    balanceado: "Balanceada",
    bayesiano: "Bayesiana",
    ponderado: "IA Ponderada",
  }[id] || id;
}
function pad2(n) { return String(n).padStart(2, "0"); }
