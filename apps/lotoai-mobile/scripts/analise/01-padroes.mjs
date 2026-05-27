/* ============================================================
   01 · Padrões estatísticos clássicos
   - Frequência absoluta + atraso atual
   - Distribuição de pares/ímpares
   - Distribuição da soma
   - Primos, Fibonacci, moldura×miolo
   - Sequências (dezenas consecutivas no mesmo sorteio)
   - Repetições entre concursos consecutivos
   ============================================================ */

import { loadConcursos, NUMEROS, PRIMOS, FIBONACCI, MOLDURA, pad, pct } from "./_load.mjs";

const concursos = loadConcursos();
const sorteios = concursos.map(c => c.dezenas);
const N = sorteios.length;

console.log(`\n========== PADRÕES CLÁSSICOS · ${N} concursos ==========\n`);

/* --- Frequência + atraso --- */
const freq = Object.fromEntries(NUMEROS.map(n => [n, 0]));
for (const s of sorteios) for (const n of s) freq[n]++;

const atraso = Object.fromEntries(NUMEROS.map(n => [n, N]));
for (let i = N - 1, k = 0; i >= 0; i--, k++) {
  for (const n of sorteios[i]) if (atraso[n] === N) atraso[n] = k;
}

const stats = NUMEROS.map(n => ({
  n,
  freq: freq[n],
  pctFreq: freq[n] / N,
  atraso: atraso[n],
}));

console.log("┌──── Frequência por dezena ────┐");
console.log("│  N  │  saídas │  %    │ atraso │");
for (const s of stats.sort((a, b) => b.freq - a.freq)) {
  const bar = "█".repeat(Math.round((s.freq / Math.max(...stats.map(x => x.freq))) * 18));
  console.log(`│  ${pad(s.n)} │  ${pad(s.freq, 5)}  │ ${(s.pctFreq * 100).toFixed(1)}% │  ${pad(s.atraso, 4)}  │ ${bar}`);
}

const sorted = [...stats].sort((a, b) => b.freq - a.freq);
console.log(`\n  → Top 5 quentes: ${sorted.slice(0, 5).map(s => pad(s.n)).join(", ")}`);
console.log(`  → Top 5 frias:   ${sorted.slice(-5).reverse().map(s => pad(s.n)).join(", ")}`);
const maisAtrasada = [...stats].sort((a, b) => b.atraso - a.atraso)[0];
console.log(`  → Maior atraso atual: dezena ${pad(maisAtrasada.n)} (${maisAtrasada.atraso} concursos)`);

/* --- Distribuição de pares --- */
console.log("\n┌──── Pares por sorteio ────┐");
const distPares = Array(16).fill(0);
for (const s of sorteios) distPares[s.filter(n => n % 2 === 0).length]++;
distPares.forEach((v, k) => {
  if (v < 1) return;
  const bar = "█".repeat(Math.round((v / N) * 80));
  console.log(`  ${pad(k)} pares │ ${pad(v, 5)} ${pct(v / N).padStart(7)} ${bar}`);
});
const modaPares = distPares.indexOf(Math.max(...distPares));
console.log(`  → Moda: ${modaPares} pares (em ${pct(distPares[modaPares] / N)} dos sorteios)`);

/* --- Soma --- */
const somas = sorteios.map(s => s.reduce((a, b) => a + b, 0));
const somaMin = Math.min(...somas);
const somaMax = Math.max(...somas);
const somaMed = somas.reduce((a, b) => a + b, 0) / N;
console.log(`\n  Soma das 15 dezenas: min ${somaMin}, máx ${somaMax}, média ${somaMed.toFixed(1)}`);
const buckets = [120, 150, 170, 190, 210, 240, 270];
const labels = ["<120", "120-150", "150-170", "170-190", "190-210", "210-240", "240-270", ">270"];
const distSoma = Array(labels.length).fill(0);
for (const s of somas) {
  let b = buckets.findIndex(x => s < x);
  if (b < 0) b = labels.length - 1;
  distSoma[b]++;
}
console.log("  Distribuição:");
distSoma.forEach((v, k) => {
  const bar = "█".repeat(Math.round((v / N) * 60));
  console.log(`    ${labels[k].padEnd(8)} │ ${pad(v, 5)} ${pct(v / N).padStart(7)} ${bar}`);
});

/* --- Primos, Fibonacci, Moldura --- */
const distPrimos = Array(16).fill(0);
const distMoldura = Array(17).fill(0);
const distFib = Array(8).fill(0);
for (const s of sorteios) {
  distPrimos[s.filter(n => PRIMOS.has(n)).length]++;
  distMoldura[s.filter(n => MOLDURA.has(n)).length]++;
  distFib[s.filter(n => FIBONACCI.has(n)).length]++;
}
console.log("\n  Primos (de 9 possíveis):");
distPrimos.forEach((v, k) => v && console.log(`    ${pad(k)} │ ${pad(v, 5)} ${pct(v / N).padStart(7)}`));
console.log("\n  Moldura (de 16 possíveis):");
distMoldura.forEach((v, k) => v && console.log(`    ${pad(k)} │ ${pad(v, 5)} ${pct(v / N).padStart(7)}`));

/* --- Sequências (consecutivos no MESMO sorteio) --- */
console.log("\n  Sequências de dezenas consecutivas no sorteio:");
const distSeq = Array(16).fill(0); // max comprimento de run encontrado
for (const s of sorteios) {
  let bestRun = 1, run = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1] + 1) { run++; bestRun = Math.max(bestRun, run); }
    else run = 1;
  }
  distSeq[bestRun]++;
}
distSeq.forEach((v, k) => v && console.log(`    run ${pad(k)} │ ${pad(v, 5)} ${pct(v / N).padStart(7)}`));

/* --- Repetições entre concursos consecutivos --- */
console.log("\n  Dezenas que se repetem do concurso anterior (de 15):");
const distRep = Array(16).fill(0);
for (let i = 1; i < N; i++) {
  const prev = new Set(sorteios[i - 1]);
  const r = sorteios[i].filter(n => prev.has(n)).length;
  distRep[r]++;
}
distRep.forEach((v, k) => v && console.log(`    ${pad(k)} repetidas │ ${pad(v, 5)} ${pct(v / (N - 1)).padStart(7)}`));
const modaRep = distRep.indexOf(Math.max(...distRep));
console.log(`  → Moda: ${modaRep} dezenas se repetem do concurso anterior`);

console.log("\n========== fim ==========\n");
