/* ============================================================
   Backtest · roda a estratégia sobre N concursos passados
   e reporta distribuição de acertos e ROI bruto.
   ============================================================ */

import { contarAcertos, LOTOFACIL } from "./lotofacil.js";
import { gerarJogos } from "./generator.js";

// Premiação aproximada · valores médios usados como referência.
// Em produção, viria de tabela mantida (ou da API da Caixa).
export const PREMIO_MEDIO = {
  11: 6,
  12: 12,
  13: 30,
  14: 2000,
  15: 1500000,
};

/**
 * @param {object} opts
 * @param {number[][]} opts.historico   sorteios em ordem cronológica
 * @param {number} opts.janela          quantos concursos finais simular
 * @param {number} opts.jogosPorConcurso quantas apostas por concurso
 * @param {object} opts.geradorOpts     opções repassadas ao gerador
 */
export function rodarBacktest({ historico, janela = 50, jogosPorConcurso = 1, geradorOpts = {} } = {}) {
  if (!historico?.length) return null;
  const inicio = Math.max(0, historico.length - janela);
  const distAcertos = { 11: 0, 12: 0, 13: 0, 14: 0, 15: 0 };
  let totalApostas = 0;
  let gastoTotal = 0;
  let premioTotal = 0;

  for (let i = inicio; i < historico.length; i++) {
    const passado = historico.slice(0, i); // só usa o que veio antes
    const sorteio = historico[i];
    const jogos = gerarJogos({ ...geradorOpts, historico: passado, quantidade: jogosPorConcurso });

    for (const jogo of jogos) {
      totalApostas++;
      gastoTotal += LOTOFACIL.precoAposta;
      const acertos = contarAcertos(jogo, sorteio);
      if (acertos in distAcertos) {
        distAcertos[acertos]++;
        premioTotal += PREMIO_MEDIO[acertos] || 0;
      }
    }
  }

  const lucro = premioTotal - gastoTotal;
  const roi = gastoTotal ? (lucro / gastoTotal) * 100 : 0;

  return {
    concursos: historico.length - inicio,
    totalApostas,
    distAcertos,
    gastoTotal: +gastoTotal.toFixed(2),
    premioTotal: +premioTotal.toFixed(2),
    lucro: +lucro.toFixed(2),
    roi: +roi.toFixed(2),
  };
}
