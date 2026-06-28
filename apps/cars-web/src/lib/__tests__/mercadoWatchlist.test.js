import { describe, it, expect } from "vitest";
import { adicionarPapel, removerPapel, definirPeso, somaPesos, normalizarPesos } from "../mercadoWatchlist.js";

describe("mercadoWatchlist", () => {
  it("adiciona papel normalizando o ticker e sem duplicar", () => {
    let l = adicionarPapel([], { symbol: "petr4", name: "Petrobras" });
    expect(l).toEqual([{ symbol: "PETR4", name: "Petrobras", peso: 0 }]);
    l = adicionarPapel(l, { symbol: "PETR4" }); // duplicata
    expect(l.length).toBe(1);
  });

  it("remove papel por símbolo (case-insensitive)", () => {
    const l = [{ symbol: "PETR4", peso: 0 }, { symbol: "VALE3", peso: 0 }];
    expect(removerPapel(l, "petr4")).toEqual([{ symbol: "VALE3", peso: 0 }]);
  });

  it("define peso e soma pesos", () => {
    let l = [{ symbol: "PETR4", peso: 0 }, { symbol: "VALE3", peso: 0 }];
    l = definirPeso(l, "PETR4", 30);
    l = definirPeso(l, "VALE3", 20);
    expect(somaPesos(l)).toBe(50);
  });

  it("normaliza pesos pra somar 100 mantendo proporção", () => {
    const l = [{ symbol: "A", peso: 30 }, { symbol: "B", peso: 10 }];
    const n = normalizarPesos(l);
    expect(n[0].peso).toBe(75);
    expect(n[1].peso).toBe(25);
    expect(somaPesos(n)).toBeCloseTo(100, 5);
  });

  it("distribui igual quando todos os pesos são zero", () => {
    const l = [{ symbol: "A", peso: 0 }, { symbol: "B", peso: 0 }, { symbol: "C", peso: 0 }];
    const n = normalizarPesos(l);
    expect(n.every((x) => x.peso === Math.round((100 / 3) * 100) / 100)).toBe(true);
  });
});
