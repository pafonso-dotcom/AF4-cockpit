import { describe, it, expect } from "vitest";
import { movimentacoesInvestMes } from "../movimentacoesInvest.js";

const tx = [
  // novos (campos ricos)
  { id: "c1", tipo: "despesa", investOp: "compra", ticker: "PETR4", qtd: 100, preco: 30, valor: 3000, data: "2026-07-05" },
  { id: "v1", tipo: "receita", investOp: "venda", ticker: "VALE3", qtd: 80, preco: 67.5, valor: 5400, resultado: 610, data: "2026-07-22" },
  // antigos (só descrição/obs)
  { id: "c2", tipo: "despesa", descricao: "Aporte HGLG11 (20 × R$ 160,00)", valor: 3200, data: "2026-07-12" },
  { id: "v2", tipo: "receita", descricao: "Venda BBAS3 (50 × R$ 28,00)", obs: "Resultado: R$ 200,00 (prejuízo)", valor: 1400, data: "2026-07-25" },
  // proventos
  { id: "p1", tipo: "receita", categoria: "Dividendos", descricao: "Dividendo PETR4", valor: 312, data: "2026-07-15" },
  { id: "p2", tipo: "receita", categoria: "Proventos", descricao: "Rendimento HGLG11", valor: 220, data: "2026-07-08" },
  // ruído: gasto comum e mês errado
  { id: "x1", tipo: "despesa", categoria: "Mercado", descricao: "Compras", valor: 500, data: "2026-07-10" },
  { id: "x2", tipo: "despesa", investOp: "compra", ticker: "ITSA4", qtd: 10, preco: 10, valor: 100, data: "2026-06-10" },
];

describe("movimentacoesInvestMes", () => {
  const r = movimentacoesInvestMes(tx, "2026-07");

  it("separa compras (aportes) e soma", () => {
    expect(r.compras.map((c) => c.ticker).sort()).toEqual(["HGLG11", "PETR4"]);
    expect(r.totalComprado).toBe(3000 + 3200);
  });

  it("vendas com resultado (novo e parseado do obs)", () => {
    const vale = r.vendas.find((v) => v.ticker === "VALE3");
    const bbas = r.vendas.find((v) => v.ticker === "BBAS3");
    expect(vale.resultado).toBe(610);
    expect(bbas.resultado).toBe(-200); // prejuízo → negativo
    expect(r.totalVendido).toBe(5400 + 1400);
    expect(r.resultadoVendas).toBe(610 - 200);
  });

  it("proventos identificados por categoria/descrição, sem pegar venda", () => {
    expect(r.proventos.map((p) => p.ticker).sort()).toEqual(["HGLG11", "PETR4"]);
    expect(r.totalProventos).toBe(312 + 220);
    expect(r.proventos.find((p) => p.ticker === "PETR4").tipo).toBe("Dividendo");
  });

  it("ignora gasto comum e mês diferente", () => {
    expect(r.compras.find((c) => c.ticker === "ITSA4")).toBeUndefined(); // junho
    expect(r.compras.length + r.vendas.length + r.proventos.length).toBe(6);
  });

  it("qtd/preço parseados do antigo", () => {
    const hglg = r.compras.find((c) => c.ticker === "HGLG11");
    expect(hglg.qtd).toBe(20);
    expect(hglg.preco).toBe(160); // 3200/20
  });
});
