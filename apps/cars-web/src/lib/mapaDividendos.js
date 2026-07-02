// Mapa de dividendos — monta uma grade Ativo × Mês (Jan–Dez) com a renda
// estimada de proventos, pra você montar uma carteira que paga o ano todo.
//
// Fonte dos meses de pagamento (híbrido):
//   1. override manual do usuário (clicou no mês);  2. inferido do histórico de
//   proventos já lançado;  3. default por tipo (FII = todo mês; ação = trimestral).
// A renda é estimada por yields-base (DY médio por classe), distribuída nos
// meses pagadores. Tudo local — nada de API.

import { YIELDS_MENSAIS } from "./yields-base.js";

export const MESES_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const TIPOS_PAGADORES = ["acao", "fii", "stock", "reit"];

const norm = (s = "") => String(s).trim().toUpperCase();

// Meses default por tipo (índices 0–11).
export function mesesDefault(tipo) {
  if (tipo === "fii") return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // mensal
  if (tipo === "acao" || tipo === "stock" || tipo === "reit") return [2, 5, 8, 11]; // trimestral (Mar/Jun/Set/Dez)
  return [];
}

// Infere os meses em que um ticker pagou, a partir do histórico de proventos
// lançados manualmente (cada item { data:"YYYY-MM-DD", ticker }).
export function inferirMesesDoHistorico(ticker, proventosManuais = []) {
  const tk = norm(ticker);
  const meses = new Set();
  for (const p of proventosManuais || []) {
    if (norm(p.ticker) !== tk) continue;
    const m = Number(String(p.data || "").slice(5, 7)) - 1;
    if (m >= 0 && m <= 11) meses.add(m);
  }
  return [...meses].sort((a, b) => a - b);
}

// DY estimado (%) por tipo, quando não há DY informado.
export function dyEstimado(tipo) {
  return (YIELDS_MENSAIS[tipo] ?? 0) * 12 * 100;
}

function valorPosicao(item) {
  if (item.valorPlanejado != null) return Number(item.valorPlanejado) || 0; // candidato
  return (Number(item.qtd) || 0) * (Number(item.preco) || 0); // ativo da carteira
}

function mesesDoItem(item, overrides, mesesInferidos) {
  const ov = overrides[norm(item.ticker)];
  if (ov && Array.isArray(ov.meses)) return ov.meses;
  if (Array.isArray(item.meses) && item.meses.length) return item.meses; // candidato com meses explícitos
  const inf = mesesInferidos[norm(item.ticker)];
  if (inf && inf.length) return inf;
  return mesesDefault(item.tipo);
}

/**
 * Monta o mapa de dividendos.
 * @param {object} p
 * @param {Array} p.ativos        ativos da carteira ({ ticker, tipo, qtd, preco })
 * @param {Array} [p.candidatos]  planejados ({ ticker, tipo, valorPlanejado, dy?, meses? })
 * @param {object} [p.overrides]  { [TICKER]: { meses:number[] } } — ajustes do usuário
 * @param {Array} [p.proventosManuais] histórico p/ inferir meses
 * @param {object} [p.fundamentos]  { [TICKER]: { dados:{ dy } } } — DY real, se houver
 * @returns {{ rows, totaisPorMes:number[], rendaAnualTotal:number, rendaMensalMedia:number, lacunas:number[] }}
 */
export function montarMapaDividendos({ ativos = [], candidatos = [], overrides = {}, proventosManuais = [], fundamentos = {} } = {}) {
  const itens = [
    ...ativos.filter((a) => a && TIPOS_PAGADORES.includes(a.tipo)).map((a) => ({ ...a, candidato: false })),
    ...candidatos.map((c) => ({ ...c, candidato: true })),
  ];

  const mesesInferidos = {};
  for (const it of itens) {
    const tk = norm(it.ticker);
    if (!(tk in mesesInferidos)) mesesInferidos[tk] = inferirMesesDoHistorico(tk, proventosManuais);
  }

  const rows = itens.map((it) => {
    const valor = valorPosicao(it);
    const meses = mesesDoItem(it, overrides, mesesInferidos).filter((m) => m >= 0 && m <= 11);
    // DY real do ativo (informado no candidato ou curado em Fundamentos) tem
    // prioridade sobre a média da classe — a renda projetada usa o mesmo DY
    // que é mostrado na coluna, em vez de sempre cair pro yield genérico.
    const dyInformado = it.dy != null ? Number(it.dy) : Number(fundamentos[norm(it.ticker)]?.dados?.dy);
    const dy = Number.isFinite(dyInformado) && dyInformado > 0 ? dyInformado : dyEstimado(it.tipo);
    const rendaAnual = valor * (dy / 100);
    const porMesPag = meses.length ? rendaAnual / meses.length : 0;
    const rendaPorMes = Array(12).fill(0);
    meses.forEach((m) => { rendaPorMes[m] = porMesPag; });
    return {
      ticker: norm(it.ticker),
      nome: it.nome || "",
      tipo: it.tipo,
      candidato: !!it.candidato,
      valor,
      dy,
      meses,
      rendaPorMes,
      rendaAnual,
    };
  }).sort((a, b) => b.rendaAnual - a.rendaAnual);

  const totaisPorMes = Array(12).fill(0).map((_, m) => rows.reduce((s, r) => s + r.rendaPorMes[m], 0));
  const rendaAnualTotal = totaisPorMes.reduce((s, v) => s + v, 0);
  const lacunas = totaisPorMes.map((v, m) => (v <= 0.005 ? m : -1)).filter((m) => m >= 0);

  return {
    rows,
    totaisPorMes,
    rendaAnualTotal,
    rendaMensalMedia: rendaAnualTotal / 12,
    lacunas,
  };
}
