import { describe, it, expect } from "vitest";
import { normalizarLista, filtrarOrdenar, setoresDaLista } from "../screener.js";

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
