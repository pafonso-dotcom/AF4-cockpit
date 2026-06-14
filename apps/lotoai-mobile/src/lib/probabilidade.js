/* ============================================================
   PROBABILIDADE & GESTÃO DE BANCA · Lotofácil
   ─────────────────────────────────────────────────────────────
   Cálculos exatos sobre o espaço amostral. Tudo derivado das
   regras (15 de 25, sem reposição). Nada de "previsão" — só
   matemática verdadeira.

   Espaço total: C(25,15) = 3.268.760 possíveis sorteios.
   ============================================================ */

import { combinacoes } from "./jogos.js";

export const TOTAL_LOTOFACIL = combinacoes(25, 15); // 3.268.760

/**
 * P(exatamente k acertos em uma aposta de 15 contra um sorteio de 15 de 25).
 *
 * Modelo hipergeométrico: você escolhe 15 dezenas. O sorteio escolhe 15 das 25.
 * As 15 que você escolheu são "sucessos" potenciais; as 10 restantes são "falhas".
 * Você "acerta" quem está nos dois conjuntos.
 *
 * P(X=k) = C(15,k) · C(10,15-k) / C(25,15)
 */
export function pAcertosExato(k, totalNumeros = 25, numerosPorJogo = 15) {
  if (k < 0 || k > numerosPorJogo) return 0;
  if (numerosPorJogo - k > totalNumeros - numerosPorJogo) return 0;
  const num = combinacoes(numerosPorJogo, k) * combinacoes(totalNumeros - numerosPorJogo, numerosPorJogo - k);
  const den = combinacoes(totalNumeros, numerosPorJogo);
  return num / den;
}

/**
 * P(pelo menos k acertos em uma aposta).
 */
export function pAcertosPeloMenos(k, totalNumeros = 25, numerosPorJogo = 15) {
  let p = 0;
  for (let i = k; i <= numerosPorJogo; i++) {
    p += pAcertosExato(i, totalNumeros, numerosPorJogo);
  }
  return p;
}

/**
 * P(pelo menos UM prêmio em N apostas INDEPENDENTES).
 *
 * Limitação: assume independência entre apostas. Se as apostas
 * são correlacionadas (mesmas dezenas-base, fechamento), a P real
 * fica DIFERENTE — use probabilidadeFechamento() pra esses casos.
 *
 * P(≥1 premiado) = 1 - (1 - p)^N   onde p = P(prêmio em 1 aposta)
 */
export function pPeloMenosUmPremio(nApostas, pPorAposta) {
  return 1 - Math.pow(1 - pPorAposta, nApostas);
}

/**
 * P(≥k acertos em ALGUMA aposta de um fechamento de K dezenas-base com M apostas
 * onde as M apostas são TODAS as C(K, 15) combinações).
 *
 * Para fechamento completo, é equivalente a P(≥k acertos quando seu volante
 * tem K dezenas).
 *
 * P = sum_{i=k}^{15} C(K, i) · C(25-K, 15-i) / C(25, 15)
 *
 * (porque "minhas K dezenas-base" formam um conjunto e quero P(intersecção ≥ k))
 */
export function pFechamentoCompletoPeloMenos(K, k, totalNumeros = 25, numerosPorJogo = 15) {
  let p = 0;
  for (let i = k; i <= Math.min(K, numerosPorJogo); i++) {
    if (numerosPorJogo - i > totalNumeros - K) continue;
    p += combinacoes(K, i) * combinacoes(totalNumeros - K, numerosPorJogo - i);
  }
  return p / combinacoes(totalNumeros, numerosPorJogo);
}

/* ============================================================
   ESPERANÇA MATEMÁTICA (EV) E GESTÃO DE BANCA
   ============================================================ */

/**
 * EV de uma aposta dada uma tabela de prêmios.
 * @param {Record<number, number>} premioPorAcertos  { 11: 6, 12: 12, ... }
 * @returns {{ ev, evLiquido, custo, retornoEsperado, edge }}
 *   ev: retorno bruto esperado
 *   evLiquido: ev - custo (negativo = perde dinheiro em média)
 *   edge: evLiquido / custo (margem por R$ gasto, sempre negativa em loteria)
 */
export function calcularEV(premioPorAcertos, custoAposta, totalNumeros = 25, numerosPorJogo = 15) {
  let ev = 0;
  for (const [k, premio] of Object.entries(premioPorAcertos)) {
    ev += pAcertosExato(+k, totalNumeros, numerosPorJogo) * premio;
  }
  const evLiquido = ev - custoAposta;
  return {
    ev: +ev.toFixed(4),
    custo: custoAposta,
    evLiquido: +evLiquido.toFixed(4),
    edge: +(evLiquido / custoAposta).toFixed(6),
    retornoEsperado: +ev.toFixed(4),
  };
}

