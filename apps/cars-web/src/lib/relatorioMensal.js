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
// "transf" (não "transfer") pega também "Transf entre bancos".
const naoEhGasto = (nome) => /investim|transf|dep[oó]sito|aporte|resgate/i.test(String(nome || ""));

// Transferência entre bancos (por qualquer nome: "Transf entre bancos",
// "Transferência", …): mesmo dinheiro mudando de conta, fora do relatório.
const ehCategoriaTransfer = (nome) => /transf/i.test(String(nome || ""));

// Pagamento de fatura de cartão (a "baixa"): informativo, não soma (as compras
// já entram individualmente). Marcado por origem "fatura-pagamento" ou descrição.
const ehPagCartao = (t) => !!t && (t.origem === "fatura-pagamento" || /pagamento\s+(de\s+)?fatura/i.test(t.descricao || ""));

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
  // Lançamentos marcados manualmente pra NÃO entrar no relatório (foraDoRelatorio).
  const foraIds = new Set(
    (state.transacoes || []).filter(t => t && t.foraDoRelatorio).map(t => t.id)
  );
  // Pagamentos de fatura de cartão do mês — INFORMATIVO (não somam): as
  // compras/parcelas já entram individualmente, então contar o pagamento
  // dobraria. Identificados por origem "fatura-pagamento" ou pela descrição.
  const pagamentosCartao = (state.transacoes || [])
    .filter(t => ehPagCartao(t) && String(t.data || "").startsWith(mesISO))
    .map(t => ({ id: t.id, data: t.data, descricao: t.descricao || "Pagamento de fatura", valor: Number(t.valor) || 0 }))
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const totalPagamentosCartao = pagamentosCartao.reduce((s, p) => s + p.valor, 0);
  const pagIds = new Set(pagamentosCartao.map(p => p.id));

  // Fora se: é transferência (id/categoria), o usuário marcou pra ocultar, ou é
  // um pagamento de fatura de cartão (só informativo).
  const ehTransfer = (x) => transferIds.has(x.id) || ehCategoriaTransfer(x.categoria);
  const real = (arr) => arr.filter(x => !ehTransfer(x) && !foraIds.has(x.id) && !pagIds.has(x.id));
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

  return {
    receitas, despesas, sobra: receitas - despesas, pagas, aPagar,
    categorias, receitasCategorias, pagamentosCartao, totalPagamentosCartao,
  };
}

// Detalhamento por CARTÃO (informativo — as compras já estão no total geral):
// para cada cartão, as categorias do mês (compras lançadas no cartão + parcelas
// que vencem no mês) separadas, o total e o pagamento de fatura do mês.
function cartoesDoMes(mesISO, state) {
  const cards = state.cartoes || [];
  const trans = state.transacoes || [];
  const parcels = state.parcelamentos || [];
  const foraIds = new Set(trans.filter(t => t && t.foraDoRelatorio).map(t => t.id));

  const out = cards.map(card => {
    const m = {};
    // 1) Compras lançadas neste cartão (transações despesa com cartaoId, do mês).
    trans.forEach(t => {
      if (t.tipo !== "despesa" || t.cartaoId !== card.id) return;
      if (!String(t.data || "").startsWith(mesISO)) return;
      if (foraIds.has(t.id) || ehPagCartao(t)) return;
      const k = t.categoria || "Outros";
      m[k] = (m[k] || 0) + (Number(t.valor) || 0);
    });
    // 2) Parcelas deste cartão que vencem no mês (categoria do parcelamento).
    parcels.forEach(p => {
      if (p.cartaoId !== card.id || !p.dataPrimeira || !p.totalParcelas) return;
      const base = new Date(p.dataPrimeira);
      const by = base.getFullYear(), bm = base.getMonth(), bd = base.getDate();
      for (let i = 1; i <= p.totalParcelas; i++) {
        const d = new Date(by, bm + (i - 1), 1);
        d.setDate(Math.min(bd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
        if (!d.toISOString().slice(0, 10).startsWith(mesISO)) continue;
        const k = String(p.categoria || "").trim() || "Cartão · parcelamento";
        m[k] = (m[k] || 0) + (Number(p.valorParcela) || (Number(p.valorTotal) / p.totalParcelas) || 0);
      }
    });
    const categorias = agruparCategoria(Object.entries(m).map(([categoria, valor]) => ({ categoria, valor })));
    const total = categorias.reduce((s, c) => s + c.valor, 0);
    const pagamento = trans
      .filter(t => ehPagCartao(t) && t.cartaoId === card.id && String(t.data || "").startsWith(mesISO))
      .reduce((s, t) => s + (Number(t.valor) || 0), 0);
    return { id: card.id, nome: card.nome || "Cartão", total, categorias, pagamento };
  }).filter(c => c.total > 0 || c.pagamento > 0);

  out.sort((a, b) => (b.total + b.pagamento) - (a.total + a.pagamento));
  return out;
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

  // Detalhamento por cartão (informativo).
  const cartoes = cartoesDoMes(mesISO, state);

  return { mes: mesISO, financas, invest, cartoes };
}
