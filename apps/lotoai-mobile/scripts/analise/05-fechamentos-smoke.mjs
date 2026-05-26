/* ============================================================
   05 · Smoke test do módulo de fechamentos
   - Verifica combinatórias e custos
   - Roda o fechamento de 16 dezenas sobre os últimos 200 concursos
     e mostra distribuição empírica de melhor pontuação
   ============================================================ */

import { loadConcursos } from "./_load.mjs";
import { combinacoes, custoFechamentoCompleto, gerarFechamentoCompleto, analisarFechamento, tabelaGarantias } from "../../src/lib/fechamentos.js";

console.log("\n========== FECHAMENTOS · smoke test ==========\n");

// 1. Combinatórias e custos
console.log("┌──── Custo de fechamento completo ────┐");
console.log("│ K  │  apostas  │     custo (R$)  │");
for (const K of [15, 16, 17, 18, 19, 20]) {
  console.log(`│ ${K} │ ${String(combinacoes(K, 15)).padStart(8)}  │ ${String(custoFechamentoCompleto(K)).padStart(14)}  │`);
}

// 2. Garantias para K=18
console.log("\n  Garantias matemáticas (K=18):");
for (const g of tabelaGarantias(18)) {
  console.log(`    Se acertar ${g.acertosBase} das 18 → garante ${g.garantiaPontos} pontos`);
}

// 3. Gera fechamento de 16 dezenas-base = top 16 mais frequentes
const concursos = loadConcursos();
const sorteios = concursos.map(c => c.dezenas);
const freq = {};
for (const s of sorteios) for (const n of s) freq[n] = (freq[n] || 0) + 1;
const top16 = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([n]) => +n).sort((a, b) => a - b);
console.log(`\n  Top-16 mais frequentes: ${top16.join(", ")}`);

const fech = gerarFechamentoCompleto(top16);
console.log(`  Fechamento gerado: ${fech.length} apostas`);

// 4. Roda sobre os últimos 200 concursos
const ult = sorteios.slice(-200);
let totalPontos = 0, melhorGeral = 0;
const histMelhor = {};
for (const s of ult) {
  const r = analisarFechamento(fech, s);
  totalPontos += r.melhor;
  melhorGeral = Math.max(melhorGeral, r.melhor);
  histMelhor[r.melhor] = (histMelhor[r.melhor] || 0) + 1;
}
console.log(`\n  Sobre os últimos 200 concursos:`);
console.log(`    Melhor pontuação média:  ${(totalPontos / 200).toFixed(2)}`);
console.log(`    Melhor pontuação máxima: ${melhorGeral}`);
console.log(`    Distribuição do "melhor jogo de cada concurso":`);
for (const pts of [15, 14, 13, 12, 11, 10, 9, 8].filter(p => histMelhor[p])) {
  const v = histMelhor[pts];
  const bar = "█".repeat(Math.round((v / 200) * 50));
  console.log(`      ${pts} pts │ ${String(v).padStart(3)} ${((v / 200) * 100).toFixed(1).padStart(5)}%  ${bar}`);
}

console.log("\n========== fim ==========\n");
