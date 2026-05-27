/* ============================================================
   06 · Pré-calcula matrizes de cobertura (greedy + verificação)
   - Para K ∈ {16, 17, 18, 19, 20} e g ∈ {11, 12, 13, 14}
   - Gera matrizes índice-base (1..K) e salva em data/coverings.json
   - Verifica garantia REAL antes de salvar
   - Mede ROI empírico sobre os últimos 200 concursos
   ============================================================ */

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConcursos, DATA_DIR } from "./_load.mjs";
import {
  coberturaGreedy,
  verificarGarantia,
  aplicarMatriz,
  probabilidadeAcerto,
} from "../../src/lib/coverings.js";
import { analisarFechamento } from "../../src/lib/fechamentos.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("\n========== COVERINGS · greedy + verificação ==========\n");

const PRECO = 3.5;
const CASOS = [
  { K: 16, g: 14, label: "16 dezenas · garantia 14 se 14 das 16 saírem" },
  { K: 16, g: 13, label: "16 dezenas · garantia 13 se 13 das 16 saírem" },
  { K: 16, g: 12, label: "16 dezenas · garantia 12 se 12 das 16 saírem" },
  { K: 17, g: 14, label: "17 dezenas · garantia 14 se 14 das 17 saírem" },
  { K: 17, g: 13, label: "17 dezenas · garantia 13 se 13 das 17 saírem" },
  { K: 17, g: 12, label: "17 dezenas · garantia 12 se 12 das 17 saírem" },
  { K: 18, g: 13, label: "18 dezenas · garantia 13 se 13 das 18 saírem" },
  { K: 18, g: 12, label: "18 dezenas · garantia 12 se 12 das 18 saírem" },
  { K: 19, g: 12, label: "19 dezenas · garantia 12 se 12 das 19 saírem" },
  { K: 20, g: 12, label: "20 dezenas · garantia 12 se 12 das 20 saírem" },
];

const matrizes = {};
const tabela = [];

for (const { K, g, label } of CASOS) {
  const base = Array.from({ length: K }, (_, i) => i + 1);
  process.stdout.write(`  ${label}…`);
  const t0 = Date.now();
  const { blocos, coberto, gapInicial, gapTotal } = coberturaGreedy(base, g, { maxBlocos: 500 });
  const verif = verificarGarantia(base, g, blocos);
  const dt = ((Date.now() - t0) / 1000).toFixed(2);

  if (!verif.garantido) {
    console.log(`  ⚠ NÃO COBRIU (${verif.cobertos}/${verif.total}, ${dt}s)`);
    continue;
  }

  const apostas = blocos.length;
  const custo = +(apostas * PRECO).toFixed(2);
  console.log(`  ✓ ${apostas} apostas · R$ ${custo} · cobertura ${verif.cobertos}/${verif.total} · ${dt}s`);

  const key = `${K}-${g}`;
  matrizes[key] = {
    K, g, apostas, custo,
    descricao: label,
    matriz: blocos, // já em índices 1..K
  };
  tabela.push({ K, g, apostas, custo, label });
}

// salva apenas as matrizes para uso no app
writeFileSync(
  path.join(DATA_DIR, "coverings.json"),
  JSON.stringify(matrizes, null, 2)
);
console.log(`\n[06] ${Object.keys(matrizes).length} matrizes salvas em data/coverings.json`);

// também copia para public/ (acessível pelo app)
writeFileSync(
  path.join(__dirname, "..", "..", "public", "coverings.json"),
  JSON.stringify(matrizes)
);
console.log(`[06] copiado para public/coverings.json`);

console.log("\n┌──── Sumário das matrizes ────┐");
console.log("│ K  │ g  │ apostas │   custo   │");
for (const r of tabela) {
  console.log(`│ ${r.K} │ ${r.g} │   ${String(r.apostas).padStart(4)}  │ R$ ${String(r.custo).padStart(6)} │`);
}

/* ---------- ROI empírico sobre os últimos 200 concursos ---------- */

console.log("\n========== ROI empírico (últimos 200 concursos) ==========");
console.log("  base = top-K mais frequentes do histórico\n");

const concursos = loadConcursos();
const sorteios = concursos.map(c => c.dezenas);
const PREMIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 };

const freq = {};
for (const s of sorteios) for (const n of s) freq[n] = (freq[n] || 0) + 1;
const ranking = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([n]) => +n);

const ultimos = sorteios.slice(-200);

console.log("│ K  │ g  │ apostas │   custo total │     prêmio    │      ROI      │ 11+%  │");
for (const r of tabela) {
  const top = ranking.slice(0, r.K).sort((a, b) => a - b);
  const matriz = matrizes[`${r.K}-${r.g}`].matriz;
  const jogos = aplicarMatriz(matriz, top);

  let gasto = 0, premio = 0, acertos11plus = 0;
  for (const s of ultimos) {
    const an = analisarFechamento(jogos, s, PREMIO);
    gasto += jogos.length * PRECO;
    premio += an.premioEstimado;
    if (an.melhor >= 11) acertos11plus++;
  }
  const roi = ((premio - gasto) / gasto * 100).toFixed(2);
  console.log(
    `│ ${r.K} │ ${r.g} │   ${String(r.apostas).padStart(4)}  │ R$ ${String(gasto.toFixed(0)).padStart(9)} │ R$ ${String(premio.toFixed(0)).padStart(9)} │ ${roi.padStart(7)}% │ ${String((acertos11plus / 200 * 100).toFixed(1)).padStart(4)}% │`
  );
}

console.log("\n========== fim ==========\n");
