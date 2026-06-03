/**
 * Central de Alertas — computa tudo que precisa de ação financeira.
 *
 * Junta fontes canônicas (dívidas, devedores, fixas, parcelas de cartão,
 * orçamento por categoria) e devolve uma lista ordenada de alertas.
 *
 * Cada alerta: { id, tipo, severidade, titulo, sub, valor, data, modulo, tab }
 *   - severidade: "vencido" | "proximo" | "info"
 *   - modulo/tab: pra navegar ao clicar
 */

const nomesMes = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

function ddmm(iso) {
  if (!iso || iso.length < 10) return "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

// Data da parcela N de um parcelamento (mesma regra de Cartoes.jsx).
function dataDaParcelaISO(p, n) {
  const base = p.dataPrimeira || p.dataCompra;
  if (!base) return null;
  const [y, m, d] = base.split("-").map(Number);
  const startMonth = p.dataPrimeira ? m : m + 1;
  const dt = new Date(y, startMonth - 1 + (n - 1), d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * @param {object} opts
 * @param {string} opts.hoje  - "YYYY-MM-DD"
 */
export function computarAlertas({
  hoje,
  dividas = [],
  devedores = [],
  fixas = [],
  fixaOcorrencias = [],
  parcelamentos = [],
  cartoes = [],
  categorias = [],
  transacoes = [],
} = {}) {
  const alertas = [];
  const mesAtual = (hoje || "").slice(0, 7);

  // Janela de "vence em breve" = hoje + 3 dias
  const d3 = new Date(hoje + "T00:00:00");
  d3.setDate(d3.getDate() + 3);
  const em3 = d3.toISOString().slice(0, 10);

  // Severidade por data de vencimento
  const sev = (venc) => {
    if (!venc) return null;
    if (venc < hoje) return "vencido";
    if (venc <= em3) return "proximo";
    return null; // mais distante → não alerta
  };

  // 1) Dívidas a pagar (não pagas)
  dividas.filter(d => !d.pago && d.vencimento).forEach(d => {
    const s = sev(d.vencimento);
    if (!s) return;
    alertas.push({
      id: `divida:${d.id}`, tipo: "divida", severidade: s,
      titulo: d.nome || "Dívida",
      sub: `A pagar · vence ${ddmm(d.vencimento)}`,
      valor: Number(d.valor || 0), data: d.vencimento,
      modulo: "financas", tab: "planejamento",
    });
  });

  // 2) Devedores / a receber (não recebidos)
  devedores.filter(d => !d.recebido && d.vencimento).forEach(d => {
    const s = sev(d.vencimento);
    if (!s) return;
    const aberto = Number(d.valor || 0) - Number(d.valorRecebido || 0);
    alertas.push({
      id: `devedor:${d.id}`, tipo: "receber", severidade: s,
      titulo: d.nome || "A receber",
      sub: `A receber · vence ${ddmm(d.vencimento)}`,
      valor: aberto, data: d.vencimento,
      modulo: "financas", tab: "planejamento",
    });
  });

  // 3) Despesas fixas pendentes (ocorrência usa dataVencimento + status)
  fixaOcorrencias.filter(o => (o.status || "pendente") !== "paga").forEach(o => {
    const venc = o.dataVencimento || (o.mes ? `${o.mes}-10` : null);
    const s = sev(venc);
    if (!s) return;
    const fixa = fixas.find(f => f.id === o.fixaId);
    alertas.push({
      id: `fixa:${o.id}`, tipo: "fixa", severidade: s,
      titulo: (fixa?.nome || o.descricao || "Despesa fixa"),
      sub: `Fixa · vence ${ddmm(venc)}`,
      valor: Number(o.valor ?? fixa?.valor ?? 0), data: venc,
      modulo: "financas", tab: "fixas",
    });
  });

  // 4) Parcelas de cartão (parcela não paga que vence vencida ou em ≤3 dias)
  parcelamentos.forEach(p => {
    const total = p.totalParcelas || 0;
    if (total <= 0) return;
    const valorParc = p.valorParcela || (p.valorTotal / total) || 0;
    const cartao = cartoes.find(c => c.id === p.cartaoId);
    for (let n = 1; n <= total; n++) {
      if ((p.parcelasPagas || []).includes(n)) continue;
      const venc = dataDaParcelaISO(p, n);
      const s = sev(venc);
      if (!s) continue;
      alertas.push({
        id: `parc:${p.id}:${n}`, tipo: "parcela", severidade: s,
        titulo: `${p.descricao || "Parcela"} ${n}/${total}`,
        sub: `${cartao?.nome ? cartao.nome + " · " : ""}vence ${ddmm(venc)}`,
        valor: valorParc, data: venc,
        modulo: "financas", tab: "cartoes",
      });
    }
  });

  // 5) Orçamento por categoria estourado / quase (mês atual)
  const gastoMes = {};
  const idPorNome = {};
  categorias.forEach(c => { idPorNome[c.nome] = c.id; });
  transacoes.forEach(t => {
    if (t.tipo !== "despesa") return;
    if (!(t.data || "").startsWith(mesAtual)) return;
    const id = idPorNome[t.categoria];
    if (id == null) return;
    gastoMes[id] = (gastoMes[id] || 0) + Number(t.valor || 0);
  });
  categorias.filter(c => c.tipo === "despesa" && Number(c.limite) > 0).forEach(c => {
    const gasto = gastoMes[c.id] || 0;
    const pct = gasto / c.limite;
    if (pct >= 1) {
      alertas.push({
        id: `orc:${c.id}`, tipo: "orcamento", severidade: "vencido",
        titulo: `Orçamento estourado · ${c.nome}`,
        sub: `Gastou ${money(gasto)} de ${money(c.limite)}`,
        valor: gasto - c.limite, data: hoje,
        modulo: "financas", tab: "categorias",
      });
    } else if (pct >= 0.8) {
      alertas.push({
        id: `orc:${c.id}`, tipo: "orcamento", severidade: "proximo",
        titulo: `Orçamento quase no limite · ${c.nome}`,
        sub: `Gastou ${money(gasto)} de ${money(c.limite)} (${Math.round(pct * 100)}%)`,
        valor: c.limite - gasto, data: hoje,
        modulo: "financas", tab: "categorias",
      });
    }
  });

  // Ordena: vencidos primeiro, depois por data crescente.
  const ordemSev = { vencido: 0, proximo: 1, info: 2 };
  alertas.sort((a, b) => {
    const ds = (ordemSev[a.severidade] ?? 9) - (ordemSev[b.severidade] ?? 9);
    if (ds !== 0) return ds;
    return (a.data || "").localeCompare(b.data || "");
  });

  return alertas;
}

function money(v) {
  try { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0); }
  catch { return `R$ ${v}`; }
}
