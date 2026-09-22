import { describe, it, expect } from "vitest";
import { diagnosticoCategorias, aplicarUnificacao } from "../categoriasDiagnostico.js";

const categorias = [
  { id: "c1", nome: "Mercado", tipo: "despesa", subcategorias: [{ id: "s1", nome: "Feira" }] },
  { id: "c2", nome: "mercado ", tipo: "despesa" },                      // duplicada (caixa/espaço)
  { id: "c3", nome: "Transporte", tipo: "despesa" },
  { id: "c4", nome: "Uber", tipo: "despesa", parentId: "c3" },          // filha usada
  { id: "c5", nome: "Assinaturas", tipo: "despesa" },                   // sem uso
  { id: "c6", nome: "Salário", tipo: "receita" },
];
const transacoes = [
  { id: "t1", tipo: "despesa", categoria: "Mercado", valor: 50, data: "2026-09-01" },
  { id: "t2", tipo: "despesa", categoria: "Mercado", valor: 30, data: "2026-09-02", subcategoria: "Padaria" }, // sub órfã
  { id: "t3", tipo: "despesa", categoria: "mercado ", valor: 20, data: "2026-09-03" },
  { id: "t4", tipo: "despesa", categoria: "Uber", valor: 25, data: "2026-09-04" },
  { id: "t5", tipo: "despesa", categoria: "Farmácia", valor: 40, data: "2026-09-05" }, // fora do cadastro
  { id: "t6", tipo: "receita", categoria: "Freelas", valor: 900, data: "2026-09-06" }, // fora, receita
];

describe("diagnosticoCategorias", () => {
  const d = diagnosticoCategorias({ categorias, transacoes });

  it("acha categorias usadas fora do cadastro com tipo sugerido", () => {
    expect(d.foraDoCadastro.map(f => f.nome).sort()).toEqual(["Farmácia", "Freelas"]);
    expect(d.foraDoCadastro.find(f => f.nome === "Freelas").tipoSugerido).toBe("receita");
    expect(d.foraDoCadastro.find(f => f.nome === "Farmácia").tipoSugerido).toBe("despesa");
  });

  it("agrupa duplicadas mantendo a de mais uso/estrutura", () => {
    expect(d.duplicadas).toHaveLength(1);
    expect(d.duplicadas[0].manter.id).toBe("c1"); // 2 usos + subcategoria
    expect(d.duplicadas[0].remover.map(c => c.id)).toEqual(["c2"]);
  });

  it("acha subcategoria órfã", () => {
    expect(d.subOrfas).toHaveLength(1);
    expect(d.subOrfas[0]).toMatchObject({ subcategoria: "Padaria", usos: 1 });
    expect(d.subOrfas[0].categoria.id).toBe("c1");
  });

  it("sem uso: Assinaturas sim; Transporte não (filha Uber tem uso); Salário sim", () => {
    expect(d.semUso.map(c => c.nome).sort()).toEqual(["Assinaturas", "Salário"]);
  });
});

describe("aplicarUnificacao", () => {
  it("re-aponta transações, herda subcategorias e remove a duplicada", () => {
    const d = diagnosticoCategorias({ categorias, transacoes });
    const r = aplicarUnificacao(d.duplicadas[0], { categorias, transacoes });
    expect(r.categorias.find(c => c.id === "c2")).toBeUndefined();
    expect(r.transacoes.find(t => t.id === "t3").categoria).toBe("Mercado");
    expect(r.transacoes.find(t => t.id === "t1").categoria).toBe("Mercado"); // intacta
    const manter = r.categorias.find(c => c.id === "c1");
    expect(manter.subcategorias.map(s => s.nome)).toContain("Feira");
  });

  it("filha da removida migra pra mantida", () => {
    const cats = [
      { id: "a", nome: "Casa", tipo: "despesa" },
      { id: "b", nome: "casa", tipo: "despesa" },
      { id: "f", nome: "Luz", tipo: "despesa", parentId: "b" },
    ];
    const txs = [{ id: "t", tipo: "despesa", categoria: "Casa", valor: 10, data: "2026-09-01" }];
    const d = diagnosticoCategorias({ categorias: cats, transacoes: txs });
    const r = aplicarUnificacao(d.duplicadas[0], { categorias: cats, transacoes: txs });
    expect(r.categorias.find(c => c.id === "f").parentId).toBe("a");
  });
});

