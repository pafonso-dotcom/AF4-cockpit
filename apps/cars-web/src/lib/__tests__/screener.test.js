import { describe, it, expect } from "vitest";
import { normalizarLista, filtrarOrdenar, setoresDaLista, indicadoresDoResultado, lotes } from "../screener.js";

describe("indicadoresDoResultado", () => {
  it("extrai P/L, P/VP, ROE e EV/EBITDA da resposta da brapi", () => {
    const r = {
      symbol: "WEGE3",
      priceEarnings: 32.5,
      defaultKeyStatistics: { priceToBook: 8.77, enterpriseToEbitda: 22.4 },
      financialData: { returnOnEquity: 0.271 }, // fração estilo Yahoo
    };
    const ind = indicadoresDoResultado(r);
    expect(ind.pl).toBeCloseTo(32.5, 2);
    expect(ind.pvp).toBeCloseTo(8.77, 2);
    expect(ind.roe).toBeCloseTo(27.1, 1); // normalizado pra %
    expect(ind.evEbitda).toBeCloseTo(22.4, 1);
  });
  it("ROE já em % não é multiplicado; campos ausentes ficam null", () => {
    const ind = indicadoresDoResultado({ financialData: { returnOnEquity: 27.1 } });
    expect(ind.roe).toBeCloseTo(27.1, 1);
    expect(ind.pl).toBe(null);
    expect(ind.pvp).toBe(null);
  });
  it("resposta vazia não quebra", () => {
    const ind = indicadoresDoResultado(null);
    expect(ind).toEqual({ pl: null, pvp: null, roe: null, evEbitda: null });
  });
});

describe("lotes", () => {
  it("divide em blocos de N", () => {
    expect(lotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(lotes([], 20)).toEqual([]);
  });
});

describe("filtrarOrdenar · indicadores fundamentalistas", () => {
  const lista = [
    { ticker: "BARATA3", nome: "Barata", preco: 10, variacaoPct: 0, volume: 1e6, marketCap: 1e9, setor: "", tipo: "stock", pl: 5.2, pvp: 0.8, roe: 18 },
    { ticker: "CARA3", nome: "Cara", preco: 90, variacaoPct: 0, volume: 2e6, marketCap: 9e9, setor: "", tipo: "stock", pl: 41.0, pvp: 6.1, roe: 22 },
    { ticker: "SEMDADO3", nome: "Sem dado", preco: 20, variacaoPct: 0, volume: 3e6, marketCap: 2e9, setor: "", tipo: "stock", pl: null, pvp: null, roe: null },
  ];
  it("filtra por P/L máx, P/VP máx e ROE mín (sem dado fica fora do filtro)", () => {
    expect(filtrarOrdenar(lista, { plMax: 10 }).map(x => x.ticker)).toEqual(["BARATA3"]);
    expect(filtrarOrdenar(lista, { pvpMax: 1 }).map(x => x.ticker)).toEqual(["BARATA3"]);
    expect(filtrarOrdenar(lista, { roeMin: 20 }).map(x => x.ticker)).toEqual(["CARA3"]);
  });
  it("ordena por pl asc com null no fim", () => {
    const r = filtrarOrdenar(lista, { ordenarPor: "pl", direcao: "asc" });
    expect(r.map(x => x.ticker)).toEqual(["SEMDADO3", "BARATA3", "CARA3"]);
  });
});

const raw = {
  stocks: [
    { stock: "PETR4", name: "Petrobras", close: 38.5, change: 1.2, volume: 50000000, market_cap: 500e9, sector: "Energy Minerals", type: "stock", logo: "x.png" },
    { stock: "HGLG11", name: "CSHG Logística", close: 160.0, change: -0.4, volume: 800000, market_cap: 5e9, sector: null, type: "fund" },
    { stock: "AAPL34", name: "Apple BDR", close: 60.1, change: 0.9, volume: 2000000, market_cap: null, sector: "Electronic Technology", type: "bdr" },
    { stock: "ZZZZ3", name: "Sem preço", close: null, change: null, volume: 0, market_cap: null, sector: "Finance", type: "stock" },
  ],
};

describe("normalizarLista", () => {
  it("normaliza os campos da brapi e descarta itens sem preço", () => {
    const lista = normalizarLista(raw);
    expect(lista).toHaveLength(3); // ZZZZ3 sem close cai fora
    const petr = lista.find((x) => x.ticker === "PETR4");
    expect(petr).toMatchObject({ nome: "Petrobras", preco: 38.5, variacaoPct: 1.2, setor: "Energy Minerals", tipo: "stock" });
  });
  it("tolera resposta vazia/malformada", () => {
    expect(normalizarLista(null)).toEqual([]);
    expect(normalizarLista({})).toEqual([]);
  });
});

describe("filtrarOrdenar", () => {
  const lista = normalizarLista(raw);

  it("filtra por tipo", () => {
    expect(filtrarOrdenar(lista, { tipo: "fund" }).map((x) => x.ticker)).toEqual(["HGLG11"]);
  });
  it("filtra por busca (ticker ou nome, sem caixa)", () => {
    expect(filtrarOrdenar(lista, { busca: "petro" }).map((x) => x.ticker)).toEqual(["PETR4"]);
    expect(filtrarOrdenar(lista, { busca: "aapl" }).map((x) => x.ticker)).toEqual(["AAPL34"]);
  });
  it("filtra por setor, preço e volume mínimo", () => {
    expect(filtrarOrdenar(lista, { setor: "Energy Minerals" }).map((x) => x.ticker)).toEqual(["PETR4"]);
    expect(filtrarOrdenar(lista, { precoMax: 100 }).map((x) => x.ticker).sort()).toEqual(["AAPL34", "PETR4"]);
    expect(filtrarOrdenar(lista, { volumeMin: 1e7 }).map((x) => x.ticker)).toEqual(["PETR4"]);
  });
  it("ordena por qualquer coluna nas duas direções", () => {
    expect(filtrarOrdenar(lista, { ordenarPor: "preco", direcao: "desc" })[0].ticker).toBe("HGLG11");
    expect(filtrarOrdenar(lista, { ordenarPor: "variacaoPct", direcao: "asc" })[0].ticker).toBe("HGLG11");
  });
  it("sem filtros devolve tudo ordenado por volume desc (default)", () => {
    expect(filtrarOrdenar(lista, {})[0].ticker).toBe("PETR4");
  });
});

describe("setoresDaLista", () => {
  it("extrai setores únicos ordenados, ignorando vazios", () => {
    const lista = normalizarLista(raw);
    expect(setoresDaLista(lista)).toEqual(["Electronic Technology", "Energy Minerals"]);
  });
});
