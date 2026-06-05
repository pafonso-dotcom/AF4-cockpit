// Agregador único para Planejamento + Calendário + Despesas + Controle Anual.
// Unifica fontes de despesa (fixas, dívidas, parcelas, transações) e ganhos
// num formato comum por mês.
//
// Cada item de despesa carrega DOIS rótulos:
//   - fonte: "fixa" | "divida" | "parcela" | "transacao"   (origem do dado)
//   - tipo:  "fixa" | "variavel" | "parcela" | "ganho"     (classificação semântica)

const MES_LEN = 7; // "YYYY-MM"

export function mesAtual(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Filtra o state pelo escopo ativo (Pessoal / Negócio).
 * Restringe contas ao escopo, e transações às contas restantes.
 * Itens sem `escopo` são tratados como "pessoal" (legado).
 * Se escopo for "tudo" ou ausente, devolve o state intacto.
 */
function aplicarEscopo(state, escopo) {
  if (!escopo || escopo === "tudo") return state;
  const noEscopo = (x) => (x?.escopo || "pessoal") === escopo;
  const contasFiltradas = (state.contas || []).filter(noEscopo);
  const nomesContas = new Set(contasFiltradas.map(c => c.nome));
  const transacoesFiltradas = (state.transacoes || []).filter(t => nomesContas.has(t.conta));
  const categoriasFiltradas = (state.categorias || []).filter(noEscopo);
  // Fixas, dívidas, parcelamentos e devedores também respeitam o escopo
  // (default "pessoal" para os antigos). Sem isto, um compromisso do negócio
  // entrava nas estatísticas pessoais e vice-versa.
  return {
    ...state,
    contas: contasFiltradas,
    transacoes: transacoesFiltradas,
    categorias: categoriasFiltradas,
    fixas: (state.fixas || []).filter(noEscopo),
    dividas: (state.dividas || []).filter(noEscopo),
    parcelamentos: (state.parcelamentos || []).filter(noEscopo),
    devedores: (state.devedores || []).filter(noEscopo),
  };
}

/**
 * Classifica uma transação genérica em fixa | variavel | parcela | ganho.
 * Usado para mapear o histórico legado (transacoes[]) nos novos buckets.
 */
export function classificarTransacao(tx, state = {}) {
  if (!tx) return "variavel";
  if (tx.tipo === "receita") return "ganho";
  if (tx.origemFixaOcorrenciaId) return "fixa";
  if (tx.fixa) return "fixa";
  // Parcela só quando há um marcador "X/Y" ISOLADO (precedido de espaço/início)
  // com X ≤ Y e Y ≥ 2 — evita apanhar datas coladas ao texto (ex.: "BR31/05").
  if (typeof tx.descricao === "string") {
    const m = tx.descricao.match(/(?:^|\s)(\d{1,3})\s*\/\s*(\d{1,3})(?=\s|$)/);
    if (m) {
      const a = +m[1], b = +m[2];
      if (a >= 1 && b >= 2 && a <= b && b <= 120) return "parcela";
    }
  }
  const eParcela = (state.parcelamentos || []).some(p =>
    p.descricao && tx.descricao &&
    tx.descricao.toLowerCase().includes(p.descricao.toLowerCase())
  );
  if (eParcela) return "parcela";
  return "variavel";
}

/**
 * Retorna todas as despesas previstas/realizadas do mês, normalizadas.
 * Cada item: { id, fonte, tipo, descricao, data, valor, status, categoria }
 *   fonte:  "fixa" | "divida" | "parcela" | "transacao"
 *   tipo:   "fixa" | "variavel" | "parcela"  (despesas; ganhos vão em getGanhosDoMes)
 *   status: "paga" | "pendente" | "atrasada"
 */
export function getDespesasDoMes(mesISO, state = {}, escopo) {
  state = aplicarEscopo(state, escopo);
  const out = [];
  const hoje = new Date().toISOString().slice(0, 10);

  // 1. Fixas (via fixaOcorrencias — modelo novo)
  // Ocorrência órfã (cuja fixa foi apagada) não conta — senão a despesa
  // continua aparecendo nos relatórios mesmo depois de excluída.
  const fixaExiste = (id) => (state.fixas || []).some(f => f.id === id);
  (state.fixaOcorrencias || []).forEach(o => {
    if (o.mes !== mesISO) return;
    if (!fixaExiste(o.fixaId)) return;
    const status = o.status === "paga"
      ? "paga"
      : (o.dataVencimento && o.dataVencimento < hoje ? "atrasada" : "pendente");
    out.push({
      id: o.id,
      fonte: "fixa",
      tipo: "fixa",
      descricao: getFixaDescricao(o.fixaId, state),
      data: o.dataVencimento,
      valor: Number(o.valorPago ?? o.valor) || 0,
      status,
      categoria: getFixaCategoria(o.fixaId, state),
    });
  });

  // 2. Dívidas com vencimento no mês (variável, mas com cara própria)
  (state.dividas || []).forEach(d => {
    if (!d.vencimento || !d.vencimento.startsWith(mesISO)) return;
    const status = d.pago
      ? "paga"
      : (d.vencimento < hoje ? "atrasada" : "pendente");
    out.push({
      id: d.id,
      fonte: "divida",
      tipo: "variavel",
      descricao: d.nome + (d.parcela ? ` ${d.parcela}` : ""),
      data: d.vencimento,
      valor: Number(d.valor) || 0,
      status,
      categoria: d.categoria || "Dívida",
    });
  });

  // 3. Parcelas de cartão com vencimento no mês
  (state.parcelamentos || []).forEach(p => {
    if (!p.dataPrimeira || !p.totalParcelas) return;
    const base = new Date(p.dataPrimeira);
    const by = base.getFullYear(), bm = base.getMonth(), bd = base.getDate();
    for (let i = 1; i <= p.totalParcelas; i++) {
      const d = new Date(by, bm + (i - 1), 1);
      d.setDate(Math.min(bd, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      const iso = d.toISOString().slice(0, 10);
      if (!iso.startsWith(mesISO)) continue;
      const paga = (p.parcelasPagas || []).includes(i);
      const status = paga ? "paga" : (iso < hoje ? "atrasada" : "pendente");
      out.push({
        id: `${p.id}::${i}`,
        fonte: "parcela",
        tipo: "parcela",
        descricao: `${p.descricao} ${i}/${p.totalParcelas}`,
        data: iso,
        valor: Number(p.valorParcela) || (Number(p.valorTotal) / p.totalParcelas) || 0,
        status,
        categoria: p.categoria || "Cartão · parcelamento",
      });
    }
  });

  // 4. Transações tipo "despesa" do mês (variáveis e fixas legadas)
  (state.transacoes || []).forEach(t => {
    if (t.tipo !== "despesa") return;
    if (!(t.data || "").startsWith(mesISO)) return;
    // Evita duplicata: pagamentos de fixa/parcela/dívida (criados na baixa do
    // Planejamento) já são contados pela própria fixa/parcela/dívida. A
    // transação "Pagamento para X" carrega o vínculo de origem e é ignorada.
    if (t.origemFixaOcorrenciaId || t.origemParcelamentoId || t.origemDividaId) return;
    const status = t.compensado
      ? "paga"
      : (t.data < hoje ? "atrasada" : "pendente");
    const tipo = classificarTransacao(t, state); // fixa | variavel | parcela
    out.push({
      id: t.id,
      fonte: "transacao",
      tipo: tipo === "ganho" ? "variavel" : tipo, // ganho não cai aqui mas garante shape
      descricao: t.descricao || "Despesa",
      data: t.data,
      valor: Number(t.valor) || 0,
      status,
      categoria: t.categoria || "Outros",
    });
  });

  return out.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

/**
 * Retorna ganhos previstos/realizados do mês.
 * Cada item: { id, fonte, tipo: "ganho", descricao, data, valor, status, categoria }
 */
export function getGanhosDoMes(mesISO, state = {}, escopo) {
  state = aplicarEscopo(state, escopo);
  const out = [];

  // 1. Devedores com recebimento no mês
  (state.devedores || []).forEach(d => {
    if (d.recebido) {
      if (!(d.dataRecebimento || "").startsWith(mesISO)) return;
      out.push({
        id: d.id, fonte: "devedor", tipo: "ganho",
        descricao: `Receb. de ${d.nome}`,
        data: d.dataRecebimento, valor: Number(d.valor) || 0,
        status: "paga", categoria: d.categoria || "Receita",
      });
    } else if (d.vencimento && d.vencimento.startsWith(mesISO)) {
      out.push({
        id: d.id, fonte: "devedor", tipo: "ganho",
        descricao: `A receber de ${d.nome}`,
        data: d.vencimento, valor: Number(d.valor) || 0,
        status: "pendente", categoria: d.categoria || "Receita",
      });
    }
  });

  // 2. Transações tipo "receita" do mês
  (state.transacoes || []).forEach(t => {
    if (t.tipo !== "receita") return;
    if (!(t.data || "").startsWith(mesISO)) return;
    out.push({
      id: t.id, fonte: "transacao", tipo: "ganho",
      descricao: t.descricao || "Receita",
      data: t.data, valor: Number(t.valor) || 0,
      status: t.compensado ? "paga" : "pendente",
      categoria: t.categoria || "Receita",
    });
  });

  return out.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

/**
 * Agrupa uma lista de itens (despesas/ganhos) por categoria.
 * Retorna [{ categoria, total, qtd, items[] }, ...] ordenado por total desc.
 */
export function agruparPorCategoria(items = []) {
  const mapa = new Map();
  for (const it of items) {
    const cat = it.categoria || "Outros";
    const grupo = mapa.get(cat) || { categoria: cat, total: 0, qtd: 0, items: [] };
    grupo.total += Number(it.valor) || 0;
    grupo.qtd += 1;
    grupo.items.push(it);
    mapa.set(cat, grupo);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

/**
 * KPIs consolidados do mês.
 * Inclui contagens separadas por tipo: qtdFixas / qtdVariaveis / qtdParcelas.
 */
export function getKPIsMes(mesISO, state = {}, escopo) {
  const desp = getDespesasDoMes(mesISO, state, escopo);
  const ganhos = getGanhosDoMes(mesISO, state, escopo);

  const totalPrevisto = desp.reduce((s, d) => s + d.valor, 0);
  const totalPago = desp.filter(d => d.status === "paga").reduce((s, d) => s + d.valor, 0);
  const totalAtrasado = desp.filter(d => d.status === "atrasada").reduce((s, d) => s + d.valor, 0);
  const totalPendente = desp.filter(d => d.status === "pendente").reduce((s, d) => s + d.valor, 0);
  const totalGanhos = ganhos.reduce((s, g) => s + g.valor, 0);

  const fixas    = desp.filter(d => d.tipo === "fixa");
  const variaveis = desp.filter(d => d.tipo === "variavel");
  const parcelas = desp.filter(d => d.tipo === "parcela");

  return {
    totalPrevisto, totalPago, totalAtrasado, totalPendente,
    qtdDespesas: desp.length,
    qtdFixas: fixas.length,
    qtdVariaveis: variaveis.length,
    qtdParcelas: parcelas.length,
    totalFixas: fixas.reduce((s, d) => s + d.valor, 0),
    totalVariaveis: variaveis.reduce((s, d) => s + d.valor, 0),
    totalParcelas: parcelas.reduce((s, d) => s + d.valor, 0),
    totalGanhos, qtdGanhos: ganhos.length,
    balancoPrevisto: totalGanhos - totalPrevisto,
  };
}

/**
 * Retorna o ano inteiro decomposto em 12 meses, cada um com totais por tipo.
 * Linha: { m: 0-11, mesISO, fixas, variaveis, parcelas, ganhos, dividasPagas,
 *          balanco, status, despesas[], ganhosItens[] }
 *   status: "fechado" | "em-andamento" | "previsto"
 */
export function getAnualPorMes(ano, state = {}, escopo) {
  const hoje = new Date().toISOString().slice(0, 10);
  const anoCorrente = parseInt(hoje.slice(0, 4), 10);
  const mesCorrenteIdx = parseInt(hoje.slice(5, 7), 10) - 1;

  const result = [];
  for (let m = 0; m < 12; m++) {
    const mesISO = `${ano}-${String(m + 1).padStart(2, "0")}`;
    const despesas = getDespesasDoMes(mesISO, state, escopo);
    const ganhosItens = getGanhosDoMes(mesISO, state, escopo);

    const fixas     = despesas.filter(d => d.tipo === "fixa")    .reduce((s, d) => s + d.valor, 0);
    const variaveis = despesas.filter(d => d.tipo === "variavel" && d.fonte !== "divida")
                              .reduce((s, d) => s + d.valor, 0);
    const parcelas  = despesas.filter(d => d.tipo === "parcela") .reduce((s, d) => s + d.valor, 0);
    const dividasPagas = despesas.filter(d => d.fonte === "divida" && d.status === "paga")
                                  .reduce((s, d) => s + d.valor, 0);
    const ganhos = ganhosItens.reduce((s, g) => s + g.valor, 0);
    const balanco = ganhos - fixas - variaveis - parcelas - dividasPagas;

    let status = "previsto";
    if (ano < anoCorrente || (ano === anoCorrente && m < mesCorrenteIdx)) status = "fechado";
    else if (ano === anoCorrente && m === mesCorrenteIdx) status = "em-andamento";

    result.push({
      m, mesISO,
      fixas, variaveis, parcelas, ganhos, dividasPagas, balanco, status,
      despesas, ganhosItens,
    });
  }
  return result;
}

/**
 * Projeção de saldo dos próximos N meses (default 6).
 * Parte do saldo atual somado de todas as contas (no escopo) e, para cada mês,
 * soma os GANHOS previstos e subtrai as DESPESAS ainda PENDENTES
 * (fixas/variáveis/parcelas/dívidas não pagas). O mês corrente considera só o
 * que ainda falta acontecer (pendentes), já que o que foi pago já está no saldo.
 *
 * Retorna [{ mesISO, label, entradas, saidas, liquido, saldoFim }].
 */
export function getProjecaoSaldo(state = {}, escopo, meses = 6, hoje = new Date()) {
  const st = aplicarEscopo(state, escopo);
  const saldoInicial = (st.contas || []).reduce((s, c) => s + (Number(c.saldo) || 0), 0);

  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const out = [];
  let saldo = saldoInicial;
  for (let i = 0; i < meses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
    const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    // Despesas pendentes do mês (o que já foi pago não conta — já está no saldo).
    const despesas = getDespesasDoMes(mesISO, st, escopo)
      .filter(x => x.status !== "paga");
    const saidas = despesas.reduce((s, x) => s + (Number(x.valor) || 0), 0);

    // Ganhos previstos do mês ainda não recebidos (status != paga).
    const ganhos = getGanhosDoMes(mesISO, st, escopo)
      .filter(g => g.status !== "paga");
    const entradas = ganhos.reduce((s, g) => s + (Number(g.valor) || 0), 0);

    const liquido = entradas - saidas;
    saldo += liquido;
    out.push({
      mesISO,
      label: `${nomes[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      entradas, saidas, liquido, saldoFim: saldo,
    });
  }
  return { saldoInicial, meses: out };
}

/**
 * A partir de um item já produzido pelo getDespesasDoMes (tipo === "parcela"),
 * descobre qual parcelamento + número da parcela ele representa.
 * Retorna { parcId, numero } ou null se não conseguir identificar.
 *
 * Estratégia: o id do item é `${parcelamento.id}::${numero}` (vide getDespesasDoMes).
 */
export function identificarParcelaDoItem(item, parcelamentos = []) {
  if (!item || item.tipo !== "parcela") return null;

  // Caminho rápido: id veio com "::numero"
  if (typeof item.id === "string" && item.id.includes("::")) {
    const [parcId, numStr] = item.id.split("::");
    const numero = parseInt(numStr, 10);
    if (parcId && Number.isFinite(numero)) {
      const existe = parcelamentos.some(p => p.id === parcId);
      if (existe) return { parcId, numero };
    }
  }

  // Fallback: bate descrição + número parsed de "X/Y"
  const matchNum = (item.descricao || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (!matchNum) return null;
  const numero = parseInt(matchNum[1], 10);
  const totalEsperado = parseInt(matchNum[2], 10);

  const itDesc = (item.descricao || "").toLowerCase().replace(/\d+\s*\/\s*\d+/, "").trim();
  const parc = parcelamentos.find(p => {
    const pDesc = (p.descricao || "").toLowerCase();
    if (parseInt(p.totalParcelas || 0, 10) !== totalEsperado) return false;
    return pDesc.includes(itDesc.slice(0, 12)) || itDesc.includes(pDesc.slice(0, 12));
  });

  if (!parc) return null;
  return { parcId: parc.id, numero };
}

// ===== Helpers internos =====
function getFixaDescricao(fixaId, state) {
  const f = (state.fixas || []).find(x => x.id === fixaId);
  return f?.descricao || "Fixa";
}
function getFixaCategoria(fixaId, state) {
  const f = (state.fixas || []).find(x => x.id === fixaId);
  return f?.categoria || "Outros";
}
