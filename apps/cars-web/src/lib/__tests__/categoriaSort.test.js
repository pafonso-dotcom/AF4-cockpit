import { describe, it, expect } from "vitest";
import { ordenarPorNome } from "../categoriaSort.js";

describe("ordenarPorNome", () => {
  it("ordena alfabeticamente por nome", () => {
    const out = ordenarPorNome([{ nome: "Transporte" }, { nome: "Alimentação" }, { nome: "Lazer" }]);
    expect(out.map(c => c.nome)).toEqual(["Alimentação", "Lazer", "Transporte"]);
  });

  it("ignora acentuação e caixa na comparação (pt-BR)", () => {
    const out = ordenarPorNome([{ nome: "água" }, { nome: "Aluguel" }, { nome: "Ônibus" }]);
    expect(out.map(c => c.nome)).toEqual(["água", "Aluguel", "Ônibus"]);
  });

  it("não muta o array original", () => {
    const original = [{ nome: "B" }, { nome: "A" }];
    const out = ordenarPorNome(original);
    expect(original.map(c => c.nome)).toEqual(["B", "A"]);
    expect(out.map(c => c.nome)).toEqual(["A", "B"]);
  });

  it("é robusto a entrada vazia/indefinida", () => {
    expect(ordenarPorNome([])).toEqual([]);
    expect(ordenarPorNome(undefined)).toEqual([]);
  });

  it("trata nome ausente como string vazia (não quebra)", () => {
    const out = ordenarPorNome([{ nome: "Zebra" }, { id: 1 }, { nome: "Abacaxi" }]);
    expect(out.map(c => c.nome)).toEqual([undefined, "Abacaxi", "Zebra"]);
  });
});
