// Agregador único para Planejamento + Calendário + Despesas + Controle Anual.
// Unifica fontes de despesa (fixas, dívidas, parcelas, transações) e ganhos
// num formato comum por mês.
//
// Cada item de despesa carrega DOIS rótulos:
//   - fonte: "fixa" | "divida" | "parcela" | "transacao"   (origem do dado)
//   - tipo:  "fixa" | "variavel" | "parcela" | "ganho"     (classificação semântica)

import { somaContasBRL } from "./cambio.js";

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
    cheques: (state.cheques || []).filter(noEscopo),
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
  const fixasMaterializadas = new Set();
  (state.fixaOcorrencias || []).forEach(o => {
    if (o.mes !== mesISO) return;
    if (!fixaExiste(o.fixaId)) return;
    fixasMaterializadas.add(o.fixaId);
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
      subcategoria: getFixaSubcategoria(o.fixaId, state),
    });
  });

  // 1b. Fixas SEM ocorrência materializada neste mês (ex.: anos futuros ainda
  //     não gerados). Uma fixa recorre indefinidamente, então mostramos uma
  //     ocorrência VIRTUAL (pendente) pra ela não sumir do relatório/projeção.
  //     Respeita inicioEm/terminoEm (compare "YYYY-MM" direto).
  (state.fixas || []).forEach(f => {
    if (fixasMaterializadas.has(f.id)) return;
    if (f.inicioEm && mesISO < String(f.inicioEm).slice(0, 7)) return;
    if (f.terminoEm && mesISO > String(f.terminoEm).slice(0, 7)) return;
    const dia = String(Math.min(Math.max(parseInt(f.diaVencimento, 10) || 1, 1), 28)).padStart(2, "0");
    const dataVenc = `${mesISO}-${dia}`;
    out.push({
      id: `occ-virtual-${f.id}-${mesISO}`,
      fonte: "fixa",
      tipo: "fixa",
      descricao: getFixaDescricao(f.id, state),
      data: dataVenc,
      valor: Number(f.valor) || 0,
      status: dataVenc < hoje ? "atrasada" : "pendente",
      categoria: getFixaCategoria(f.id, state),
      subcategoria: getFixaSubcategoria(f.id, state),
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
    // A baixa do pagamento de fatura importada é só transferência (a despesa
    // são os itens importados) — não conta como despesa.
    if (t.origem === "fatura-pagamento") return;
    // Empréstimo a terceiro: emprestar (saída) e a devolução do principal são
    // movimento de capital — NÃO contam como gasto (o dinheiro virou "a receber").
    if (t.emprestimoSaida || t.emprestimoRetorno) return;
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
      subcategoria: t.subcategoria || "",
    });
  });

  return out.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
}

/**
 * Retorna ganhos previstos/realizados do mês.
 * Cada item: { id, fonte, tipo: "ganho", descricao, data, valor, status, categoria }
 */
