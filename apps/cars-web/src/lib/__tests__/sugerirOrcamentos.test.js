import { describe, it, expect } from "vitest";
import { sugerirOrcamentos, degrauOrcamento } from "../sugerirOrcamentos.js";

describe("degrauOrcamento", () => {
  it("arredonda pra cima em degraus 10/50/100", () => {
    expect(degrauOrcamento(87)).toBe(90);
    expect(degrauOrcamento(304.17)).toBe(350);
    expect(degrauOrcamento(1654.5)).toBe(1700);
    expect(degrauOrcamento(0)).toBe(0);
  });
});

describe("sugerirOrcamentos", () => {
  const categorias = [
    { id: "ali", nome: "Alimentação", tipo: "despesa", limite: 4000 },
    { id: "pad", nome: "Padaria", tipo: "despesa", parentId: "ali" }, // filha: rola na mãe
    { id: "laz", nome: "Lazer", tipo: "despesa" },
    { id: "sal", nome: "Salário", tipo: "receita" },                  // receita: fora
    { id: "vaz", nome: "Sem uso", tipo: "despesa" },                  // sem gasto: fora
  ];
  const mesesItens = [
    [ { categoria: "Alimentação", valor: 300 }, { categoria: "Padaria", valor: 100 }, { categoria: "Lazer", valor: 200 } ],
    [ { categoria: "Alimentação", valor: 500 }, { categoria: "Lazer", valor: 0 } ],
    [],
  ];
  const s = sugerirOrcamentos({ categorias, mesesItens });

  it("média por raiz (filha somada), só meses com gasto, ordena por média", () => {
    expect(s.map(x => x.nome)).toEqual(["Alimentação", "Lazer"]);
    expect(s[0].media).toBe((400 + 500) / 2); // mês1: 300+100 filha; mês2: 500
    expect(s[0].sugestao).toBe(450);
    expect(s[0].atual).toBe(4000);
    expect(s[1]).toMatchObject({ media: 200, sugestao: 200, meses: 1, atual: null });
  });
});
