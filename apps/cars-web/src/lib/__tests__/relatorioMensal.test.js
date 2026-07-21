import { describe, it, expect } from "vitest";
import { relatorioMensal, mesAnteriorISO } from "../relatorioMensal.js";

describe("mesAnteriorISO", () => {
  it("volta um mês, cruzando o ano", () => {
    expect(mesAnteriorISO("2026-07")).toBe("2026-06");
    expect(mesAnteriorISO("2026-01")).toBe("2025-12");
    expect(mesAnteriorISO("2026-03")).toBe("2026-02");
  });
});

const baseState = {
  transacoes: [], contas: [{ id: "c1", nome: "Nu", saldo: 1000 }],
  fixas: [], fixaOcorrencias: [], parcelamentos: [], dividas: [],
  devedores: [], cartoes: [], cheques: [],
};

describe("relatorioMensal · invest", () => {
  it("soma aportes, vendas e proventos do mês", () => {
    const transacoes = [
      { id: "a", tipo: "despesa", investOp: "compra", ticker: "PETR4", qtd: 10, valor: 1000, data: "2026-07-05", conta: "Nu" },
      { id: "v", tipo: "receita", investOp: "venda", ticker: "VALE3", qtd: 5, valor: 800, resultado: 120, data: "2026-07-10", conta: "Nu" },
      { id: "p", tipo: "receita", categoria: "Dividendo", descricao: "Dividendo HGLG11", valor: 50, data: "2026-07-15", conta: "Nu" },
      { id: "x", tipo: "receita", categoria: "Dividendo", descricao: "Dividendo HGLG11", valor: 999, data: "2026-06-15", conta: "Nu" }, // mês anterior, não conta
    ];
    const rel = relatorioMensal("2026-07", { ...baseState, transacoes }, "tudo", []);
    expect(rel.invest.totalComprado).toBe(1000);
    expect(rel.invest.totalVendido).toBe(800);
    expect(rel.invest.resultadoVendas).toBe(120);
    expect(rel.invest.totalProventos).toBe(50);
    expect(rel.invest.proventos).toHaveLength(1);
  });
});

describe("relatorioMensal · patrimônio", () => {
  it("usa o snapshot anterior ao mês como início e o último do mês como fim", () => {
    const historico = [
      { data: "2026-06-30", total: 100000 },
      { data: "2026-07-10", total: 105000 },
      { data: "2026-07-28", total: 110000 },
    ];
    const rel = relatorioMensal("2026-07", baseState, "tudo", historico);
    expect(rel.invest.patrimonioIni).toBe(100000);
    expect(rel.invest.patrimonioFim).toBe(110000);
    expect(rel.invest.variacao).toBe(10000);
    expect(rel.invest.variacaoPct).toBeCloseTo(10, 5);
  });

  it("sem snapshots no mês, variação fica nula", () => {
    const rel = relatorioMensal("2026-07", baseState, "tudo", [{ data: "2026-05-01", total: 5000 }]);
    expect(rel.invest.patrimonioFim).toBeNull();
    expect(rel.invest.variacao).toBeNull();
  });
});

describe("relatorioMensal · finanças (invariantes)", () => {
  it("sobra = receitas − despesas e traz comparação com o mês anterior", () => {
    const rel = relatorioMensal("2026-07", baseState, "tudo", []);
    expect(typeof rel.financas.receitas).toBe("number");
    expect(typeof rel.financas.despesas).toBe("number");
    expect(rel.financas.sobra).toBeCloseTo(rel.financas.receitas - rel.financas.despesas, 5);
    expect(Array.isArray(rel.financas.categorias)).toBe(true);
    expect(rel.financas).toHaveProperty("deltaDespesas");
    expect(rel.financas).toHaveProperty("anterior");
  });

  it("ignora transferência entre bancos nas receitas e nas despesas", () => {
    const transacoes = [
      { id: "r1", tipo: "receita", valor: 1000, data: "2026-07-03", conta: "Nu", categoria: "Salário", compensado: true },
      { id: "d1", tipo: "despesa", valor: 200, data: "2026-07-04", conta: "Nu", categoria: "Mercado", compensado: true },
      // transferência: Nu → XP (não conta como despesa nem receita)
      { id: "tOut", tipo: "despesa", valor: 500, data: "2026-07-05", conta: "Nu", categoria: "", transferenciaId: "T1", compensado: true },
      { id: "tIn", tipo: "receita", valor: 500, data: "2026-07-05", conta: "XP", categoria: "", transferenciaId: "T1", compensado: true },
    ];
    const rel = relatorioMensal("2026-07", { ...baseState, transacoes }, "tudo", []);
    expect(rel.financas.receitas).toBe(1000); // sem os 500 da transferência
    expect(rel.financas.despesas).toBe(200);  // sem os 500 da transferência
    // categoria da transferência não aparece no ranking de gastos
    expect(rel.financas.categorias.some(c => /transfer/i.test(c.nome))).toBe(false);
  });

  it("ignora lançamentos marcados com foraDoRelatorio", () => {
    const transacoes = [
      { id: "r1", tipo: "receita", valor: 1000, data: "2026-07-03", conta: "Nu", categoria: "Salário", compensado: true },
      { id: "d1", tipo: "despesa", valor: 200, data: "2026-07-04", conta: "Nu", categoria: "Mercado", compensado: true },
      { id: "d2", tipo: "despesa", valor: 900, data: "2026-07-05", conta: "Nu", categoria: "Reembolso", compensado: true, foraDoRelatorio: true },
      { id: "r2", tipo: "receita", valor: 300, data: "2026-07-06", conta: "Nu", categoria: "Extra", compensado: true, foraDoRelatorio: true },
    ];
    const rel = relatorioMensal("2026-07", { ...baseState, transacoes }, "tudo", []);
    expect(rel.financas.receitas).toBe(1000); // r2 (300) fora
    expect(rel.financas.despesas).toBe(200);  // d2 (900) fora
    expect(rel.financas.categorias.some(c => c.nome === "Reembolso")).toBe(false);
    expect(rel.financas.receitasCategorias.some(c => c.nome === "Extra")).toBe(false);
  });

  it("ignora a categoria 'TRANSF ENTRE BANCOS' mesmo sem transferenciaId", () => {
    const transacoes = [
      { id: "r1", tipo: "receita", valor: 1000, data: "2026-07-03", conta: "Nu", categoria: "Salário", compensado: true },
      { id: "d1", tipo: "despesa", valor: 200, data: "2026-07-04", conta: "Nu", categoria: "Mercado", compensado: true },
      // lançados à mão como transferência (sem transferenciaId)
      { id: "t2", tipo: "receita", valor: 700, data: "2026-07-06", conta: "Nu", categoria: "TRANSF ENTRE BANCOS", compensado: true },
      { id: "t3", tipo: "despesa", valor: 700, data: "2026-07-06", conta: "XP", categoria: "TRANSF ENTRE BANCOS", compensado: true },
    ];
    const rel = relatorioMensal("2026-07", { ...baseState, transacoes }, "tudo", []);
    expect(rel.financas.receitas).toBe(1000);
    expect(rel.financas.despesas).toBe(200);
    expect(rel.financas.receitasCategorias.some(c => /transf/i.test(c.nome))).toBe(false);
    expect(rel.financas.categorias.some(c => /transf/i.test(c.nome))).toBe(false);
  });
});
