/**
 * 🚨 Radar de Risco da Carteira (2026-09-29).
 * NÃO é previsão de queda — ninguém prevê bolsa. É um placar de SINAIS
 * objetivos, calculados dos dados da brapi, que dizem quais ativos da
 * carteira merecem atenção primeiro (a IA explica o porquê depois, com
 * fontes). Puro e testável.
 *
 * Sinais e pesos:
 *  - preço caiu ≥20% em 12m (+35) ou ≥10% (+25)
 *  - preço caindo ≥7% nos últimos ~3m (+20)
 *  - negociando a ≤20% da faixa de 52 semanas (perto da mínima) (+20)
 *  - proventos do último semestre ≥30% menores que o semestre anterior (+15)
 *  - concentração: ativo ≥40% da carteira (+20) ou ≥25% (+15)
 * Nível: ≥50 = "atencao" 🔴 · ≥25 = "observar" 🟡 · resto = "ok" 🟢
 */

const DIA_MS = 24 * 60 * 60 * 1000;

export function avaliarAtivoRisco({ ativo = {}, hist = [], dividendos = [], pesoPct = 0, agora = new Date() }) {
  const pontos = (hist || []).filter(p => p && Number.isFinite(p.close) && p.close > 0)
    .sort((a, b) => (a.time || 0) - (b.time || 0));
  const sinais = [];
  let score = 0;
  const det = { pct12m: null, pct3m: null, posFaixa: null, quedaProv: null, pesoPct };

  if (pontos.length >= 2) {
    const ini = pontos[0], fim = pontos[pontos.length - 1];
    det.pct12m = ((fim.close - ini.close) / ini.close) * 100;
    if (det.pct12m <= -20) { score += 35; sinais.push(`preço caiu ${Math.abs(det.pct12m).toFixed(0)}% em 12 meses`); }
    else if (det.pct12m <= -10) { score += 25; sinais.push(`preço caiu ${Math.abs(det.pct12m).toFixed(0)}% em 12 meses`); }

    const corte3m = (fim.time || 0) - 92 * DIA_MS;
    const base3m = pontos.find(p => (p.time || 0) >= corte3m);
    if (base3m && base3m !== fim && base3m.close > 0) {
      det.pct3m = ((fim.close - base3m.close) / base3m.close) * 100;
      if (det.pct3m <= -7) { score += 20; sinais.push(`caindo ${Math.abs(det.pct3m).toFixed(0)}% nos últimos 3 meses`); }
    }

    const closes = pontos.map(p => p.close);
    const min = Math.min(...closes), max = Math.max(...closes);
    if (max > min) {
      det.posFaixa = ((fim.close - min) / (max - min)) * 100;
      if (det.posFaixa <= 20) { score += 20; sinais.push(`a ${det.posFaixa.toFixed(0)}% da faixa de 52 semanas (perto da mínima)`); }
    }
  }

  // Proventos: último semestre × semestre anterior (janela de 12 meses).
  const t = agora.getTime();
  let recente = 0, anterior = 0;
  for (const d of dividendos || []) {
    const td = Date.parse(d?.pagamento || "");
    const v = Number(d?.valor);
    if (!Number.isFinite(td) || !Number.isFinite(v) || v <= 0) continue;
    if (td > t) continue;
    if (td >= t - 182 * DIA_MS) recente += v;
    else if (td >= t - 365 * DIA_MS) anterior += v;
  }
  if (anterior > 0) {
    det.quedaProv = (1 - recente / anterior) * 100;
    if (det.quedaProv >= 30) { score += 15; sinais.push(`proventos ${det.quedaProv.toFixed(0)}% menores no último semestre`); }
  }

  if (pesoPct >= 40) { score += 20; sinais.push(`concentra ${pesoPct.toFixed(0)}% da carteira`); }
  else if (pesoPct >= 25) { score += 15; sinais.push(`concentra ${pesoPct.toFixed(0)}% da carteira`); }

  score = Math.min(100, score);
  const nivel = score >= 50 ? "atencao" : score >= 25 ? "observar" : "ok";
  return { ticker: (ativo.ticker || "").toUpperCase(), nome: ativo.nome || "", tipo: ativo.tipo || "", score, nivel, sinais, det };
}

/** Avalia a carteira inteira e devolve do mais preocupante pro mais tranquilo. */
export function calcularRadarRisco(itens = [], agora = new Date()) {
  return itens.map(x => avaliarAtivoRisco({ ...x, agora }))
    .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));
}

/** Prompt pro Gemini com busca explicar POR QUE os piores estão no radar. */
export function montarPromptRadar(piores = []) {
  const linhas = piores.map(p => `- ${p.ticker}${p.nome ? ` (${p.nome})` : ""}: ${p.sinais.join("; ") || "sem sinais numéricos"}`);
  return [
    "Você é um assistente de finanças. Os ativos brasileiros abaixo apareceram no topo do radar de risco de uma carteira, com estes SINAIS calculados de dados de mercado:",
    ...linhas,
    "",
    "Pesquise no Google e explique, EM SEPARADO PARA CADA ATIVO (título = ticker), em 2-3 linhas cada:",
    "o que está acontecendo com o ativo ou o setor dele (notícias recentes, com mês/ano) e o que analistas dizem sobre as perspectivas — deixando claro que é opinião de terceiros.",
    "Regras: não invente fatos nem números; se não achar nada recente sobre algum, diga isso. NÃO faça recomendação de compra ou venda. Português do Brasil, máximo ~200 palavras no total.",
  ].join("\n");
}