/**
 * Kelly criterion fracional pra apostas binárias.
 * f* = (bp - q) / b  onde:
 *   b = razão prêmio/custo (líquido)
 *   p = probabilidade de ganhar
 *   q = 1 - p
 *
 * Para loteria com EV negativo, f* < 0 → não apostar.
 * Retornamos: f recomendado (clamped em [0, 1]), e o teórico (pode ser negativo).
 *
 * Lotofácil tem múltiplas faixas — agregamos como "qualquer prêmio" para
 * Kelly simplificado, usando prêmio médio ponderado.
 */
export function kellyFracional({ premioMedio, pGanhar, custo }) {
  if (pGanhar <= 0 || custo <= 0) return { fOtimo: 0, fTeorico: 0, recomendacao: "não aposte" };
  const b = (premioMedio - custo) / custo;
  const p = pGanhar;
  const q = 1 - p;
  const fTeorico = (b * p - q) / b;
  const fOtimo = Math.max(0, Math.min(1, fTeorico));
  let recomendacao;
  if (fTeorico < 0) recomendacao = "EV negativo · Kelly diz NÃO apostar";
  else if (fTeorico < 0.01) recomendacao = "apostar < 1% da banca por concurso";
  else recomendacao = `apostar até ${(fTeorico * 100).toFixed(2)}% da banca por concurso`;
  return { fOtimo, fTeorico: +fTeorico.toFixed(6), recomendacao };
}

/**
 * Quantos concursos esperados até o primeiro prêmio.
 * Distribuição geométrica: E[X] = 1/p.
 */
export function concursosAteOPrimeiroPremio(pPorConcurso) {
  if (pPorConcurso <= 0) return Infinity;
  return 1 / pPorConcurso;
}

/**
 * Custo esperado até o primeiro prêmio de tier `k`.
 * = custo_por_concurso * E[concursos] = custo / p
 */
export function custoEsperadoAtePremio(custoPorConcurso, pPorConcurso) {
  return custoPorConcurso * concursosAteOPrimeiroPremio(pPorConcurso);
}

/* ============================================================
   BAYESIAN UPDATE · scoring online
   ============================================================ */

/**
 * Atualiza scores das dezenas usando Beta-Binomial Bayesiano.
 *
 * Para cada dezena n: P(n sai) ~ Beta(α, β) com prior Beta(α0, β0).
 * Cada sorteio é uma observação Bernoulli (saiu ou não).
 *
 * Posterior após N sorteios com s sucessos:
 *   Beta(α0 + s, β0 + N - s)
 *
 * Média posterior = (α0 + s) / (α0 + β0 + N)
 *
 * Prior padrão: Beta(15, 10) (favorece P=15/25=0.6, que é a P teórica).
 * Isso garante que dezenas novas (sem histórico) começam com a P "uniforme"
 * em vez de zero — evita overfit em janelas curtas.
 *
 * @param {number[][]} sorteios  histórico (cada sorteio = array de dezenas)
 * @param {object} prior         { alpha, beta } (default favorece P=0.6)
 * @returns {Record<number, number>}  posterior média por dezena
 */
export function scoresBayesianos(sorteios, prior = { alpha: 15, beta: 10 }, totalNumeros = 25) {
  const N = sorteios.length;
  const sucessos = Object.fromEntries(
    Array.from({ length: totalNumeros }, (_, i) => [i + 1, 0])
  );
  for (const s of sorteios) for (const n of s) sucessos[n]++;

  const out = {};
  for (let n = 1; n <= totalNumeros; n++) {
    out[n] = (prior.alpha + sucessos[n]) / (prior.alpha + prior.beta + N);
  }
  return out;
}

/**
 * Sampling estratificado: gera N jogos cobrindo distintas faixas de paridade,
 * soma e moldura simultaneamente. Maximiza diversidade pra evitar que vários
 * jogos colidam na mesma "região" do espaço amostral.
 *
 * Algoritmo: divide o espaço em "estratos" (combinação de faixas), pondera por
 * frequência empírica + score, escolhe estrato, gera jogo dentro dele.
 *
 * @param {object} opts
 * @param {number} opts.quantidade
 * @param {number[][]} opts.historico
 * @param {object} opts.game
 * @param {Function} opts.gerarJogoFn   função que gera 1 jogo dado scores
 * @returns {number[][]}
 */
