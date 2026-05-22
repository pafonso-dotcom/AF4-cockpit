import { avaliarCriterio } from "./criteriosIdV.js";

// Pesos por grupo de critério.
const PESO_GRUPO = {
  estrutura: 2, qualidade: 2, escala: 1, retorno: 1,
  eliminatorio: 2, classificatorio: 1,
  resultado: 1, risco: 1, sociedade: 1,
};
// bom = 100% · aceitável = 50% · ruim = 0% · vazio = ignorado.
const PONTOS_AVAL = { bom: 1, aceitavel: 0.5, ruim: 0, vazio: null };

/**
 * Calcula o score IdV ponderado de uma análise.
 * Score = (pontos obtidos / pontos possíveis) × 100, ignorando critérios vazios.
 * Badge: ≥70 Forte 🟢 · 40-69 Médio 🟡 · <40 Fraco 🔴
 */
export function calcularScoreIdV(analise, criterios) {
  let obtidos = 0, possiveis = 0, preenchidos = 0;
  const total = criterios.length;
  criterios.forEach(c => {
    const aval = avaliarCriterio(c, analise.valores?.[c.id]);
    const p = PONTOS_AVAL[aval];
    if (p === null) return;
    const peso = PESO_GRUPO[c.grupo] || 1;
    obtidos += p * peso;
    possiveis += peso;
    preenchidos++;
  });
  const score = possiveis > 0 ? Math.round((obtidos / possiveis) * 100) : 0;
  const faltam = total - preenchidos;
  let badge, cor;
  if (preenchidos === 0) { badge = "Sem dados"; cor = "#B0A990"; }
  else if (score >= 70) { badge = "Forte"; cor = "#4A7B3A"; }
  else if (score >= 40) { badge = "Médio"; cor = "#C99A2E"; }
  else { badge = "Fraco"; cor = "#A83A2E"; }
  return { score, badge, cor, preenchidos, total, faltam, parcial: faltam > 0 };
}
