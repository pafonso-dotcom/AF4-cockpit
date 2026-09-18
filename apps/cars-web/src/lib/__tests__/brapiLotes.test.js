import { describe, it, expect, beforeEach, vi } from "vitest";

// Shim de localStorage (ambiente node) com token da BRAPI configurado
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const { getQuotes } = await import("../brapi.js");

const okResponse = (results) => ({ ok: true, json: async () => ({ results }) });

describe("getQuotes em lotes (limite da BRAPI por requisição)", () => {
  beforeEach(() => {
    mem.clear();
    mem.set("af4:brapi-token", "tok");
    vi.restoreAllMocks();
  });

  it("divide 20 tickers em 2 requisições de 10 e junta os resultados", async () => {
    const tickers = Array.from({ length: 20 }, (_, i) => `TCK${i}`);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const lista = decodeURIComponent(String(url)).match(/\/quote\/([^?]+)/)[1].split(",");
      expect(lista.length).toBeLessThanOrEqual(10);
      return okResponse(lista.map(s => ({ symbol: s, regularMarketPrice: 10 })));
    });
    const quotes = await getQuotes(tickers);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(quotes.length).toBe(20);
    expect(quotes[0].symbol).toBe("TCK0");
    expect(quotes[19].price).toBe(10);
  });

  it("um lote com erro não derruba os outros", async () => {
    const tickers = Array.from({ length: 12 }, (_, i) => `TCK${i}`);
    let chamada = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      chamada++;
      if (chamada === 1) return { ok: false, status: 500, text: async () => "boom" };
      return okResponse([{ symbol: "TCK10", regularMarketPrice: 5 }, { symbol: "TCK11", regularMarketPrice: 6 }]);
    });
    const quotes = await getQuotes(tickers);
    expect(quotes.map(q => q.symbol)).toEqual(["TCK10", "TCK11"]);
  });

  it("se TODOS os lotes falham, relança o erro", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500, text: async () => "boom" });
    await expect(getQuotes(["A", "B"])).rejects.toThrow(/BRAPI 500/);
  });
});
