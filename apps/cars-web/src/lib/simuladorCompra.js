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
 * @param proj saída de getProjecaoSaldo: { saldoInicial, meses:[{mesISO,label,liquido,saldoFim,...}] }
 * @param compra { valorTotal, parcelas = 1, mesInicioISO } — mesInicioISO "YYYY-MM"
 * @returns { meses:[{...m, parcela, saldoFimCom}], piorSaldo, piorMesLabel, mesesNegativos }
 */
export function aplicarCompraNaProjecao(proj, { valorTotal = 0, parcelas = 1, mesInicioISO } = {}) {
  const total = Number(valorTotal) || 0;
  const n = Math.max(1, Math.round(Number(parcelas) || 1));
  const valorParcela = total / n;
  const janela = new Set(Array.from({ length: n }, (_, i) => somaMes(mesInicioISO, i)));

  let saldo = Number(proj?.saldoInicial) || 0;
  let piorSaldo = Infinity, piorMesLabel = "", mesesNegativos = 0;
  const meses = (proj?.meses || []).map(m => {
    const parcela = janela.has(m.mesISO) ? valorParcela : 0;
    saldo += (Number(m.liquido) || 0) - parcela;
    if (saldo < piorSaldo) { piorSaldo = saldo; piorMesLabel = m.label || m.mesISO; }
    if (saldo < 0) mesesNegativos++;
    return { ...m, parcela, saldoFimCom: saldo };
  });
  if (!meses.length) { piorSaldo = saldo; }
  return { meses, valorParcela, piorSaldo, piorMesLabel, mesesNegativos };
}
