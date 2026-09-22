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

/**
 * BASE ÚNICA de consumo por categoria do mês — usada em TODO lugar que
 * mostra "gasto por categoria" (Análise do mês, donut do Painel, página
 * Categorias, PDF). Regras:
 *  - fora: transferências, foraDoRelatorio, pagamento de fatura, categorias
 *    de movimentação (investimento/aporte/resgate/depósito);
 *  - fatura importada ABERTA entra pelos ITENS reais (compras à vista
 *    pendentes com a categoria própria + parcelas do mês do cartão), nunca
 *    pelo lump "Cartão · fatura".
 * Cada item: { id, data, descricao, valor, status, categoria, subcategoria }.
 */
export function itensConsumoDoMes(mesISO, state = {}, escopo = "tudo") {
  let desp = [];
  try { desp = getDespesasDoMes(mesISO, state, escopo) || []; } catch { desp = []; }
  const transferIds = new Set((state.transacoes || []).filter(t => t && t.transferenciaId).map(t => t.id));
  const foraIds = new Set((state.transacoes || []).filter(t => t && t.foraDoRelatorio).map(t => t.id));
  const pagIds = new Set((state.transacoes || [])
    .filter(t => ehPagCartao(t) && String(t.data || "").startsWith(mesISO)).map(t => t.id));
  const gastos = desp.filter(x =>
    !transferIds.has(x.id) && !ehCategoriaTransfer(x.categoria) && !foraIds.has(x.id)
    && !pagIds.has(x.id) && !naoEhGasto(x.categoria) && !x.transferenciaId);

  // O lump "Cartão · fatura" nunca entra no consumo (as compras contam uma a uma).
  const out = gastos.filter(g => g.categoria !== "Cartão · fatura");

  // Compras DENTRO de fatura importada (origem "fatura-<banco>", pendentes):
  // o agregador as esconde — a fatura conta como bloco no mês de COMPETÊNCIA
  // (que pode ser o mês seguinte!). No consumo elas contam na DATA da compra,
  // com a categoria própria, seja de qual fatura forem. As compensadas já
  // entram pelo agregador normalmente.
  (state.transacoes || []).forEach(t => {
    if (!t || t.tipo !== "despesa") return;
    if (!(typeof t.origem === "string" && t.origem.startsWith("fatura-")) || t.origem === "fatura-pagamento") return;
    if (t.compensado) return;
    if (!String(t.data || "").startsWith(mesISO)) return;
    if (foraIds.has(t.id) || ehCategoriaTransfer(t.categoria) || naoEhGasto(t.categoria)) return;
    out.push({
      id: t.id, data: t.data, descricao: t.descricao || "Compra no cartão",
      valor: Number(t.valor) || 0, status: "pendente",
      categoria: t.categoria || "Outros", subcategoria: t.subcategoria || "",
    });
  });

  // Parcelas pendentes escondidas pela fatura importada ABERTA deste mês
  // (o agregador as pula porque o valor está dentro do lump).
  const cartoesFaturaAberta = new Set(
    (state.cartoes || [])
      .filter(c => c?.faturaImportada && !c.faturaImportada.paga && c.faturaImportada.competencia === mesISO)
      .map(c => c.id)
  );
  (state.parcelamentos || []).forEach(p => {
    if (!p || !cartoesFaturaAberta.has(p.cartaoId) || !p.dataPrimeira || !p.totalParcelas) return;
    if (naoEhGasto(p.categoria)) return;
    const base = new Date(p.dataPrimeira);
    const by = base.getFullYear(), bm = base.getMonth(), bd = base.getDate();
    for (let i = 1; i <= p.totalParcelas; i++) {
      const d = new Date(by, bm + (i - 1), 1);
      d.setDate(Math.min(bd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      const iso = d.toISOString().slice(0, 10);
      if (!iso.startsWith(mesISO)) continue;
      if ((p.parcelasPagas || []).includes(i)) continue; // pagas já vêm do agregador
      out.push({
        id: `${p.id}::${i}`, data: iso, descricao: `${p.descricao} ${i}/${p.totalParcelas}`,
        valor: Number(p.valorParcela) || (Number(p.valorTotal) / p.totalParcelas) || 0,
        status: "pendente",
        categoria: p.categoria || "Cartão · parcelamento", subcategoria: "",
      });
    }
  });
  return out;
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
  // "Despesas por categoria" = só o que foi pago pelos BANCOS (não-cartão). As
  // compras/parcelas de cartão aparecem separadas no bloco "Cartões · detalhe",
  // pra não contar duas vezes na mesma tela.
  const cartaoTxIds = new Set((state.transacoes || []).filter(t => t && t.cartaoId).map(t => t.id));
  const ehDeCartao = (d) => d.fonte === "parcela" || cartaoTxIds.has(d.id);
  const gastosBancos = gastos.filter(d => !ehDeCartao(d));
  const categorias = agruparCategoria(gastosBancos);
  const despesasBancos = gastosBancos.reduce((s, d) => s + (Number(d.valor) || 0), 0);
  const despesasCartoes = gastos.filter(ehDeCartao).reduce((s, d) => s + (Number(d.valor) || 0), 0);
  // Consumo por categoria: BASE ÚNICA compartilhada com Painel/Categorias
  // (fatura importada aberta entra pelos itens — ver itensConsumoDoMes).
  const gastosConsumo = itensConsumoDoMes(mesISO, state, escopo);

  // Resumo geral: bancos + cartões juntos (o gasto real do mês), agrupado por
  // categoria PAI (ordem alfabética) com as subcategorias E FILHAS embaixo.
  const catPorId = {};
  (state.categorias || []).forEach(c => { if (c?.id) catPorId[c.id] = c; });
  const paiDe = {};
  (state.categorias || []).forEach(c => {
    if (c?.parentId && catPorId[c.parentId]) paiDe[(c.nome || "").trim()] = (catPorId[c.parentId].nome || "").trim();
  });
  const categoriasGeral = agruparHierarquia(gastosConsumo, paiDe);
  const despesasGeral = gastosConsumo.reduce((s, d) => s + (Number(d.valor) || 0), 0); // = soma das categorias
  const itensConsumo = gastosConsumo; // itens por trás do ranking (drill-down da tela)
  // Receitas agrupadas por categoria (resumo, não item a item).
  const receitasCategorias = agruparCategoria(gan);

  return {
    receitas, despesas, sobra: receitas - despesas, pagas, aPagar,
    categorias, categoriasGeral, despesasGeral, itensConsumo, receitasCategorias,
    despesasBancos, despesasCartoes, pagamentosCartao, totalPagamentosCartao,
  };
}

// Agrupa por categoria PAI (com subcategorias FILHO), em ordem alfabética.
// Cada pai: { nome, valor, pct (do total), filhos: [{ nome, valor, pct (do pai) }] }.
function agruparHierarquia(itens, paiDe = {}) {
  const pais = {};
  itens.forEach(x => {
    const catNome = String(x.categoria || "").trim() || "Outros";
    // Categoria FILHA (parentId) soma dentro da mãe, aparecendo como filho —
    // igual à página Categorias (gastoDe) e ao filtro do Calendário.
    const p = paiDe[catNome] || catNome;
    if (!pais[p]) pais[p] = { nome: p, valor: 0, filhos: {} };
    const v = Number(x.valor) || 0;
    pais[p].valor += v;
    const f = paiDe[catNome] ? catNome : String(x.subcategoria || "").trim();
    if (f) pais[p].filhos[f] = (pais[p].filhos[f] || 0) + v;
  });
  const tot = Object.values(pais).reduce((s, p) => s + p.valor, 0) || 1;
  const colator = (a, b) => a.localeCompare(b, "pt", { sensitivity: "base" });
  return Object.values(pais)
    .sort((a, b) => colator(a.nome, b.nome))
    .map(p => ({
      nome: p.nome, valor: p.valor, pct: (p.valor / tot) * 100,
      filhos: Object.entries(p.filhos)
        .sort((a, b) => colator(a[0], b[0]))
        .map(([nome, valor]) => ({ nome, valor, pct: p.valor > 0 ? (valor / p.valor) * 100 : 0 })),
    }));
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

/* ============================================================
   POSIÇÃO CONSOLIDADA + LEITURA DO CONSULTOR (puros, pro PDF)
   ============================================================ */

// Posição consolidada de AGORA: contas + carteira de proventos +
// investimentos (Brasil) − cartões em aberto = líquido. US$ à parte.
export function posicaoConsolidada({ contas = [], ativos = [], parcelamentos = [], carteiraProventos = {}, saldoContaBRL } = {}) {
  const somaContas = (contas || []).filter(c => c && !c.foraPatrimonio)
    .reduce((s, c) => s + (saldoContaBRL ? saldoContaBRL(c) : (Number(c.saldo) || 0)), 0);
  const proventos = Number(carteiraProventos?.saldo) || 0;
  let investBR = 0, investUSD = 0;
  for (const a of ativos || []) {
    const v = (Number(a?.qtd) || 0) * (Number(a?.preco) || 0);
    if (a?.tipo === "stock" || a?.tipo === "reit") investUSD += v; else investBR += v;
  }
  const cartoesAbertos = (parcelamentos || []).reduce((s, p) => {
    const total = p?.totalParcelas || 0;
    if (total <= 0) return s;
    const vpp = Number(p.valorParcela) || (p.valorTotal || 0) / total;
    return s + vpp * Math.max(0, total - (p.parcelasPagas || []).length);
  }, 0);
  return {
    contas: somaContas, proventos, investBR, investUSD, cartoesAbertos,
    liquido: somaContas + proventos + investBR - cartoesAbertos,
  };
}

// Leitura do consultor: 3–6 frases automáticas sobre o mês, tiradas dos
// mesmos números do relatório (nada inventado).
export function leituraConsultor({ financas: f, mesISO, mapaGastos = null, insightFds = null, fmt = (v) => String(v) } = {}) {
  const frases = [];
  if (!f) return frases;

  // 1. Taxa de poupança
  if (f.receitas > 0) {
    const taxa = (f.sobra / f.receitas) * 100;
    if (f.sobra >= 0) {
      frases.push(`Você poupou ${taxa.toFixed(0)}% da renda do mês (${fmt(f.sobra)} de ${fmt(f.receitas)})${taxa >= 20 ? " — acima da regra dos 20%, ótimo sinal" : taxa >= 10 ? " — dentro do razoável; a meta clássica é 20%" : " — abaixo dos 10%; vale caçar o vazamento nas maiores categorias"}.`);
    } else {
      frases.push(`O mês fechou NO VERMELHO: as despesas superaram a renda em ${fmt(Math.abs(f.sobra))}. Prioridade: cortar nas 2 maiores categorias abaixo.`);
    }
  }

  // 2. Maior categoria vs renda
  const top = (f.categoriasGeral || f.categorias || [])[0];
  if (top && f.receitas > 0) {
    const pctRenda = (top.valor / f.receitas) * 100;
    frases.push(`"${top.nome}" foi o maior destino do dinheiro: ${fmt(top.valor)} (${pctRenda.toFixed(0)}% da renda).`);
  }

  // 3. Comparação com o mês anterior
  if (f.deltaDespesas != null) {
    frases.push(f.deltaDespesas >= 0
      ? `Os gastos SUBIRAM ${f.deltaDespesas.toFixed(0)}% em relação ao mês anterior.`
      : `Os gastos CAÍRAM ${Math.abs(f.deltaDespesas).toFixed(0)}% em relação ao mês anterior — mantenha o ritmo.`);
  }

  // 4. Dia de pico + média diária (do mapa de gastos do calendário)
  if (mapaGastos && mapaGastos.diaMax) {
    const nDias = Object.keys(mapaGastos.porDia).length;
    const media = nDias > 0 ? mapaGastos.total / nDias : 0;
    frases.push(`O dia mais pesado foi ${String(mapaGastos.diaMax).padStart(2, "0")}/${String(mesISO).slice(5, 7)} (${fmt(mapaGastos.max)}); nos ${nDias} dias com gasto, a média foi ${fmt(media)}/dia.`);
  }

  // 5. Padrão fim de semana × dias úteis
  if (insightFds) {
    frases.push(insightFds.tipo === "fds"
      ? `Padrão que dói: fins de semana custam ${String(insightFds.ratio).replace(".", ",")}× mais que dias úteis.`
      : `Curioso: os dias úteis custam ${String(insightFds.ratio).replace(".", ",")}× mais que os fins de semana.`);
  }

  return frases;
}
