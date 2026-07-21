// ============================================================
// RELATÓRIO MENSAL — motor puro (sem React)
// Junta o fechamento de FINANÇAS e de INVESTIMENTOS de um mês:
//   - Finanças: receitas, despesas (lançadas), sobra, pagas x a pagar,
//     top categorias de gasto e comparação com o mês anterior.
//   - Investimentos: aportes, vendas, proventos e resultado do mês
//     (via movimentacoesInvestMes) + variação do patrimônio no mês
//     (a partir dos snapshots diários).
// Tudo derivado dos agregadores que o resto do app já usa, pra os números
// baterem com o Painel/Planejamento.
// ============================================================

import { getDespesasDoMes, getGanhosDoMes } from "./agregador.js";
import { movimentacoesInvestMes } from "./movimentacoesInvest.js";

// Categorias que NÃO são gasto de consumo (movimentação de dinheiro): não
// entram no ranking de categorias. Mesma regra do donut do Painel.
const naoEhGasto = (nome) => /investim|transfer|dep[oó]sito|aporte|resgate/i.test(String(nome || ""));

export function mesAnteriorISO(mesISO) {
  const [y, m] = String(mesISO).split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Fechamento de finanças de um mês (competência).
function financasDoMes(mesISO, state, escopo) {
  let desp = [], gan = [];
  try { desp = getDespesasDoMes(mesISO, state, escopo) || []; } catch { desp = []; }
  try { gan = getGanhosDoMes(mesISO, state, escopo) || []; } catch { gan = []; }

  // Transferência entre bancos é o MESMO dinheiro mudando de conta — não é
  // receita nem despesa real, então fica fora do relatório. As duas pernas
  // carregam `transferenciaId`; o id do item do agregador é o id da transação.
  const transferIds = new Set(
    (state.transacoes || []).filter(t => t && t.transferenciaId).map(t => t.id)
  );
  const real = (arr) => arr.filter(x => !transferIds.has(x.id));
  desp = real(desp);
  gan = real(gan);

  const receitas = gan.reduce((s, g) => s + (Number(g.valor) || 0), 0);
  const despesas = desp.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const pagas = desp.filter(d => d.status === "paga").reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const aPagar = desp.filter(d => d.status === "pendente" || d.status === "atrasada")
    .reduce((s, d) => s + (Number(d.valor) || 0), 0);

  // Ranking de categorias de gasto (consumo real).
  const gastos = desp.filter(d => !naoEhGasto(d.categoria) && !d.transferenciaId);
  const categorias = agruparCategoria(gastos);
  // Receitas agrupadas por categoria (resumo, não item a item).
  const receitasCategorias = agruparCategoria(gan);

  return { receitas, despesas, sobra: receitas - despesas, pagas, aPagar, categorias, receitasCategorias };
}

// Agrupa itens {categoria, valor} por categoria, ordenado do maior pro menor,
// com o % de cada uma sobre o total.
function agruparCategoria(itens) {
  const m = {};
  itens.forEach(x => { const k = x.categoria || "Outros"; m[k] = (m[k] || 0) + (Number(x.valor) || 0); });
  const tot = Object.values(m).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, valor]) => ({ nome, valor, pct: (valor / tot) * 100 }));
}

// Variação do patrimônio no mês, a partir dos snapshots diários {data,total}.
// Início = último snapshot ANTES do mês (ou o primeiro do mês, se não houver
// anterior). Fim = último snapshot do mês.
function patrimonioNoMes(mesISO, historico = []) {
  const arr = (historico || [])
    .filter(p => p && p.data && Number.isFinite(Number(p.total)))
    .sort((a, b) => a.data.localeCompare(b.data));
  const noMes = arr.filter(p => (p.data || "").startsWith(mesISO));
  if (noMes.length === 0) {
    return { patrimonioFim: null, patrimonioIni: null, variacao: null, variacaoPct: null };
  }
  const antes = arr.filter(p => (p.data || "") < `${mesISO}-01`);
  const iniSnap = antes.length ? antes[antes.length - 1] : noMes[0];
  const ini = Number(iniSnap.total) || 0;
  const fim = Number(noMes[noMes.length - 1].total) || 0;
  const variacao = fim - ini;
  const variacaoPct = ini > 0 ? (variacao / ini) * 100 : null;
  return { patrimonioFim: fim, patrimonioIni: ini, variacao, variacaoPct };
}

/**
 * Relatório mensal completo (finanças + investimentos).
 * @param {string} mesISO  ex.: "2026-07"
 * @param {object} state   { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques }
 * @param {string} escopo  "tudo" | "pessoal" | "negocio"
 * @param {Array}  patrimonioHistorico  snapshots [{ data, total }]
 */
export function relatorioMensal(mesISO, state = {}, escopo = "tudo", patrimonioHistorico = []) {
  const fin = financasDoMes(mesISO, state, escopo);
  const antMes = mesAnteriorISO(mesISO);
  const anterior = financasDoMes(antMes, state, escopo);

  const deltaPct = (atual, ant) => (ant > 0 ? ((atual - ant) / ant) * 100 : null);
  const financas = {
    ...fin,
    anterior: { receitas: anterior.receitas, despesas: anterior.despesas, sobra: anterior.sobra },
    deltaReceitas: deltaPct(fin.receitas, anterior.receitas),
    deltaDespesas: deltaPct(fin.despesas, anterior.despesas),
    deltaSobra: fin.sobra - anterior.sobra,
  };

  const mov = movimentacoesInvestMes(state.transacoes || [], mesISO);
  const patr = patrimonioNoMes(mesISO, patrimonioHistorico);
  // Proventos agrupados por tipo (Dividendo/JCP/Rendimento) — resumo pro PDF.
  const provMap = {};
  (mov.proventos || []).forEach(p => { provMap[p.tipo || "Provento"] = (provMap[p.tipo || "Provento"] || 0) + (Number(p.valor) || 0); });
  const proventosPorTipo = Object.entries(provMap)
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, valor]) => ({ tipo, valor }));
  const invest = { ...mov, ...patr, proventosPorTipo };

  return { mes: mesISO, financas, invest };
}
