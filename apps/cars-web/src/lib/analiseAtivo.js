/**
 * 🔎 Análise de ativo do Pesquisador de mercado (2026-09-29).
 * Duas peças puras e testáveis:
 *  - rentabilidade12m: retorno dos últimos 12 meses a partir do histórico
 *    de preços da brapi + proventos pagos no período (importante em FII:
 *    o preço anda de lado mas o rendimento mensal é o retorno de verdade);
 *  - montarPromptAnaliseAtivo: prompt PT-BR pro Gemini com busca no Google
 *    (notícias recentes + leitura de analistas), SEM pedir recomendação.
 */

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * @param hist [{time(ms), close}] — histórico ~1 ano (qualquer intervalo)
 * @param dividendos [{pagamento:"YYYY-MM-DD", valor}] — mais recente primeiro
 * @returns {{ pctPreco, pctProventos, pctTotal, precoInicial, precoFinal,
 *             somaProventos, meses }|null} null se não houver dados suficientes.
 * Obs.: retorno total é aproximado (proventos somados sem reinvestimento),
 * proventos ÷ preço inicial do período.
 */
export function rentabilidade12m(hist = [], dividendos = [], agora = new Date()) {
  const pontos = (hist || []).filter(p => p && Number.isFinite(p.close) && p.close > 0);
  if (pontos.length < 2) return null;
  const ordenado = [...pontos].sort((a, b) => (a.time || 0) - (b.time || 0));
  const ini = ordenado[0], fim = ordenado[ordenado.length - 1];
  const precoInicial = ini.close, precoFinal = fim.close;

  const corte = agora.getTime() - 365 * DIA_MS;
  let somaProventos = 0;
  for (const d of dividendos || []) {
    const t = Date.parse(d?.pagamento || "");
    const v = Number(d?.valor);
    if (Number.isFinite(t) && t >= corte && t <= agora.getTime() && Number.isFinite(v) && v > 0) {
      somaProventos += v;
    }
  }

  const pctPreco = ((precoFinal - precoInicial) / precoInicial) * 100;
  const pctProventos = (somaProventos / precoInicial) * 100;
  return {
    pctPreco,
    pctProventos,
    pctTotal: pctPreco + pctProventos,
    precoInicial,
    precoFinal,
    somaProventos,
    meses: Math.max(1, Math.round(((fim.time || 0) - (ini.time || 0)) / (30 * DIA_MS))),
  };
}

/**
 * Prompt pro Gemini com busca no Google. Pede fatos e opiniões DE TERCEIROS
 * (analistas/relatórios), nunca recomendação própria da IA — a projeção que
 * aparece é "o que o mercado está dizendo", com fonte.
 */
export function montarPromptAnaliseAtivo(quote = {}, rent = null) {
  const tk = quote.symbol || "";
  const nome = quote.name || tk;
  const preco = Number.isFinite(quote.price) ? `R$ ${quote.price.toFixed(2)}` : "—";
  const linhaRent = rent
    ? `Rentabilidade dos últimos ~${rent.meses} meses (dados brapi): preço ${rent.pctPreco.toFixed(1)}%, proventos ${rent.pctProventos.toFixed(1)}%, total ~${rent.pctTotal.toFixed(1)}%.`
    : "";
  return [
    `Você é um assistente de finanças. Pesquise no Google sobre o ativo brasileiro ${tk} (${nome}), cotação atual ${preco}.`,
    linhaRent,
    "Responda em português do Brasil, direto e curto, neste formato:",
    "",
    "📰 NOTÍCIAS (as 3-4 mais recentes e relevantes sobre o ativo ou seu setor; uma linha cada, com mês/ano)",
    "🔭 O QUE DIZEM OS ANALISTAS (perspectivas, consenso e preço-alvo SE houver em fontes recentes; deixe claro que é opinião de terceiros e de quando é)",
    "⚠️ RISCOS (2-3 principais riscos citados nas fontes)",
    "",
    "Regras: não invente números nem notícias — se não achar algo recente, diga isso. NÃO faça recomendação de compra ou venda. Máximo ~180 palavras.",
  ].filter(Boolean).join("\n");
}
