/* ============================================================
   02 · Correlações entre dezenas
   - Matriz de co-ocorrência (quantas vezes A e B saem juntos)
   - Lift = P(A∩B) / (P(A)·P(B)) → quanto > 1, mais associadas
   - Jaccard = |A∩B| / |A∪B|
   - Top duplas e top trios mais "aderentes"
   ============================================================ */

import { loadConcursos, NUMEROS, pad } from "./_load.mjs";

const concursos = loadConcursos();
const sorteios = concursos.map(c => c.dezenas);
const N = sorteios.length;

console.log(`\n========== CORRELAÇÕES · ${N} concursos ==========\n`);

const freq = Object.fromEntries(NUMEROS.map(n => [n, 0]));
for (const s of sorteios) for (const n of s) freq[n]++;

// Matriz de co-ocorrência 25×25
const co = Array.from({ length: 26 }, () => Array(26).fill(0));
for (const s of sorteios) {
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      const a = s[i], b = s[j];
      co[a][b]++; co[b][a]++;
    }
  }
}

/* --- Top duplas por LIFT (descontando que dezenas são frequentes) --- */
const duplas = [];
for (let a = 1; a <= 25; a++) {
  for (let b = a + 1; b <= 25; b++) {
    const pA = freq[a] / N;
    const pB = freq[b] / N;
    const pAB = co[a][b] / N;
    const expectedAB = pA * pB;
    const lift = expectedAB ? pAB / expectedAB : 0;
    const jaccard = co[a][b] / (freq[a] + freq[b] - co[a][b]);
    duplas.push({ a, b, juntas: co[a][b], lift, jaccard });
  }
}

duplas.sort((x, y) => y.lift - x.lift);
console.log("┌──── TOP 15 duplas com maior LIFT (saem juntas + do que o esperado) ────┐");
console.log("│ dupla │ juntas │  lift  │ jaccard │");
for (const d of duplas.slice(0, 15)) {
  console.log(`│ ${pad(d.a)}-${pad(d.b)} │  ${pad(d.juntas, 4)}  │ ${d.lift.toFixed(3)} │  ${d.jaccard.toFixed(3)}  │`);
}

duplas.sort((x, y) => x.lift - y.lift);
console.log("\n┌──── TOP 10 duplas que MENOS aparecem juntas (lift < 1) ────┐");
console.log("│ dupla │ juntas │  lift  │");
for (const d of duplas.slice(0, 10)) {
  console.log(`│ ${pad(d.a)}-${pad(d.b)} │  ${pad(d.juntas, 4)}  │ ${d.lift.toFixed(3)} │`);
}

/* --- Top trios --- */
console.log("\n┌──── TOP 15 trios por LIFT ────┐");
console.log("│ trio     │ juntos │  lift  │");
const trioCounts = new Map();
for (const s of sorteios) {
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      for (let k = j + 1; k < s.length; k++) {
        const key = `${s[i]}-${s[j]}-${s[k]}`;
        trioCounts.set(key, (trioCounts.get(key) || 0) + 1);
      }
    }
  }
}
const trios = [];
for (const [key, count] of trioCounts) {
  const [a, b, c] = key.split("-").map(Number);
  const exp = (freq[a] / N) * (freq[b] / N) * (freq[c] / N);
  const lift = exp ? (count / N) / exp : 0;
  if (count >= 100) trios.push({ a, b, c, juntos: count, lift });
}
trios.sort((x, y) => y.lift - x.lift);
for (const t of trios.slice(0, 15)) {
  console.log(`│ ${pad(t.a)}-${pad(t.b)}-${pad(t.c)} │  ${pad(t.juntos, 4)}  │ ${t.lift.toFixed(3)} │`);
}

/* --- Núcleos: dezenas que aparecem nos topos --- */
const topDuplas = [...duplas].sort((x, y) => y.lift - x.lift).slice(0, 30);
const aparicoes = Object.fromEntries(NUMEROS.map(n => [n, 0]));
for (const d of topDuplas) { aparicoes[d.a]++; aparicoes[d.b]++; }
const nucleos = Object.entries(aparicoes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 8)
  .map(([n, c]) => `${pad(+n)}(${c})`);
console.log(`\n  Núcleos · dezenas que mais aparecem nas top-30 duplas: ${nucleos.join(", ")}`);

console.log("\n========== fim ==========\n");

// salva matriz para uso posterior
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
writeFileSync(path.join(__dirname, "..", "..", "data", "co-matriz.json"),
  JSON.stringify({ co, freq, N }));
console.log("[02] matriz de co-ocorrência salva em data/co-matriz.json");
