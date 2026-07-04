// Cliente BRAPI (cotações de ações/FIIs/ETFs/BDRs da B3)
// 1.000 req/mês na camada free. Token em localStorage("af4:brapi-token").
const BRAPI_BASE = "https://brapi.dev/api";

function getToken() {
  try {
    const direto = localStorage.getItem("af4:brapi-token");
    if (direto) return direto;
    // Fallback: o token também vive no blob de chaves sincronizado na conta
    // (financas:apikeys:v1 → apiKeys.brapi). Se estiver só lá (aparelho novo,
    // cache limpo), usa e regrava o espelho pra próxima leitura ser direta.
    const blob = JSON.parse(localStorage.getItem("financas:apikeys:v1") || "null");
    const doBlob = (blob?.brapi || "").trim();
    if (doBlob) {
      try { localStorage.setItem("af4:brapi-token", doBlob); } catch {}
      return doBlob;
    }
    return "";
  } catch { return ""; }
}

async function brapiFetch(path) {
  const token = getToken();
  if (!token) throw new Error("Token BRAPI não configurado. Vá em ⚙ Configurações → APIs → BRAPI (o token gratuito sai na hora em brapi.dev).");
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${BRAPI_BASE}${path}${sep}token=${encodeURIComponent(token)}`);
  if (!r.ok) {
    const err = await r.text();
    // A brapi manda a razão no corpo (JSON { message } ou texto). 401/403 pode
    // ser token inválido OU recurso fora do plano (ex.: ?dividends=true é pago
    // em alguns planos) — mostrar a mensagem real em vez de culpar o token.
    let msg = "";
    try { msg = JSON.parse(err)?.message || ""; } catch { msg = err; }
    msg = String(msg || "").slice(0, 180);
    if (r.status === 401 || r.status === 403) {
      if (/plan|plano|upgrade|assinatura|subscription|not (available|allowed)|não (está )?dispon/i.test(msg)) {
        throw new Error(`Recurso fora do seu plano brapi: ${msg} (a lista de cotações continua funcionando; histórico de dividendos pode exigir plano pago em brapi.dev/pricing).`);
      }
      throw new Error(`BRAPI recusou o acesso (${r.status})${msg ? `: ${msg}` : ""}. Confira o token em ⚙ Configurações → APIs.`);
    }
    if (r.status === 429) throw new Error("Limite de requisições da BRAPI atingido. Aguarde ou confira sua cota em brapi.dev.");
    throw new Error(`BRAPI ${r.status}: ${msg || err.slice(0, 150)}`);
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

/**
 * Histórico de proventos anunciados (dividendos/JCP/rendimentos) de um ticker.
 * Fonte: brapi `?dividends=true` → results[0].dividendsData.cashDividends.
 * Retorna [{ pagamento:"YYYY-MM-DD", dataCom:"YYYY-MM-DD"|null, valor, tipo }],
 * mais recente primeiro.
 */
export async function getDividendos(ticker) {
  const data = await brapiFetch(`/quote/${encodeURIComponent(ticker)}?dividends=true`);
  const divs = data.results?.[0]?.dividendsData?.cashDividends || [];
  return divs
    .filter((d) => d && d.paymentDate && Number(d.rate) > 0)
    .map((d) => ({
      pagamento: String(d.paymentDate).slice(0, 10),
      dataCom: d.lastDatePrior ? String(d.lastDatePrior).slice(0, 10) : null,
      valor: Number(d.rate),
      tipo: d.label || "Dividendo",
    }))
    .sort((a, b) => b.pagamento.localeCompare(a.pagamento));
}

/**
 * Lista completa do mercado B3 (ações + FIIs + BDRs) — UMA requisição.
 * Base do Screener. Retorna o JSON cru da brapi ({ stocks: [...] }).
 */
export async function getListaMercado() {
  return brapiFetch("/quote/list?limit=3000");
}

/**
 * Fundamentos oficiais de um ticker (P/L, ROE, margens, dívida, DY etc.).
 * Requer plano brapi com módulos fundamentalistas. Retorna results[0] cru —
 * o mapeamento pros critérios IdV fica em lib/fundamentosBrapi.js.
 */
export async function getFundamentosBrapi(ticker) {
  const data = await brapiFetch(`/quote/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,financialData&fundamental=true`);
  return data.results?.[0] || null;
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
