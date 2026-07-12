// Diagnóstico consolidado da carteira por IA — a parte determinística.
// Monta um CONTEXTO com dados 100% reais do app (posições, pesos,
// concentração, fundamentos curados, YoC, benchmarks do BCB) e o prompt
// estruturado. A IA recebe fatos, não adivinha números.

import { proventosPorCota12m } from "./mapaDividendos.js";

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} p
 * @param {Array}  p.ativos          posições ({ ticker, nome, tipo, segmento, qtd, pm, preco })
 * @param {object} [p.fundamentos]   mapa de fundamentos curados (af4:fundamentos)
 * @param {object} [p.scores]        { [TICKER]: { score, badge, recomendacao } } — resultado de classificar()
 * @param {object} [p.proventosReais] { [TICKER]: [{ pagamento, valor }] } — cache brapi
 * @param {object} [p.benchmarks]    { cdi12m, ipca12m, ibov12m } — BCB
 * @param {Date}   [p.hoje]
 */
export function montarContextoDiagnostico({ ativos = [], fundamentos = {}, scores = {}, proventosReais = {}, benchmarks = null, hoje = new Date() } = {}) {
  let custoTotal = 0, valorTotal = 0;
  const base = (ativos || []).map((a) => {
    const qtd = Number(a.qtd) || 0;
    const pm = Number(a.pm ?? a.precoMedio) || 0;
    const preco = Number(a.preco) || 0;
    const custo = qtd * pm;
    const valor = qtd * preco;
    custoTotal += custo;
    valorTotal += valor;
    return { a, qtd, pm, custo, valor };
  });

  const posicoes = base.map(({ a, qtd, pm, custo, valor }) => {
    const tk = (a.ticker || "").toUpperCase();
    const p = {
      ticker: tk,
      nome: a.nome || "",
      tipo: a.tipo || "outro",
      segmento: a.segmento || "",
      qtd,
      valor: r2(valor),
      pesoPct: valorTotal > 0 ? r2((valor / valorTotal) * 100) : 0,
      resultadoPct: custo > 0 ? r2(((valor - custo) / custo) * 100) : 0,
    };
    const sc = scores[tk];
    if (sc) p.fundamentos = { score: sc.score, badge: sc.badge, recomendacao: sc.recomendacao };
    const dy = Number(fundamentos[tk]?.dados?.dy);
    if (Number.isFinite(dy) && dy > 0) p.dyPct = r2(dy);
    const porCota = proventosPorCota12m(proventosReais[tk], hoje);
    if (porCota > 0 && pm > 0) p.yocPct = r2((porCota / pm) * 100);
    return p;
  }).sort((x, y) => y.valor - x.valor);

  const porClasse = {};
  const porSegmento = {};
  posicoes.forEach((p) => {
    porClasse[p.tipo] = (porClasse[p.tipo] || 0) + p.pesoPct;
    if (p.segmento) porSegmento[p.segmento] = (porSegmento[p.segmento] || 0) + p.pesoPct;
  });
  const concentracaoPorClasse = Object.entries(porClasse)
    .map(([tipo, pesoPct]) => ({ tipo, pesoPct: r2(pesoPct) }))
    .sort((x, y) => y.pesoPct - x.pesoPct);
  const concentracaoPorSegmento = Object.entries(porSegmento)
    .map(([segmento, pesoPct]) => ({ segmento, pesoPct: r2(pesoPct) }))
    .sort((x, y) => y.pesoPct - x.pesoPct);

  return {
    totais: {
      valor: r2(valorTotal),
      custo: r2(custoTotal),
      resultadoPct: custoTotal > 0 ? r2(((valorTotal - custoTotal) / custoTotal) * 100) : 0,
      posicoes: posicoes.length,
    },
    posicoes,
    concentracaoPorClasse,
    concentracaoPorSegmento,
    maiorPosicao: posicoes[0] || null,
    benchmarks: benchmarks || null,
  };
}

/** Prompt estruturado — pede JSON com nota, resumo, forças, riscos e ações. */
export function montarPromptDiagnostico(ctx) {
  return `Você é um analista de investimentos experiente e direto. Analise a carteira abaixo (dados REAIS do investidor — pesos, resultados, fundamentos e yield-on-cost já calculados).

DADOS DA CARTEIRA (JSON):
${JSON.stringify(ctx, null, 1)}

${ctx.benchmarks ? `Benchmarks reais dos últimos 12 meses: CDI ${ctx.benchmarks.cdi12m ?? "?"}%, IBOV ${ctx.benchmarks.ibov12m ?? "?"}%, IPCA ${ctx.benchmarks.ipca12m ?? "?"}%.` : ""}

Avalie: concentração (por ativo, classe e segmento), qualidade dos fundamentos onde disponíveis, renda de dividendos (dyPct/yocPct), posições com resultado muito negativo, e o que falta pra uma carteira mais robusta. Seja específico — cite tickers e números dos dados.

Responda APENAS um JSON válido, sem texto fora dele. Seja conciso: NO MÁXIMO 4 pontosFortes, 5 riscos e 5 acoesSugeridas, cada frase com menos de 25 palavras (carteiras grandes: agrupe em vez de citar ativo por ativo):
{
  "notaGeral": <0-100>,
  "classificacao": "<Frágil|Razoável|Boa|Excelente>",
  "resumo": "<2-3 frases diretas sobre o estado geral>",
  "pontosFortes": ["<frase específica>", ...],
  "riscos": [{ "titulo": "<curto>", "detalhe": "<frase com ticker/número>", "severidade": "<alta|media|baixa>" }, ...],
  "acoesSugeridas": [{ "titulo": "<curto>", "detalhe": "<o que fazer, concreto>", "prioridade": <1-3> }, ...]
}
Ferramenta educacional — linguagem de análise, não recomendação formal de investimento.`;
}
