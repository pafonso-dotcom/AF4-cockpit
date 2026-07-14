import { describe, it, expect } from "vitest";
import { sugerirCategorias, precisaCategoria } from "../autoCategorizar.js";

const CAT = [
  { nome: "Taxas Bancos", tipo: "despesa" },
  { nome: "Alimentação", tipo: "despesa" },
  { nome: "Investimento", tipo: "despesa" },
  { nome: "Moradia", tipo: "despesa" },
];
const tx = (id, descricao, categoria, valor = 10, tipo = "despesa") => ({ id, descricao, categoria, valor, tipo });

describe("precisaCategoria", () => {
  const nomes = new Set(CAT.map((c) => c.nome));
  it("Outros, vazia e órfã precisam; válida não", () => {
    expect(precisaCategoria(tx(1, "x", "Outros"), nomes)).toBe(true);
    expect(precisaCategoria(tx(2, "x", ""), nomes)).toBe(true);
    expect(precisaCategoria(tx(3, "x", "CategoriaInexistente"), nomes)).toBe(true);
    expect(precisaCategoria(tx(4, "x", "Moradia"), nomes)).toBe(false);
  });
});

describe("sugerirCategorias", () => {
  it("sugere pela descrição só pras que precisam, agrupando", () => {
    const t = [
      tx(1, "Tarifa pix", "Outros"),
      tx(2, "MERCADINHO SONODA ITAPETININGA", "Outros"),
      tx(3, "Debito Aut. Titulo Capitalizacao ICI", "Outros"),
      tx(4, "PAULO FRALETTI OZI", "Outros"),      // sem regra
      tx(5, "Aluguel do mês", "Moradia"),         // já válida → ignora
    ];
    const r = sugerirCategorias(t, CAT);
    const mapa = Object.fromEntries(r.sugestoes.map((s) => [s.id, s.sugerida]));
    expect(mapa[1]).toBe("Taxas Bancos");
    expect(mapa[2]).toBe("Alimentação");
    expect(mapa[3]).toBe("Investimento");
    expect(mapa[4]).toBeUndefined();     // sem sugestão
    expect(mapa[5]).toBeUndefined();     // já categorizada
    expect(r.semSugestao).toBe(1);
    expect(r.porCategoria["Taxas Bancos"]).toHaveLength(1);
  });

  it("não sugere categoria que não existe no cadastro", () => {
    const semAlim = CAT.filter((c) => c.nome !== "Alimentação");
    const r = sugerirCategorias([tx(1, "MERCADINHO SONODA", "Outros")], semAlim);
    expect(r.sugestoes).toHaveLength(0);
    expect(r.semSugestao).toBe(1);
  });

  it("não mexe em quem já está na categoria certa", () => {
    const r = sugerirCategorias([tx(1, "Tarifa pix", "Taxas Bancos")], CAT);
    expect(r.sugestoes).toHaveLength(0);
  });
});
