// Cliente BRAPI (cotações de ações/FIIs/ETFs/BDRs da B3).
// Produção: chama o proxy /api/brapi (token fica no servidor — Fase 3).
// Dev/local: se houver token em localStorage, chama a BRAPI direto.
const BRAPI_DIRECT = "https://brapi.dev/api";
const BRAPI_PROXY = "/api/brapi";

function getToken() {
  try { return localStorage.getItem("af4:brapi-token") || ""; } catch { return ""; }
}

async function brapiFetch(path) {
  const token = getToken();
  const url = token
    ? `${BRAPI_DIRECT}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
    : `${BRAPI_PROXY}${path}`;
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.text();
    if (r.status === 401 || r.status === 403) throw new Error("Token BRAPI inválido. Verifique em ⚙ Configurações.");
    if (r.status === 429) throw new Error("Limite mensal BRAPI atingido (1.000 req/mês free). Reseta dia 1.");
    throw new Error(`BRAPI ${r.status}: ${err.slice(0, 150)}`);
  }
  return r.json();
}

export async function getQuotes(tickers) {
  if (!tickers?.length) return [];
  const list = tickers.join(",");
  const data = await brapiFetch(`/quote/${list}`);
  return (data.results || []).map(r => ({
    symbol: r.symbol,
    name: r.longName || r.shortName,
    price: r.regularMarketPrice,
    change: r.regularMarketChange,
    changePercent: r.regularMarketChangePercent,
    volume: r.regularMarketVolume,
    dayLow: r.regularMarketDayLow,
    dayHigh: r.regularMarketDayHigh,
    fiftyTwoWeekLow: r.fiftyTwoWeekLow,
    fiftyTwoWeekHigh: r.fiftyTwoWeekHigh,
    logoUrl: r.logourl,
  }));
}

export async function getHistorico(ticker, range = "6mo", interval = "1d") {
  const data = await brapiFetch(`/quote/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`);
  const hist = data.results?.[0]?.historicalDataPrice || [];
  return hist
    .filter(h => h && h.close != null)
    .map(h => ({
      time: (h.date || 0) * 1000,
      open: Number(h.open ?? h.close),
      high: Number(h.high ?? h.close),
      low: Number(h.low ?? h.close),
      close: Number(h.close),
      volume: Number(h.volume || 0),
    }));
}

export async function getIndices() {
  try {
    const data = await brapiFetch("/quote/list?type=index");
    return (data.indexes || data.stocks || []).map(r => ({
      symbol: r.stock || r.symbol,
      name: r.name,
      price: r.close ?? r.regularMarketPrice,
      changePercent: r.change ?? r.regularMarketChangePercent,
    }));
  } catch {
    // Fallback: pega IBOV + IFIX direto
    const data = await brapiFetch("/quote/^BVSP,IFIX");
    return (data.results || []).map(r => ({
      symbol: r.symbol,
      name: r.longName || r.shortName,
      price: r.regularMarketPrice,
      changePercent: r.regularMarketChangePercent,
    }));
  }
}

export async function getCurrencies(pairs = ["USD-BRL", "EUR-BRL", "BTC-BRL"]) {
  const list = pairs.join(",");
  const data = await brapiFetch(`/v2/currency?currency=${list}`);
  return (data.currency || []).map(c => ({
    from: c.fromCurrency,
    to: c.toCurrency,
    price: parseFloat(c.bidPrice),
    changePercent: parseFloat(c.percentChange),
  }));
}

export async function pingBRAPI(token) {
  try {
    const useToken = token || getToken();
    if (!useToken) return { ok: false, erro: "Sem token" };
    const r = await fetch(`${BRAPI_BASE}/quote/PETR4?token=${encodeURIComponent(useToken)}`);
    if (!r.ok) return { ok: false, erro: `BRAPI ${r.status}` };
    const data = await r.json();
    return { ok: true, resposta: `PETR4 = R$ ${data.results?.[0]?.regularMarketPrice ?? "?"}` };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}