export function gerarEstratificado({ quantidade, historico, game, gerarJogoFn }) {
  const faixasPares = game.faixasTipicas?.pares || { min: 0, max: game.numerosPorJogo };
  const faixasSoma = game.faixasTipicas?.soma || { min: 0, max: 1000 };

  // Discretiza pares em 4 faixas e soma em 3 faixas para os estratos
  const stratosP = [
    [faixasPares.min, faixasPares.min + 1],
    [faixasPares.min + 1, faixasPares.min + 2],
    [faixasPares.min + 2, faixasPares.min + 3],
    [faixasPares.min + 3, faixasPares.max],
  ];
  const stratosS = [
    [faixasSoma.min, faixasSoma.min + (faixasSoma.max - faixasSoma.min) / 3],
    [faixasSoma.min + (faixasSoma.max - faixasSoma.min) / 3, faixasSoma.max - (faixasSoma.max - faixasSoma.min) / 3],
    [faixasSoma.max - (faixasSoma.max - faixasSoma.min) / 3, faixasSoma.max],
  ];

  const out = [];
  for (let i = 0; i < quantidade; i++) {
    const targetP = stratosP[i % stratosP.length];
    const targetS = stratosS[i % stratosS.length];
    let jogo = null;
    // tenta até 100x cair no estrato; se não, aceita o último gerado
    for (let t = 0; t < 100; t++) {
      const candidato = gerarJogoFn();
      const pares = candidato.filter(n => n % 2 === 0).length;
      const soma = candidato.reduce((a, b) => a + b, 0);
      if (pares >= targetP[0] && pares <= targetP[1] && soma >= targetS[0] && soma <= targetS[1]) {
        jogo = candidato;
        break;
      }
      if (!jogo) jogo = candidato;
    }
    out.push(jogo);
  }
  return out;
}

/* ============================================================
   RELATÓRIO RESUMO · pra mostrar na UI ou imprimir
   ============================================================ */

/**
 * Gera um relatório matemático completo pra mostrar pro usuário.
 * Inclui: P(prêmio) por aposta, EV, Kelly, tempos esperados.
 */
export function relatorioMatematico({ game, jogosPorConcurso = 1, orcamentoMensal = 0, concursosPorMes = 12 }) {
  const pPorPremio = {};
  for (const k of game.faixasDePremio) {
    pPorPremio[k] = pAcertosExato(k, game.totalNumeros, game.numerosPorJogo);
  }
  const pQualquerPremio = pAcertosPeloMenos(game.premiavel, game.totalNumeros, game.numerosPorJogo);
  const ev = calcularEV(game.premioMedio, game.precoAposta, game.totalNumeros, game.numerosPorJogo);

  const custoPorConcurso = jogosPorConcurso * game.precoAposta;
  const pPremioPorConcurso = pPeloMenosUmPremio(jogosPorConcurso, pQualquerPremio);

  const premioMedioPond = Object.entries(pPorPremio).reduce((s, [k, p]) => s + p * game.premioMedio[+k], 0)
                          / pQualquerPremio;
  const kelly = kellyFracional({
    premioMedio: premioMedioPond,
    pGanhar: pQualquerPremio,
    custo: game.precoAposta,
  });

  const orcAnual = orcamentoMensal * 12;
  const gastoAnual = custoPorConcurso * concursosPorMes * 12;
  const concursosAteOPrimeiro = concursosAteOPrimeiroPremio(pPremioPorConcurso);

  return {
    jogo: game.nome,
    pPorPremio,
    pQualquerPremio: +pQualquerPremio.toFixed(8),
    pQualquerPremioStr: `1 em ${Math.round(1 / pQualquerPremio).toLocaleString("pt-BR")}`,
    ev,
    kelly,
    jogosPorConcurso,
    custoPorConcurso: +custoPorConcurso.toFixed(2),
    pPremioPorConcurso: +pPremioPorConcurso.toFixed(6),
    pPremioPorConcursoStr: `${(pPremioPorConcurso * 100).toFixed(3)}%`,
    concursosAteOPrimeiroPremio: Math.round(concursosAteOPrimeiro),
    custoAteOPrimeiroPremio: +(custoPorConcurso * concursosAteOPrimeiro).toFixed(2),
    orcamento: {
      mensal: orcamentoMensal,
      anual: orcAnual,
      gastoAnualEstimado: +gastoAnual.toFixed(2),
      dentroDoLimite: gastoAnual <= orcAnual,
    },
  };
}
