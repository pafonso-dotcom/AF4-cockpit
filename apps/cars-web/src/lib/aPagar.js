/**
 * "TUDO A PAGAR" — FONTE ÚNICA (2026-09-30).
 *
 * O Painel/Patrimônio e o Planejamento calculavam o total cada um do seu
 * jeito e divergiam (parcela por valorTotal÷n vs valorParcela; avulsas de
 * conta órfã contadas num e não no outro). Agora os dois consomem ESTA lib —
 * igual por construção.
 *
 * Itens que compõem o "a pagar em aberto" (todos os meses/anos):
 *  - dívidas não pagas;
 *  - ocorrências de despesas fixas pendentes (com a fixa ainda existente);
 *  - parcelas de cartão não pagas (valorParcela explícito quando existe,
 *    senão valorTotal ÷ nº de parcelas — fórmula canônica dos Cartões);
 *    parcelamento sem data entra com vencimento indefinido;
 *  - despesas avulsas não compensadas (sem origem em fixa/parcelamento),
 *    INCLUSIVE de contas renomeadas/inexistentes — a dívida existe
 *    independente da conta.
 */

export function itensAPagar({ dividas = [], fixas = [], fixaOcorrencias = [], parcelamentos = [], transacoes = [] } = {}) {
  const itens = [];

  (dividas || []).filter(d => d && !d.pago).forEach(d =>
    itens.push({ valor: Number(d.valor) || 0, venc: d.vencimento || "", cartao: false, desc: d.descricao || d.nome || "Dívida" }));

  (fixaOcorrencias || [])
    .filter(o => o && o.status === "pendente" && (fixas || []).some(f => f.id === o.fixaId))
    .forEach(o => itens.push({
      valor: Number(o.valor) || 0,
      venc: o.dataVencimento || (o.mes ? `${o.mes}-01` : ""),
      cartao: false,
      desc: (fixas || []).find(f => f.id === o.fixaId)?.nome || "Fixa",
    }));

  (parcelamentos || []).forEach(p => {
    const total = p?.totalParcelas || 0;
    if (total <= 0) return;
    const vpp = Number(p.valorParcela) || (p.valorTotal || 0) / total;
    const pagas = new Set(p.parcelasPagas || []);
    const base = p.dataPrimeira || p.dataCompra;
    const [bY, bM, bD] = base ? String(base).split("-").map(Number) : [];
    const start = p.dataPrimeira ? bM : bM + 1; // sem dataPrimeira, 1ª parcela no mês seguinte à compra
    for (let n = 1; n <= total; n++) {
      if (pagas.has(n)) continue;
      let venc = "";
      if (base) {
        const off = n - 1;
        const dt = new Date(bY, start - 1 + off, 1);
        const ultDia = new Date(bY, start + off, 0).getDate();
        dt.setDate(Math.min(bD || 1, ultDia));
        venc = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      }
      itens.push({ valor: vpp, venc, cartao: true, desc: `${p.descricao || "Parcela"} ${n}/${total}` });
    }
  });

  (transacoes || [])
    .filter(t => t && t.tipo === "despesa" && !t.compensado && !t.origemFixaOcorrenciaId && !t.origemParcelamentoId)
    .forEach(t => itens.push({ valor: Number(t.valor) || 0, venc: t.vencimento || t.data || "", cartao: false, desc: t.descricao || "Despesa" }));

  return itens;
}

/**
 * Agregados sobre itensAPagar:
 *  total · cartoes (só parcelas) · pagarMes (vence no mês corrente; sem data
 *  cai no mês corrente) · porAno ([{ano, valor}], "sem data" por último) ·
 *  prox7 ({total, count, top} — vencimentos de hoje a hoje+7).
 */
export function resumoAPagar(state = {}, hoje = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  const hojeISO = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
  const mes = hojeISO.slice(0, 7);
  const lim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 7);
  const limiteISO = `${lim.getFullYear()}-${pad(lim.getMonth() + 1)}-${pad(lim.getDate())}`;

  const itens = itensAPagar(state);
  let total = 0, cartoes = 0, pagarMes = 0;
  const anos = {};
  itens.forEach(it => {
    total += it.valor;
    if (it.cartao) cartoes += it.valor;
    const v = String(it.venc || "");
    if (!v || v.slice(0, 7) === mes) pagarMes += it.valor;
    const ano = v.slice(0, 4);
    const key = /^\d{4}$/.test(ano) ? ano : "sem data";
    anos[key] = (anos[key] || 0) + it.valor;
  });

  const semana = itens
    .filter(it => it.venc && String(it.venc).slice(0, 10) >= hojeISO && String(it.venc).slice(0, 10) <= limiteISO)
    .sort((a, b) => String(a.venc).localeCompare(String(b.venc)));

  return {
    itens, total, cartoes, pagarMes,
    porAno: Object.entries(anos)
      .sort(([a], [b]) => a.localeCompare(b)) // anos crescentes; "sem data" por último
      .map(([ano, valor]) => ({ ano, valor })),
    prox7: {
      total: semana.reduce((s, it) => s + it.valor, 0),
      count: semana.length,
      top: [...semana].sort((a, b) => b.valor - a.valor).slice(0, 3),
    },
  };
}
