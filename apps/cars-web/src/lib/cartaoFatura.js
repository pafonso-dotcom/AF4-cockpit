/* ============================================================
   FATURA DO CARTÃO · helpers puros

   Regra de competência de uma compra avulsa: compra feita DEPOIS
   do dia de fechamento do cartão cai na fatura do mês seguinte.
   ============================================================ */

/** Competência (AAAA-MM) em que uma compra de dataISO cai na fatura. */
export function competenciaDaCompra(dataISO, fechamento) {
  const data = String(dataISO || "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(data)) return null;
  let comp = data.slice(0, 7);
  const fech = Number(fechamento);
  if (fech >= 1 && fech <= 31 && Number(data.slice(8, 10)) > fech) {
    const [y, m] = comp.split("-").map(Number);
    const d = new Date(y, m, 1); // mês seguinte
    comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return comp;
}

/**
 * Soma das PARCELAS em aberto de um cartão que vencem em monthKey.
 * Mesma regra da tela Cartões: parcela N cai em dataPrimeira + (N-1) meses
 * (ou dataCompra + N meses, sem dataPrimeira).
 */
export function parcelasPendentesNoMes(cartao, parcelamentos = [], monthKey) {
  if (!cartao || !monthKey) return 0;
  return (parcelamentos || []).reduce((s, p) => {
    if (!p || p.cartaoId !== cartao.id) return s;
    const total = p.totalParcelas || 0;
    if (total <= 0) return s;
    const base = p.dataPrimeira || p.dataCompra;
    if (!base) return s;
    const [y, m, d] = base.split("-").map(Number);
    const start = p.dataPrimeira ? m : m + 1;
    const vpp = Number(p.valorParcela) || (Number(p.valorTotal) || 0) / total;
    const pagas = new Set(p.parcelasPagas || []);
    let devido = 0;
    for (let n = 1; n <= total; n++) {
      if (pagas.has(n)) continue;
      const dt = new Date(y, start - 1 + (n - 1), d || 1);
      if (`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` === monthKey) devido += vpp;
    }
    return s + devido;
  }, 0);
}

/**
 * Soma das compras AVULSAS pendentes do cartão (lançadas à mão ou por foto,
 * sem vir de fatura importada) cuja competência é monthKey. É o que faz a
 * compra lançada na hora aparecer no "a pagar" do cartão sem esperar a
 * fatura fechar.
 *
 * `incluirAnteriores`: também soma competências ANTERIORES a monthKey —
 * rolagem pra quando a fatura do mês já está fechada/paga (como no banco,
 * a compra pendente cai na próxima fatura aberta).
 */
export function avulsasPendentesNoMes(cartao, transacoes = [], monthKey, { incluirAnteriores = false } = {}) {
  if (!cartao || !monthKey) return 0;
  return (transacoes || []).reduce((s, t) => {
    if (!t || t.cartaoId !== cartao.id || t.tipo !== "despesa" || t.compensado) return s;
    if (String(t.origem || "").startsWith("fatura-")) return s;
    const comp = competenciaDaCompra(t.data, cartao.fechamento);
    if (!comp) return s;
    const entra = incluirAnteriores ? comp <= monthKey : comp === monthKey;
    return entra ? s + (Number(t.valor) || 0) : s;
  }, 0);
}
