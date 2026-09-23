import { describe, it, expect } from "vitest";
import { ordenarPorNome, arvoreCategorias } from "../categoriaSort.js";

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

describe("arvoreCategorias — seletor hierárquico (pais → filhas)", () => {
  const cats = [
    { id: "ali", nome: "Alimentação", tipo: "despesa" },
    { id: "pad", nome: "Padaria", tipo: "despesa", parentId: "ali" },
    { id: "mer", nome: "Mercado", tipo: "despesa", parentId: "ali" },
    { id: "laz", nome: "Lazer", tipo: "despesa" },
    { id: "sal", nome: "Salário", tipo: "receita" },
    { id: "orf", nome: "Órfã", tipo: "despesa", parentId: "sumiu" },
  ];

  it("lista só os pais, com filhas ordenadas dentro", () => {
    const arv = arvoreCategorias(cats, "despesa");
    expect(arv.map(x => x.pai.nome)).toEqual(["Alimentação", "Lazer", "Órfã"]);
    expect(arv[0].filhas.map(f => f.nome)).toEqual(["Mercado", "Padaria"]);
    expect(arv[1].filhas).toEqual([]);
  });

  it("filtra por tipo (regra flexível: sem tipo também entra)", () => {
    const arv = arvoreCategorias([...cats, { id: "x", nome: "Ajuste" }], "receita");
    expect(arv.map(x => x.pai.nome)).toEqual(["Ajuste", "Salário"]);
  });

  it("sem tipo, entram todas as raízes", () => {
    expect(arvoreCategorias(cats).map(x => x.pai.nome)).toEqual(["Alimentação", "Lazer", "Órfã", "Salário"]);
  });
});
