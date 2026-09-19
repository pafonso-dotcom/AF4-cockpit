/* ============================================================
   CALCULADORA DE JUROS · motor puro

   Juros simples ou compostos, taxa ao mês ou ao ano, com aporte
   mensal opcional (aporte entra no FIM de cada mês).
   ============================================================ */

/** Converte a taxa informada pra taxa MENSAL decimal. */
export function taxaMensalDe(taxaPct, periodo = "mes", composto = true) {
  const t = (Number(taxaPct) || 0) / 100;
  if (periodo !== "ano") return t;
  return composto ? Math.pow(1 + t, 1 / 12) - 1 : t / 12;
}

/**
 * @returns {{ taxaMensalPct, montante, totalInvestido, totalJuros, serie }}
 *   serie = [{ mes, saldo }] com mes 0 (início) até `meses`.
 */
export function calcularJuros({ principal = 0, taxa = 0, taxaPeriodo = "mes", meses = 0, aporteMensal = 0, composto = true } = {}) {
  const p = Math.max(0, Number(principal) || 0);
  const n = Math.max(0, Math.min(1200, Math.round(Number(meses) || 0)));
  const ap = Math.max(0, Number(aporteMensal) || 0);
  const i = taxaMensalDe(taxa, taxaPeriodo, composto);

  const serie = [{ mes: 0, saldo: p }];
  let saldo = p;
  for (let m = 1; m <= n; m++) {
    if (composto) {
      saldo = saldo * (1 + i) + ap;
    } else {
      // Simples: o principal rende i por mês; cada aporte rende i pelos
      // meses que ficou aplicado (sem juros sobre juros).
      saldo = p * (1 + i * m);
      for (let k = 1; k <= m; k++) saldo += ap * (1 + i * (m - k));
    }
    serie.push({ mes: m, saldo: +saldo.toFixed(2) });
  }

  const montante = serie[serie.length - 1].saldo;
  const totalInvestido = +(p + ap * n).toFixed(2);
  const totalJuros = +(montante - totalInvestido).toFixed(2);
  return { taxaMensalPct: i * 100, montante, totalInvestido, totalJuros, serie };
}
