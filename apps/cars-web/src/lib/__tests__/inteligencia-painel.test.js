import { describe, it, expect } from "vitest";
import { escoparFinancas, totalAssinaturas, tabAlvoInsight } from "../inteligenciaPainel.js";

describe("escoparFinancas", () => {
  const contas = [
    { nome: "CC", escopo: "pessoal" },
    { nome: "Loja", escopo: "negocio" },
  ];
  const txs = [
    { conta: "CC", valor: 10 },
    { conta: "Loja", valor: 20 },
    { conta: null, valor: 30 },
  ];
  it("escopo 'tudo' devolve tudo", () => {
    const r = escoparFinancas(txs, contas, "tudo");
    expect(r.contas).toHaveLength(2);
    expect(r.transacoes).toHaveLength(3);
  });
  it("escopo 'pessoal' filtra contas e transações pelas contas do escopo", () => {
    const r = escoparFinancas(txs, contas, "pessoal");
    expect(r.contas.map(c => c.nome)).toEqual(["CC"]);
    expect(r.transacoes).toEqual([{ conta: "CC", valor: 10 }]);
  });
  it("lida com entradas nulas sem quebrar", () => {
    const r = escoparFinancas(null, null, "pessoal");
    expect(r).toEqual({ transacoes: [], contas: [] });
  });
});

describe("totalAssinaturas", () => {
  it("soma valorAnualizado em anual e divide por 12 no mensal", () => {
    const r = totalAssinaturas([{ valorAnualizado: 120 }, { valorAnualizado: 240 }]);
    expect(r.anual).toBe(360);
    expect(r.mensal).toBe(30);
  });
  it("lista vazia → zeros", () => {
    expect(totalAssinaturas([])).toEqual({ mensal: 0, anual: 0 });
  });
});

describe("tabAlvoInsight", () => {
  it("mapeia por palavra-chave do título", () => {
    expect(tabAlvoInsight({ titulo: "Cartão de crédito acima de 30% da renda" })).toBe("cartoes");
    expect(tabAlvoInsight({ titulo: "Gastos com delivery subiram 40%" })).toBe("transacoes");
    expect(tabAlvoInsight({ titulo: "Reserva de emergência cobre 1 mês" })).toBe("metas");
  });
  it("sem correspondência → null", () => {
    expect(tabAlvoInsight({ titulo: "Tudo sob controle" })).toBeNull();
    expect(tabAlvoInsight(null)).toBeNull();
  });
});
