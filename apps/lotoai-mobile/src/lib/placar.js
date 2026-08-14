/* ============================================================
   PLACAR · agregação de resultados dos bilhetes salvos
   ─────────────────────────────────────────────────────────────
   Junta jogos individuais (lf_jogos) + jogos de bolões (lf_bolao)
   e confere automaticamente contra concursos do histórico.
   Retorna resumo: total apostas, prêmio est., melhor, dist 11+.
   ============================================================ */

import { conferir, LOTOFACIL } from "./lotofacil.js";
import { listarJogos } from "./supabase.js";
import { listarBoloes } from "./bolao.js";

const PREMIO_MEDIO = { 11: 6, 12: 12, 13: 30, 14: 2000, 15: 1500000 };

/**
 * Carrega tudo o que o usuário jogou (bilhetes soltos + de bolão) e
 * confere contra o histórico. Bilhete sem concurso_alvo é conferido
 * contra o último do histórico (fallback).
 *
 * @param {object[]} historico  array de {numero, data, dezenas}
 * @returns {Promise<PlacarResumo>}
 */
export async function calcularPlacar(historico) {
  if (!historico?.length) {
    return vazio();
  }
  const [bilhetes, boloes] = await Promise.all([
    listarJogos({ limite: 500 }).catch(() => []),
    listarBoloes().catch(() => []),
  ]);

  const mapaConcurso = new Map(historico.map(c => [c.numero, c]));
  const ultimoNum = historico[historico.length - 1].numero;

  const entradas = [];

  // Bilhetes individuais
  for (const b of bilhetes) {
    if (!b?.dezenas?.length) continue;
    const alvoNum = Number(b.concurso_alvo) || ultimoNum;
    const concurso = mapaConcurso.get(alvoNum);
    if (!concurso) {
      entradas.push({ tipo: "bilhete", origem: b.estrategia || "manual", dezenas: b.dezenas,
                      concurso: alvoNum, pontos: null, premio: 0, pendente: true, id: b.id });
      continue;
    }
    const r = conferir(b.dezenas, concurso.dezenas);
    const premio = PREMIO_MEDIO[r.pontos] || 0;
    entradas.push({
      tipo: "bilhete", origem: b.estrategia || "manual",
      dezenas: b.dezenas, concurso: alvoNum, pontos: r.pontos,
      premio, pendente: false, id: b.id,
    });
  }

  // Bolões — desdobra cada jogo do bolão como um bilhete
  for (const bo of boloes) {
    if (!bo?.jogos?.length) continue;
    const alvoNum = Number(bo.concursoAlvo) || ultimoNum;
    const concurso = mapaConcurso.get(alvoNum);
    for (const j of bo.jogos) {
      if (!concurso) {
        entradas.push({ tipo: "bolao", origem: `bolão · ${bo.nome}`, dezenas: j,
                        concurso: alvoNum, pontos: null, premio: 0, pendente: true, id: bo.id });
        continue;
      }
      const r = conferir(j, concurso.dezenas);
      entradas.push({
        tipo: "bolao", origem: `bolão · ${bo.nome}`,
        dezenas: j, concurso: alvoNum, pontos: r.pontos,
        premio: PREMIO_MEDIO[r.pontos] || 0, pendente: false, id: bo.id,
      });
    }
  }

  // Agregações
  const conferidos = entradas.filter(e => !e.pendente);
  const pendentes = entradas.filter(e => e.pendente);
  const premiadas = conferidos.filter(e => e.pontos >= 11);
  const dist = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
  let premioTotal = 0;
  let melhor = 0;
  for (const e of conferidos) {
    if (e.pontos in dist) dist[e.pontos]++;
    premioTotal += e.premio;
    if (e.pontos > melhor) melhor = e.pontos;
  }
  const custoTotal = +(conferidos.length * LOTOFACIL.precoAposta).toFixed(2);
  const roi = custoTotal > 0 ? ((premioTotal - custoTotal) / custoTotal) * 100 : 0;

  return {
    totalApostas: entradas.length,
    conferidas: conferidos.length,
    pendentes: pendentes.length,
    premiadas: premiadas.length,
    melhor,
    dist,
    premioTotal: +premioTotal.toFixed(2),
    custoTotal,
    lucro: +(premioTotal - custoTotal).toFixed(2),
    roi: +roi.toFixed(1),
    entradas,          // lista bruta pra detalhes
    premiadasDetalhe: premiadas.slice(0, 10),
  };
}

function vazio() {
  return {
    totalApostas: 0, conferidas: 0, pendentes: 0, premiadas: 0,
    melhor: 0, dist: { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 },
    premioTotal: 0, custoTotal: 0, lucro: 0, roi: 0,
    entradas: [], premiadasDetalhe: [],
  };
}
