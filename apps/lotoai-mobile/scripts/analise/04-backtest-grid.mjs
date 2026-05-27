/* ============================================================
   04 · Backtest grid · varre combinações de pesos do gerador
        sobre o histórico real e ranqueia por ROI estimado.
   ============================================================ */

import { loadConcursos, NUMEROS, pad } from "./_load.mjs";

const concursos = loadConcursos();
const sorteios = concursos.map(c => c.dezenas);
const N = sorteios.length;

const PRECO = 3.5;
const PREMIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 };

console.log(`\n========== BACKTEST GRID · ${N} concursos ==========\n`);

/* ---------- Geração ponderada ---------- */

function freqEm(sorteios, ate, janela) {
  const f = Object.fromEntries(NUMEROS.map(n => [n, 0]));
  const lo = Math.max(0, ate - janela);
  for (let i = lo; i < ate; i++) for (const n of sorteios[i]) f[n]++;
  return f;
}

function atrasoEm(sorteios, ate) {
  const a = Object.fromEntries(NUMEROS.map(n => [n, ate]));
  for (let i = ate - 1, k = 0; i >= 0; i--, k++) {
    for (const n of sorteios[i]) if (a[n] === ate) a[n] = k;
  }
  return a;
}

function scoresEm(sorteios, ate, { wFreq, wAtraso, janela }) {
  const f = freqEm(sorteios, ate, janela);
  const a = atrasoEm(sorteios, ate);
  const maxF = Math.max(...Object.values(f), 1);
  const maxA = Math.max(...Object.values(a), 1);
  const out = {};
  for (const n of NUMEROS) out[n] = (f[n] / maxF) * wFreq + (a[n] / maxA) * wAtraso;
  return out;
}

function sampleSemReposicao(weights, k, paresAlvo) {
  // até 30 tentativas, gera jogo que cai na faixa de pares-alvo (se definida)
  for (let t = 0; t < 30; t++) {
    const pool = Object.entries(weights).map(([n, w]) => ({ n: +n, w: Math.max(w, 0.01) }));
    const out = [];
    for (let i = 0; i < k && pool.length; i++) {
      const total = pool.reduce((a, b) => a + b.w, 0);
      let r = Math.random() * total, idx = 0;
      for (; idx < pool.length; idx++) { r -= pool[idx].w; if (r <= 0) break; }
      if (idx >= pool.length) idx = pool.length - 1;
      out.push(pool[idx].n);
      pool.splice(idx, 1);
    }
    if (!paresAlvo) return out.sort((a, b) => a - b);
    const pares = out.filter(n => n % 2 === 0).length;
    if (paresAlvo.includes(pares)) return out.sort((a, b) => a - b);
  }
  return null;
}

function contarAcertos(aposta, sorteio) {
  const s = new Set(sorteio);
  let n = 0; for (const x of aposta) if (s.has(x)) n++; return n;
}

/* ---------- Backtest ---------- */

function rodarConfig({ wFreq, wAtraso, janela, paresAlvo, jogos = 1, ultimosN = 500 }) {
  const inicio = Math.max(100, N - ultimosN);
  const dist = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
  let totalApostas = 0, gasto = 0, premio = 0;

  for (let i = inicio; i < N; i++) {
    const w = scoresEm(sorteios, i, { wFreq, wAtraso, janela });
    for (let j = 0; j < jogos; j++) {
      const aposta = sampleSemReposicao(w, 15, paresAlvo);
      if (!aposta) continue;
      totalApostas++;
      gasto += PRECO;
      const a = contarAcertos(aposta, sorteios[i]);
      if (a in dist) { dist[a]++; premio += PREMIO[a]; }
    }
  }

  const concursos = N - inicio;
  return {
    concursos, totalApostas, dist,
    gasto: +gasto.toFixed(2),
    premio: +premio.toFixed(2),
    lucro: +(premio - gasto).toFixed(2),
    roi: gasto ? +((premio - gasto) / gasto * 100).toFixed(2) : 0,
    p11_15: ((dist[11] + dist[12] + dist[13] + dist[14] + dist[15]) / totalApostas * 100).toFixed(2) + "%",
  };
}

