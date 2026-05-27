/* ============================================================
   03 · Modelo preditivo (logistic regression simples por dezena)
   - 25 modelos independentes (um por dezena)
   - Features (por concurso anterior): freq janela 10/30/100, atraso,
     paridade média, soma média, era pares/ímpares no último, etc.
   - Treino: primeiros 80% · Validação: últimos 20%
   - Reporta calibração: ele consegue ranquear melhor que aleatório?
   ============================================================ */

import { loadConcursos, NUMEROS, pad, pct } from "./_load.mjs";

const concursos = loadConcursos();
const sorteios = concursos.map(c => c.dezenas);
const N = sorteios.length;
const HISTMIN = 100; // precisa de ao menos 100 concursos passados para extrair features

/* ---------- Feature extraction ---------- */

function freqJanela(sorteios, ate, janela) {
  const f = Object.fromEntries(NUMEROS.map(n => [n, 0]));
  const lo = Math.max(0, ate - janela);
  for (let i = lo; i < ate; i++) for (const n of sorteios[i]) f[n]++;
  return f;
}

function atrasoEm(sorteios, ate) {
  const a = Object.fromEntries(NUMEROS.map(n => [n, 50]));
  for (let i = ate - 1, k = 0; i >= 0 && k < 50; i--, k++) {
    for (const n of sorteios[i]) if (a[n] === 50) a[n] = k;
  }
  return a;
}

function featuresFor(sorteios, ate, n) {
  const f10  = freqJanela(sorteios, ate, 10)[n];
  const f30  = freqJanela(sorteios, ate, 30)[n];
  const f100 = freqJanela(sorteios, ate, 100)[n];
  const atr  = atrasoEm(sorteios, ate)[n];
  const ultimo = sorteios[ate - 1];
  const apareceuUlt = ultimo.includes(n) ? 1 : 0;
  return [
    1, // bias
    f10 / 10,
    f30 / 30,
    f100 / 100,
    Math.min(atr, 20) / 20,
    apareceuUlt,
    n % 2 === 0 ? 1 : 0,
    n / 25,
  ];
}

function buildDataset() {
  // Para cada concurso i (i ≥ HISTMIN) e cada dezena n, gera (features, alvo)
  console.log(`[03] gerando dataset · ${N - HISTMIN} concursos × 25 dezenas = ${(N - HISTMIN) * 25} amostras`);
  const X = []; const y = [];
  // amostragem: para cada concurso, todas as 25 dezenas (positivas + negativas)
  for (let i = HISTMIN; i < N; i++) {
    const alvo = new Set(sorteios[i]);
    for (const n of NUMEROS) {
      X.push(featuresFor(sorteios, i, n));
      y.push(alvo.has(n) ? 1 : 0);
    }
  }
  return { X, y };
}

/* ---------- Logistic regression via gradiente ---------- */

function sigmoid(z) { return 1 / (1 + Math.exp(-z)); }
function dot(w, x) { let s = 0; for (let i = 0; i < w.length; i++) s += w[i] * x[i]; return s; }

function trainLogistic(X, y, { lr = 0.05, epochs = 80, lambda = 0.01 } = {}) {
  const d = X[0].length;
  const w = new Array(d).fill(0);
  const n = X.length;
  for (let ep = 0; ep < epochs; ep++) {
    const grad = new Array(d).fill(0);
    let loss = 0;
    for (let i = 0; i < n; i++) {
      const p = sigmoid(dot(w, X[i]));
      const err = p - y[i];
      for (let j = 0; j < d; j++) grad[j] += err * X[i][j];
      loss += -(y[i] ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9));
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (grad[j] / n + lambda * w[j]);
    if (ep === epochs - 1) console.log(`  → epoch ${ep + 1}/${epochs} · loss ${(loss / n).toFixed(4)}`);
  }
  return w;
}

/* ---------- Avaliação ---------- */

function evalRanking(w, sorteios, hi, lo) {
  // Para cada concurso na faixa [lo, hi), ranqueia 25 dezenas por score
  // e mede quantas das 15 sorteadas caíram no top-15 ranqueado.
  let acertosTop15 = 0;
  let acertosTop18 = 0; // se eu escolher 18 dezenas (fechamento)
  let aleatTop15 = 0;
  let total = hi - lo;
  for (let i = lo; i < hi; i++) {
    const scores = NUMEROS.map(n => ({ n, p: sigmoid(dot(w, featuresFor(sorteios, i, n))) }));
    scores.sort((a, b) => b.p - a.p);
    const top15 = new Set(scores.slice(0, 15).map(s => s.n));
    const top18 = new Set(scores.slice(0, 18).map(s => s.n));
    const alvo = new Set(sorteios[i]);
    let h15 = 0, h18 = 0;
    for (const n of alvo) {
      if (top15.has(n)) h15++;
      if (top18.has(n)) h18++;
    }
    acertosTop15 += h15;
    acertosTop18 += h18;
    // baseline aleatório: esperança = 15 × (15/25) = 9
    aleatTop15 += 9;
  }
  return {
    total,
    avgAcertosTop15: acertosTop15 / total,
    avgAcertosTop18: acertosTop18 / total,
    baselineAleat: aleatTop15 / total,
  };
}

/* ---------- Main ---------- */

console.log(`\n========== MODELO PREDITIVO · ${N} concursos ==========\n`);

const { X, y } = buildDataset();
// split 80/20 mas mantendo a ordem temporal: primeiros para treino
const split = Math.floor(X.length * 0.8);
const Xtr = X.slice(0, split), ytr = y.slice(0, split);
console.log(`[03] treino: ${Xtr.length} amostras · validação: ${X.length - split}`);

const w = trainLogistic(Xtr, ytr);
console.log(`\n[03] pesos finais:`);
const featNames = ["bias", "freq10", "freq30", "freq100", "atraso", "ultimoConc", "par", "valor"];
w.forEach((wi, i) => console.log(`  ${featNames[i].padEnd(12)} = ${wi.toFixed(4)}`));

// avaliação na janela de validação (últimos 20% dos concursos com dados)
const concInicioVal = HISTMIN + Math.floor((N - HISTMIN) * 0.8);
const evalRes = evalRanking(w, sorteios, N, concInicioVal);
console.log(`\n[03] AVALIAÇÃO (${evalRes.total} concursos de validação):`);
console.log(`  Acertos médios no top-15 ranqueado: ${evalRes.avgAcertosTop15.toFixed(3)}`);
console.log(`  Acertos médios no top-18 ranqueado: ${evalRes.avgAcertosTop18.toFixed(3)} / 15`);
console.log(`  Baseline aleatório (top-15):        ${evalRes.baselineAleat.toFixed(3)}`);
const ganho = evalRes.avgAcertosTop15 - evalRes.baselineAleat;
console.log(`  → Ganho sobre aleatório:            ${ganho > 0 ? "+" : ""}${ganho.toFixed(3)} dezenas/concurso`);

// salva pesos para uso no app
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.join(__dirname, "..", "..", "data", "modelo-pesos.json"),
  JSON.stringify({ features: featNames, weights: w }, null, 2));
console.log(`\n[03] pesos salvos em data/modelo-pesos.json`);
console.log("\n========== fim ==========\n");