describe("fundirCategorias (De → Para, manual)", () => {
  const cats = [
    { id: "ali", nome: "Alimentação", tipo: "despesa", subcategorias: [{ id: "s1", nome: "Feira" }] },
    { id: "pad", nome: "Padaria", tipo: "despesa" },
    { id: "fil", nome: "Doces", tipo: "despesa", parentId: "pad" },
  ];
  const dados = {
    categorias: cats,
    transacoes: [
      { id: "t1", tipo: "despesa", categoria: "Padaria", valor: 30, data: "2026-09-01" },
      { id: "t2", tipo: "despesa", categoria: "Padaria", valor: 20, data: "2026-09-02", subcategoria: "Pão" },
      { id: "t3", tipo: "despesa", categoria: "Alimentação", valor: 50, data: "2026-09-03" },
    ],
    fixas: [{ id: "f1", categoria: "Padaria", valor: 10 }],
    parcelamentos: [{ id: "p1", categoria: "Padaria", valorTotal: 100 }],
    dividas: [{ id: "d1", categoria: "Outra", valor: 5 }],
  };
  const origem = cats[1], destino = cats[0];
  const { fundirCategorias } = require("../categoriasDiagnostico.js");
  const r = fundirCategorias(origem, destino, dados);

  it("re-aponta transações, fixas e parcelamentos; guarda o rastro na subcategoria", () => {
    expect(r.transacoes.find(t => t.id === "t1")).toMatchObject({ categoria: "Alimentação", subcategoria: "Padaria" });
    expect(r.transacoes.find(t => t.id === "t2")).toMatchObject({ categoria: "Alimentação", subcategoria: "Pão" }); // sub existente fica
    expect(r.fixas[0]).toMatchObject({ categoria: "Alimentação", subcategoria: "Padaria" });
    expect(r.parcelamentos[0]).toMatchObject({ categoria: "Alimentação" });
    expect(r.dividas[0].categoria).toBe("Outra"); // não relacionada: intacta
  });
  it("origem some da lista e vira subcategoria da destino; filha migra", () => {
    expect(r.categorias.find(c => c.id === "pad")).toBeUndefined();
    const dest = r.categorias.find(c => c.id === "ali");
    expect(dest.subcategorias.map(s => s.nome)).toEqual(expect.arrayContaining(["Feira", "Padaria"]));
    expect(r.categorias.find(c => c.id === "fil").parentId).toBe("ali");
  });
});

describe("fundirTodasFilhas (unificar tudo de uma vez)", () => {
  const cats = [
    { id: "auto", nome: "Automóveis", tipo: "despesa" },
    { id: "comb", nome: "Combustivel", tipo: "despesa", parentId: "auto" },
    { id: "ipva", nome: "IPVA", tipo: "despesa", parentId: "auto" },
    { id: "outra", nome: "Lazer", tipo: "despesa" },
  ];
  const dados = {
    categorias: cats,
    transacoes: [
      { id: "t1", tipo: "despesa", categoria: "Combustivel", valor: 100, data: "2026-09-01" },
      { id: "t2", tipo: "despesa", categoria: "IPVA", valor: 200, data: "2026-09-02" },
      { id: "t3", tipo: "despesa", categoria: "Lazer", valor: 50, data: "2026-09-03" },
    ],
    fixas: [], parcelamentos: [], dividas: [],
  };
  const { fundirTodasFilhas } = require("../categoriasDiagnostico.js");
  const r = fundirTodasFilhas(cats[0], dados);

  it("todas as filhas somem e viram subcategorias da mãe", () => {
    expect(r.n).toBe(2);
    expect(r.categorias.find(c => c.id === "comb")).toBeUndefined();
    expect(r.categorias.find(c => c.id === "ipva")).toBeUndefined();
    const mae = r.categorias.find(c => c.id === "auto");
    expect(mae.subcategorias.map(s => s.nome).sort()).toEqual(["Combustivel", "IPVA"]);
  });
  it("transações das filhas migram com rastro; alheias ficam", () => {
    expect(r.transacoes.find(t => t.id === "t1")).toMatchObject({ categoria: "Automóveis", subcategoria: "Combustivel" });
    expect(r.transacoes.find(t => t.id === "t2")).toMatchObject({ categoria: "Automóveis", subcategoria: "IPVA" });
    expect(r.transacoes.find(t => t.id === "t3").categoria).toBe("Lazer");
  });
});