/* ---------- Grid ---------- */

const grid = [];
for (const wFreq of [0.0, 0.3, 0.5, 0.7, 1.0]) {
  for (const wAtraso of [0.0, 0.3, 0.5, 0.7, 1.0]) {
    for (const janela of [30, 100, 300]) {
      for (const paresAlvo of [null, [7, 8]]) {
        grid.push({ wFreq, wAtraso, janela, paresAlvo });
      }
    }
  }
}

console.log(`[04] testando ${grid.length} configurações em ${500} concursos (5 jogos/concurso)\n`);

const results = [];
for (const cfg of grid) {
  // seed reset simples: vamos rodar 5 jogos para reduzir variância
  const r = rodarConfig({ ...cfg, jogos: 5, ultimosN: 500 });
  results.push({ cfg, ...r });
}

results.sort((a, b) => b.roi - a.roi);
console.log("┌──── TOP 10 configurações por ROI ────┐");
console.log("│ wFreq │ wAtraso │ janela │ paresAlvo │   ROI    │ acertos 11+ │");
for (const r of results.slice(0, 10)) {
  const par = r.cfg.paresAlvo ? `${r.cfg.paresAlvo[0]}-${r.cfg.paresAlvo[1]}` : " livre ";
  console.log(`│  ${r.cfg.wFreq.toFixed(1)}  │   ${r.cfg.wAtraso.toFixed(1)}   │  ${pad(r.cfg.janela, 4)}  │  ${par}   │ ${r.roi > 0 ? "+" : ""}${r.roi.toFixed(2)}% │  ${r.p11_15}     │`);
}

console.log("\n┌──── PIORES 5 ────┐");
for (const r of results.slice(-5)) {
  const par = r.cfg.paresAlvo ? `${r.cfg.paresAlvo[0]}-${r.cfg.paresAlvo[1]}` : " livre ";
  console.log(`│  ${r.cfg.wFreq.toFixed(1)}  │   ${r.cfg.wAtraso.toFixed(1)}   │  ${pad(r.cfg.janela, 4)}  │  ${par}   │ ${r.roi.toFixed(2)}% │`);
}

// estatísticas do grid
const rois = results.map(r => r.roi);
const mean = rois.reduce((a, b) => a + b, 0) / rois.length;
const std = Math.sqrt(rois.reduce((a, b) => a + (b - mean) ** 2, 0) / rois.length);
console.log(`\nROIs do grid · média ${mean.toFixed(2)}% · desvio ${std.toFixed(2)}%`);
console.log(`A maioria dos ROIs cai entre ${(mean - std).toFixed(2)}% e ${(mean + std).toFixed(2)}%`);

const melhor = results[0];
console.log(`\n[04] MELHOR CONFIG:`);
console.log(`  wFreq=${melhor.cfg.wFreq}, wAtraso=${melhor.cfg.wAtraso}, janela=${melhor.cfg.janela}, paresAlvo=${melhor.cfg.paresAlvo}`);
console.log(`  ROI ${melhor.roi}% · ${melhor.dist[11]+melhor.dist[12]+melhor.dist[13]+melhor.dist[14]+melhor.dist[15]} acertos 11+ em ${melhor.totalApostas} apostas`);
console.log(`  Dist: 11=${melhor.dist[11]} · 12=${melhor.dist[12]} · 13=${melhor.dist[13]} · 14=${melhor.dist[14]} · 15=${melhor.dist[15]}`);

// salva top-3 para usar no app
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.join(__dirname, "..", "..", "data", "grid-top.json"),
  JSON.stringify(results.slice(0, 5), null, 2));
console.log(`\n[04] top-5 salvo em data/grid-top.json`);
console.log("\n========== fim ==========\n");
