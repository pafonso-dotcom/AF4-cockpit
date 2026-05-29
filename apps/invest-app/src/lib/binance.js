// Cliente público Binance (sem chave) — usado em Investimentos (cripto) e AF4 Trade.
const BASE = "https://api.binance.com/api/v3";

export async function getTicker24h(symbol) {
  const r = await fetch(`${BASE}/ticker/24hr?symbol=${symbol}`);
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  return r.json();
}

export async function getTickers24h(symbols) {
  if (!symbols || symbols.length === 0) return [];
  const url = `${BASE}/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  return r.json();
}

export async function getKlines(symbol, interval = "4h", limit = 100) {
  const r = await fetch(`${BASE}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`);
  if (!r.ok) throw new Error(`Binance ${r.status}`);
  const raw = await r.json();
  return raw.map(k => ({
    time: k[0],
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
    volume: parseFloat(k[5]),
    closeTime: k[6],
  }));
}

export function isCriptoSymbol(s) {
  return /USDT$|BUSD$|USDC$/i.test(s || "");
}