export function getGanhosDoMes(mesISO, state = {}, escopo, opts = {}) {
  state = aplicarEscopo(state, escopo);
  // incluirAtrasados: pendências com vencimento em MÊS ANTERIOR entram neste
  // mês com status "atrasada" (útil na projeção, que começa no mês corrente —
  // sem isto, um a-receber vencido simplesmente sumia do relatório).
  const { incluirAtrasados = false } = opts;
  const mesOuAtrasado = (iso) => {
    const m = (iso || "").slice(0, 7);
    if (!m) return null;
    if (m === mesISO) return "no-mes";
    if (incluirAtrasados && m < mesISO) return "atrasado";
    return null;
  };
  const out = [];

  // 1. Devedores com recebimento no mês
  (state.devedores || []).forEach(d => {
    // Empréstimo a terceiro: juros por COMPETÊNCIA (jurosMensal em cada mês do
    // período) + o PRINCIPAL (pendente "a receber" até a quitação; depois conta
    // como receita no mês do recebimento). As transações da baixa são ignoradas
    // na seção 2 — o ganho vem daqui.
    if (d.emprestimo) {
      const meses = Math.max(1, parseInt(d.meses, 10) || 1);
      const jurosMensal = (Number(d.jurosMensal) || 0) > 0
        ? Number(d.jurosMensal)
        : +(((Number(d.juros) || 0) / meses)).toFixed(2); // fallback p/ empréstimos antigos
      const baseISO = (d.dataEmprestimo || d.vencimento || "").slice(0, 7);
      const jurosRecebidos = new Set(Array.isArray(d.jurosRecebidos) ? d.jurosRecebidos : []);
      // Juros — 1 lançamento por mês do período (paga se aquele mês já foi recebido).
      if (jurosMensal > 0 && baseISO) {
        const [by, bm] = baseISO.split("-").map(Number);
        const [my, mm] = mesISO.split("-").map(Number);
        const offset = (my - by) * 12 + (mm - bm);
        if (offset >= 0 && offset < meses) {
          out.push({
            id: `${d.id}::juros::${offset}`, fonte: "devedor", tipo: "ganho",
            descricao: `Juros de ${d.nome} (${offset + 1}/${meses})`,
            data: `${mesISO}-15`, valor: jurosMensal,
            status: jurosRecebidos.has(mesISO) ? "paga" : "pendente",
            categoria: "Juros de empréstimo",
          });
        }
      }
      // Principal — pendente até a quitação; depois vira "Quitação" (paga).
      const principal = Number(d.principal) || Number(d.valor) || 0;
      if (d.recebido) {
        if ((d.dataRecebimento || "").startsWith(mesISO)) {
          out.push({
            id: `${d.id}::quit`, fonte: "devedor", tipo: "ganho",
            descricao: `Quitação de ${d.nome}`,
            data: d.dataRecebimento, valor: principal,
            status: "paga", categoria: "Empréstimo (devolução)",
          });
        }
      } else if (principal > 0) {
        let princISO = (d.vencimento || "").slice(0, 7);
        if (!princISO && baseISO) {
          const [by, bm] = baseISO.split("-").map(Number);
          const dt = new Date(by, bm - 1 + (meses - 1), 1);
          princISO = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
        }
        if (princISO === mesISO || (incluirAtrasados && princISO && princISO < mesISO)) {
          out.push({
            id: `${d.id}::princ`, fonte: "devedor", tipo: "ganho",
            descricao: `A receber (principal) de ${d.nome}`,
            data: `${mesISO}-28`, valor: principal,
            status: princISO === mesISO ? "pendente" : "atrasada", categoria: "Empréstimo (principal)",
          });
        }
      }
      return;
    }
    if (d.recebido) {
      if (!(d.dataRecebimento || "").startsWith(mesISO)) return;
      out.push({
        id: d.id, fonte: "devedor", tipo: "ganho",
        descricao: `Receb. de ${d.nome}`,
        data: d.dataRecebimento, valor: Number(d.valor) || 0,
        status: "paga", categoria: d.categoria || "Receita",
      });
    } else {
      const quando = mesOuAtrasado(d.vencimento);
      if (!quando) return;
      // Recebimento PARCIAL: o que resta a receber é valor − valorRecebido.
      const aberto = (Number(d.valor) || 0) - (Number(d.valorRecebido) || 0);
      if (aberto <= 0.005) return;
      out.push({
        id: d.id, fonte: "devedor", tipo: "ganho",
        descricao: `A receber de ${d.nome}`,
        data: d.vencimento, valor: aberto,
        status: quando === "atrasado" ? "atrasada" : "pendente", categoria: d.categoria || "Receita",
      });
    }
  });

  // 2. Transações tipo "receita" do mês
  (state.transacoes || []).forEach(t => {
    if (t.tipo !== "receita") return;
    // Empréstimo: juros e quitação entram por competência (seção 1, via devedor);
    // as transações da baixa são só lançamento de caixa/extrato — não recontam.
    if (t.emprestimoRetorno || t.emprestimoSaida || t.emprestimoJuros) return;
    if (!(t.data || "").startsWith(mesISO)) return;
    out.push({
      id: t.id, fonte: "transacao", tipo: "ganho",
      descricao: t.descricao || "Receita",
      data: t.data, valor: Number(t.valor) || 0,
      status: t.compensado ? "paga" : "pendente",
      categoria: t.categoria || "Receita",
      subcategoria: t.subcategoria || "",
    });
  });

  // 3. Cheques aguardando — recebível pendente no mês do vencimento.
  // (Compensado entra pela transação tipo receita; devolvido não conta.)
  (state.cheques || []).forEach(c => {
    if (c.status !== "aguardando") return;
    const quando = mesOuAtrasado(c.vencimento);
    if (!quando) return;
    out.push({
      id: `cheque::${c.id}`, fonte: "cheque", tipo: "ganho",
      descricao: `Cheque de ${c.de || "—"}`,
      data: c.vencimento, valor: Number(c.valor) || 0,
      status: quando === "atrasado" ? "atrasada" : "pendente", categoria: "Cheques",
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
  const saldoInicial = somaContasBRL(st.contas || []);

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
function getFixaSubcategoria(fixaId, state) {
  const f = (state.fixas || []).find(x => x.id === fixaId);
  return f?.subcategoria || "";
}
