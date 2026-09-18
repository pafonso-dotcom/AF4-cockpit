import { describe, it, expect } from "vitest";
import { montarRelatorioIR, anosDisponiveisIR } from "../relatorioIR.js";

const ativos = [
  { ticker: "PETR4", nome: "Petrobras", tipo: "acao", qtd: 100, pm: 32.5 },
  { ticker: "HGLG11", tipo: "fii", qtd: 50, precoMedio: 160 },
  { ticker: "ZERADO", tipo: "acao", qtd: 0, pm: 10 },
];

const transacoes = [
  { id: "v1", tipo: "receita", investOp: "venda", ticker: "PETR4", qtd: 10, valor: 350, resultado: 25, data: "2026-03-10", descricao: "Venda PETR4" },
  { id: "v2", tipo: "receita", investOp: "venda", ticker: "VALE3", qtd: 400, valor: 25000, resultado: -300, data: "2026-05-12", descricao: "Venda VALE3" },
  { id: "p1", tipo: "receita", descricao: "HGLG11 · Rendimento", categoria: "Proventos", valor: 88, data: "2026-04-15" },
  { id: "p2", tipo: "receita", descricao: "PETR4 · Dividendo", categoria: "Proventos", valor: 120, data: "2026-06-01" },
  { id: "p3", tipo: "receita", descricao: "PETR4 · JCP", categoria: "Proventos", valor: 40, data: "2026-08-01" },
  { id: "p4", tipo: "receita", descricao: "HGLG11 · Rendimento", categoria: "Proventos", valor: 90, data: "2025-12-15" }, // outro ano
];

describe("montarRelatorioIR", () => {
  const rel = montarRelatorioIR({ ativos, transacoes, ano: 2026 });

  it("bens e direitos: só posições > 0, pelo custo (pm ou precoMedio), ordenadas", () => {
    expect(rel.bens.map(b => b.ticker)).toEqual(["HGLG11", "PETR4"]); // 8000 > 3250
    expect(rel.totalBens).toBeCloseTo(100 * 32.5 + 50 * 160);
  });

  it("proventos do ano separados em isentos e JCP (outro ano fica fora)", () => {
    expect(rel.totalProventos).toBeCloseTo(88 + 120 + 40);
    expect(rel.provJCP).toBeCloseTo(40);
    expect(rel.provIsentos).toBeCloseTo(208);
  });

  it("vendas agrupadas por mês com a régua dos R$ 20 mil", () => {
    expect(rel.vendasMeses.length).toBe(2);
    const marco = rel.vendasMeses.find(v => v.mes === "2026-03");
    const maio = rel.vendasMeses.find(v => v.mes === "2026-05");
    expect(marco.isento20k).toBe(true);
    expect(maio.isento20k).toBe(false); // 25.000 > 20.000
    expect(rel.resultadoVendas).toBeCloseTo(-275);
  });
});

describe("anosDisponiveisIR", () => {
  it("lista anos com movimento (desc) e inclui o ano corrente", () => {
    const anos = anosDisponiveisIR(transacoes);
    expect(anos).toContain("2026");
    expect(anos).toContain("2025");
    expect([...anos].sort().reverse()).toEqual(anos);
  });
});
