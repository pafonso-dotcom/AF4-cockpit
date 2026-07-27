// ============================================================
// SIMULADOR FIIs × RENDA FIXA — motor puro (sem React)
// Aporte mensal por N meses, comparando dois caminhos (FII e Renda Fixa) por
// rentabilidade anual. Devolve o patrimônio acumulado ao longo do tempo, o
// total aportado, e — no fim do prazo — patrimônio, renda mensal estimada
// (vivendo do rendimento) e os valores corrigidos pela inflação.
// ============================================================

// Taxa mensal equivalente a uma taxa anual (juros compostos).
const taxaMensal = (aa) => Math.pow(1 + (Number(aa) || 0) / 100, 1 / 12) - 1;

// Valor futuro de uma série de aportes mensais (aporte no fim de cada mês).
function fvAportes(aporte, rm, n) {
  const a = Number(aporte) || 0;
  const meses = Math.max(0, Math.floor(Number(n) || 0));
  if (meses === 0) return 0;
  if (Math.abs(rm) < 1e-12) return +(a * meses).toFixed(2);
  return +((a * ((Math.pow(1 + rm, meses) - 1) / rm))).toFixed(2);
}

/**
 * @param {object} p
 *   aporteMensal, prazoMeses, rentFiiAA (% a.a.), rentRfAA (% a.a.),
 *   inflacaoAA (% a.a.), pontos (nº de marcos no gráfico, default 6)
 */
export function simularFiiRf({ aporteMensal = 0, prazoMeses = 0, rentFiiAA = 0, rentRfAA = 0, inflacaoAA = 0, pontos = 6 } = {}) {
  const N = Math.max(0, Math.floor(Number(prazoMeses) || 0));
  const rmFii = taxaMensal(rentFiiAA);
  const rmRf = taxaMensal(rentRfAA);

  // Renda mensal gerada por um patrimônio, à taxa simples da classe (a.a./12).
  // Nos FIIs é o dividendo mensal; na renda fixa, o rendimento equivalente.
  const rendaFii = (pat) => +(pat * ((Number(rentFiiAA) || 0) / 100 / 12)).toFixed(2);
  const rendaRf = (pat) => +(pat * ((Number(rentRfAA) || 0) / 100 / 12)).toFixed(2);

  // Série ao longo do prazo: patrimônio acumulado em cada marco e a renda
  // mensal (dividendos/rendimento) que esse patrimônio já geraria naquele mês.
  const serie = [];
  const push = (m) => {
    const fii = fvAportes(aporteMensal, rmFii, m);
    const rf = fvAportes(aporteMensal, rmRf, m);
    serie.push({ mes: m, fii, rf, rendaFii: rendaFii(fii), rendaRf: rendaRf(rf) });
  };
  const step = Math.max(1, Math.round(N / Math.max(1, pontos)));
  for (let m = step; m < N; m += step) push(m);
  if (N > 0) push(N);

  const patFii = fvAportes(aporteMensal, rmFii, N);
  const patRf = fvAportes(aporteMensal, rmRf, N);
  const totalAportado = +(((Number(aporteMensal) || 0) * N)).toFixed(2);
  const anos = N / 12;
  const deflator = Math.pow(1 + (Number(inflacaoAA) || 0) / 100, anos) || 1;

  // Renda mensal estimada: vive do rendimento do patrimônio, à taxa mensal
  // simples (a.a./12) de cada classe. O valor real desconta a inflação do
  // período (poder de compra de hoje).
  const lado = (pat, rentAA) => {
    const rendaMensal = +(pat * ((Number(rentAA) || 0) / 100 / 12)).toFixed(2);
    return {
      patrimonio: pat,
      ganho: +(pat - totalAportado).toFixed(2),
      rendaMensal,
      rendaMensalReal: +(rendaMensal / deflator).toFixed(2),
      patrimonioReal: +(pat / deflator).toFixed(2),
    };
  };

  return {
    serie, totalAportado, anos, deflator,
    fii: lado(patFii, rentFiiAA),
    rf: lado(patRf, rentRfAA),
    // Qual rende mais patrimônio no fim do prazo.
    vencedor: patFii === patRf ? "empate" : (patFii > patRf ? "fii" : "rf"),
  };
}
