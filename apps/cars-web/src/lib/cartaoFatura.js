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
 * Soma das compras AVULSAS pendentes do cartão (lançadas à mão ou por foto,
 * sem vir de fatura importada) cuja competência é monthKey. É o que faz a
 * compra lançada na hora aparecer no "a pagar" do cartão sem esperar a
 * fatura fechar.
 */
export function avulsasPendentesNoMes(cartao, transacoes = [], monthKey) {
  if (!cartao || !monthKey) return 0;
  return (transacoes || []).reduce((s, t) => {
    if (!t || t.cartaoId !== cartao.id || t.tipo !== "despesa" || t.compensado) return s;
    if (String(t.origem || "").startsWith("fatura-")) return s;
    return competenciaDaCompra(t.data, cartao.fechamento) === monthKey
      ? s + (Number(t.valor) || 0)
      : s;
  }, 0);
}
