/* ============================================================
   APIs de Mercado — funcionam sem chave, melhor com chave
   - Brapi (brapi.dev)              : ações + FIIs BR. Token opcional aumenta limites.
   - CoinGecko (coingecko.com)      : cripto. Sem chave necessária no tier público.
   - AwesomeAPI (awesomeapi.com.br) : câmbio. Totalmente livre, sem chave.
   - Alpha Vantage (alphavantage.co): ações globais. Chave obrigatória (free).
   ============================================================ */

const COIN_MAP = {
  BTC: "bitcoin",   ETH: "ethereum", SOL: "solana",   ADA: "cardano",
  DOT: "polkadot",  BNB: "binancecoin", XRP: "ripple", DOGE: "dogecoin",
  MATIC: "matic-network", LTC: "litecoin", AVAX: "avalanche-2",
};

const API = {
  async brapiQuotes(tickers, token) {
    if (!tickers.length) return null;
    const url = `https://brapi.dev/api/quote/${tickers.join(",")}${token ? `?token=${token}` : ""}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Brapi ${r.status}`);
      const j = await r.json();
      return j.results || null;
    } catch { return null; }
  },
  async coingeckoPrices(coinIds) {
    if (!coinIds.length) return null;
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(",")}&vs_currencies=brl&include_24hr_change=true`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`CoinGecko ${r.status}`);
      return await r.json();
    } catch { return null; }
  },
  async currencies(pairs = ["USD-BRL", "EUR-BRL", "GBP-BRL", "BTC-BRL"]) {
    const url = `https://economia.awesomeapi.com.br/json/last/${pairs.join(",")}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`AwesomeAPI ${r.status}`);
      return await r.json();
    } catch { return null; }
  },
  async indices(token) {
    // Primário: proxy Yahoo no Worker (sem CORS, sem token, dados ao vivo).
    try {
      const r = await fetch("/api/indices");
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.results) && j.results.length) return j.results;
      }
    } catch { /* cai no fallback brapi */ }
    // Fallback: brapi (legado — exige token p/ dados completos).
    const url = `https://brapi.dev/api/quote/^BVSP,^GSPC,^IXIC${token ? `?token=${token}` : ""}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Indices ${r.status}`);
      const j = await r.json();
      return j.results || null;
    } catch { return null; }
  },
  // Consulta de placa via rota do Worker (/api/placa) — o Worker injeta os
  // tokens da APIBrasil e repassa. Devolve o JSON cru da API (data) p/ o
  // front mapear. Lança em erro de rede/credencial.
  async consultarPlaca(placa) {
    const r = await fetch(`/api/placa?placa=${encodeURIComponent(placa)}`);
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || `Falha na consulta (HTTP ${r.status})`);
    return j.data;
  },
  async testBrapi(token) {
    const url = `https://brapi.dev/api/quote/PETR4${token ? `?token=${token}` : ""}`;
    try {
      const r = await fetch(url);
      if (!r.ok) return { ok: false, msg: `HTTP ${r.status}` };
      const j = await r.json();
      return { ok: !!(j.results && j.results.length), msg: j.results?.[0]?.regularMarketPrice ? "Conexão estabelecida" : "Sem dados" };
    } catch (e) { return { ok: false, msg: "Falha de rede" }; }
  },
  async testAlphaVantage(key) {
    if (!key) return { ok: false, msg: "Chave vazia" };
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${key}`;
    try {
      const r = await fetch(url);
      if (!r.ok) return { ok: false, msg: `HTTP ${r.status}` };
      const j = await r.json();
      if (j.Note) return { ok: false, msg: "Limite atingido" };
      if (j["Error Message"]) return { ok: false, msg: "Chave inválida" };
      return { ok: !!j["Global Quote"], msg: "Conexão estabelecida" };
    } catch { return { ok: false, msg: "Falha de rede" }; }
  },
};

export { COIN_MAP, API };
