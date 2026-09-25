/**
 * Simulador de compra ("E se?") — aplica uma compra HIPOTÉTICA em cima da
 * projeção de saldo (getProjecaoSaldo) SEM tocar em nenhum dado real.
 * Puro e testável: recebe a projeção pronta e a compra, devolve os meses
 * com a parcela e o saldo recalculado.
 */

const somaMes = (mesISO, delta) => {
  const [a, m] = String(mesISO).split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Aplica VÁRIAS compras de uma vez (parcelas somadas mês a mês).
 * @param proj saída de getProjecaoSaldo: { saldoInicial, meses:[{mesISO,label,liquido,saldoFim,...}] }
 * @param compras [{ valorTotal, parcelas = 1, mesInicioISO, descricao? }]
 * @returns { meses:[{...m, parcela, porCompra:[{descricao,valor}], saldoFimCom}],
 *            piorSaldo, piorMesLabel, mesesNegativos, valorParcela (da 1ª compra) }
 */
export function aplicarComprasNaProjecao(proj, compras = []) {
  // Pré-calcula, por compra, a janela de meses e o valor da parcela.
  const planos = (compras || [])
    .map(c => ({ ...c, total: Number(c?.valorTotal) || 0, n: Math.max(1, Math.round(Number(c?.parcelas) || 1)) }))
    .filter(c => c.total > 0 && c.mesInicioISO)
    .map(c => ({
      descricao: c.descricao || "Compra",
      valorParcela: c.total / c.n,
      janela: new Set(Array.from({ length: c.n }, (_, i) => somaMes(c.mesInicioISO, i))),
    }));

  let saldo = Number(proj?.saldoInicial) || 0;
  let piorSaldo = Infinity, piorMesLabel = "", mesesNegativos = 0;
  const meses = (proj?.meses || []).map(m => {
    const porCompra = planos
      .filter(p => p.janela.has(m.mesISO))
      .map(p => ({ descricao: p.descricao, valor: p.valorParcela }));
    const parcela = porCompra.reduce((s, x) => s + x.valor, 0);
    saldo += (Number(m.liquido) || 0) - parcela;
    if (saldo < piorSaldo) { piorSaldo = saldo; piorMesLabel = m.label || m.mesISO; }
    if (saldo < 0) mesesNegativos++;
    return { ...m, parcela, porCompra, saldoFimCom: saldo };
  });
  if (!meses.length) { piorSaldo = saldo; }
  return { meses, valorParcela: planos[0]?.valorParcela || 0, piorSaldo, piorMesLabel, mesesNegativos };
}

/** Uma compra só — atalho sobre aplicarComprasNaProjecao. */
export function aplicarCompraNaProjecao(proj, compra = {}) {
  return aplicarComprasNaProjecao(proj, [compra]);
}
