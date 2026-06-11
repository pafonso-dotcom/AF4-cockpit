// Orquestrador unificado de cotações: roteia entre BRAPI (ações/FIIs) e Binance (cripto).
import { getQuotes, getIndices, getCurrencies } from "./brapi.js";
import { getTickers24h } from "./binance.js";

export function detectarFonte(ticker) {
  if (/USDT$|BUSD$|USDC$/i.test(ticker)) return "binance";
  return "brapi"; // PETR4, HGRE11, etc
}

// ativos: [{ symbol: "PETR4", qtd, pm }, ...]
export async function atualizarCarteira(ativos) {
  if (!Array.isArray(ativos) || ativos.length === 0) {
    return { cotacoes: {}, timestamp: new Date().toISOString(), erros: [] };
  }

  // Capital Social é 100% manual — nunca busca cotação de mercado.
  const negociaveis = ativos.filter(a => a.tipo !== "capitalSocial");
  const tickersBR = negociaveis.filter(a => detectarFonte(a.ticker || a.symbol) === "brapi").map(a => a.ticker || a.symbol);
  const tickersCripto = negociaveis.filter(a => detectarFonte(a.ticker || a.symbol) === "binance").map(a => a.ticker || a.symbol);

  const promises = [];
  if (tickersBR.length) promises.push(getQuotes(tickersBR).catch(e => ({ erro: e.message, fonte: "brapi" })));
  if (tickersCripto.length) promises.push(getTickers24h(tickersCripto).catch(e => ({ erro: e.message, fonte: "binance" })));

  // Cripto da Binance vem em USDT (≈ USD); convertemos pra BRL com o câmbio atual.
  let usdBrl = 1;
  if (tickersCripto.length) {
    try {
      const moedas = await getCurrencies(["USD-BRL"]);
      const usd = moedas.find(c => c.from === "USD" && c.to === "BRL");
      if (usd && usd.price > 0) usdBrl = usd.price;
    } catch (e) { /* sem câmbio: mantém preço em USD como fallback */ }
  }

  const resultados = await Promise.all(promises);

  const cotacoes = {};
  const erros = [];

  for (const r of resultados) {
    if (!r) continue;
    if (r.erro) { erros.push(`${r.fonte}: ${r.erro}`); continue; }
    if (Array.isArray(r)) {
      r.forEach(q => {
        // BRAPI: tem `symbol` + `price` + `changePercent`
        // Binance: tem `symbol` + `lastPrice` + `priceChangePercent`
        if (q.lastPrice !== undefined) {
          cotacoes[q.symbol] = {
            symbol: q.symbol,
            price: parseFloat(q.lastPrice) * usdBrl,
            changePercent: parseFloat(q.priceChangePercent),
            volume: parseFloat(q.volume),
            fonte: "binance",
          };
        } else {
          cotacoes[q.symbol] = { ...q, fonte: "brapi" };
        }
      });
    }
  }

  return { cotacoes, timestamp: new Date().toISOString(), erros };
}

// Aba Mercado: índices + moedas
export async function getMercadoGeral() {
  const [indices, currencies] = await Promise.all([
    getIndices().catch(() => []),
    getCurrencies().catch(() => []),
  ]);

  const items = [
    ...indices,
    ...currencies.map(c => ({
      symbol: `${c.from}/${c.to}`,
      name: `${c.from} → ${c.to}`,
      price: c.price,
      changePercent: c.changePercent,
    })),
  ];

  return { indices: items, timestamp: new Date().toISOString() };
}
