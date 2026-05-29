/**
 * Perfis-base de alocação por objetivo (% por classe de ativo).
 * Cada coluna soma 100. Usados como pesos pra calcular a alocação
 * resultante a partir do mix de objetivos do usuário.
 *
 * Referência: docs/superpowers/specs/2026-05-26-monte-sua-carteira-design.md
 */

export const PERFIS_OBJETIVO = {
  renda: {
    fii:      45,
    acao:     15,
    stock:    10,
    reit:     10,
    tesouro:  15,
    rf:        5,  // Reserva: Selic / CDB liquidez
  },
  crescimento: {
    fii:      15,
    acao:     30,
    stock:    30,
    reit:      5,
    tesouro:  10,
    rf:       10,
  },
  reserva: {
    fii:       5,
    acao:      0,
    stock:     0,
    reit:      0,
    tesouro:  80,
    rf:       15,
  },
};

// Ordem de exibição (na tabela e pie chart)
export const ORDEM_CLASSES = ["fii", "acao", "stock", "reit", "tesouro", "rf"];

// Mix-atalhos
export const ATALHOS_MIX = [
  { id: "renda",         label: "Só renda",        mix: { renda: 100, crescimento:   0, reserva:  0 } },
  { id: "crescimento",   label: "Só crescimento",  mix: { renda:   0, crescimento: 100, reserva:  0 } },
  { id: "balanceado",    label: "Balanceado",      mix: { renda:  40, crescimento:  40, reserva: 20 } },
];

/**
 * Calcula a alocação por classe a partir do mix de objetivos.
 * @param {{ renda: number, crescimento: number, reserva: number }} mix — porcentagens (0-100), devem somar 100
 * @returns {Array<{ tipo: string, pct: number }>} ordenado por ORDEM_CLASSES
 */
export function calcularAlocacaoPorMix(mix) {
  const fRenda       = (mix?.renda || 0) / 100;
  const fCrescimento = (mix?.crescimento || 0) / 100;
  const fReserva     = (mix?.reserva || 0) / 100;
  return ORDEM_CLASSES.map(tipo => {
    const pct =
      fRenda * (PERFIS_OBJETIVO.renda[tipo] || 0) +
      fCrescimento * (PERFIS_OBJETIVO.crescimento[tipo] || 0) +
      fReserva * (PERFIS_OBJETIVO.reserva[tipo] || 0);
    return { tipo, pct };
  });
}

/**
 * Ajusta o mix quando o usuário muda UM slider — redistribui o resto
 * proporcionalmente nos outros 2 mantendo a soma em 100.
 *
 * @param {{ renda, crescimento, reserva }} mixAtual
 * @param {"renda"|"crescimento"|"reserva"} key — slider alterado
 * @param {number} novoValor — novo valor desse slider (0-100)
 * @returns {{ renda, crescimento, reserva }} mix ajustado, soma 100
 */
export function ajustarMix(mixAtual, key, novoValor) {
  const v = Math.max(0, Math.min(100, novoValor));
  const outras = Object.keys(mixAtual).filter(k => k !== key);
  const restante = 100 - v;
  const somaOutras = outras.reduce((s, k) => s + mixAtual[k], 0);

  const novo = { ...mixAtual, [key]: v };
  if (somaOutras > 0) {
    // Proporcional
    outras.forEach(k => {
      novo[k] = Math.round((mixAtual[k] / somaOutras) * restante);
    });
  } else {
    // Outras zeradas → divide igualmente
    const cada = Math.round(restante / outras.length);
    outras.forEach((k, i) => {
      novo[k] = (i === outras.length - 1) ? (restante - cada * (outras.length - 1)) : cada;
    });
  }
  // Garante soma exata 100 (correção de arredondamento na última)
  const soma = Object.values(novo).reduce((s, x) => s + x, 0);
  if (soma !== 100) {
    novo[outras[outras.length - 1]] += (100 - soma);
  }
  return novo;
}
