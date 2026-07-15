import { describe, it, expect } from "vitest";
import { montarRelatorioGastos } from "../relatorioGastos.js";

const hist = [
  { Casa: 15000, Mercado: 800 },
  { Casa: 15200, Mercado: 800 },
  { Casa: 15100, Mercado: 800 },
];

const itensMes = [
  { categoria: "Casa", valor: 20000, fonte: "fixa", tipo: "fixa", data: "2026-07-05", status: "paga" },
  { categoria: "Mercado", valor: 800, fonte: "transacao", tipo: "variavel", data: "2026-07-10", status: "paga" },
  { categoria: "Eletro", valor: 1200, fonte: "parcela", tipo: "parcela", data: "2026-07-20", status: "pendente" },
  { categoria: "Transferência", valor: 9999, fonte: "transacao", tipo: "variavel", data: "2026-07-11" }, // NÃO é gasto
];

describe("montarRelatorioGastos", () => {
  it("taxa de consumo e poupança", () => {
    const r = montarRelatorioGastos({ itensMes, historicoCats: hist, receitaMes: 30000, categorias: [], fixas: [] });
    expect(r.totalMes).toBe(22000); // 20000+800+1200, exclui transferência
    expect(Math.round(r.taxaConsumo)).toBe(73);
    expect(r.poupanca).toBe(8000);
    expect(Math.round(r.pctPoupanca)).toBe(27);
  });

  it("composição fixo/cartão/variável (ignora movimentação)", () => {
    const r = montarRelatorioGastos({ itensMes, historicoCats: hist, receitaMes: 30000, categorias: [], fixas: [] });
    const by = Object.fromEntries(r.composicao.map((c) => [c.classe, c.valor]));
    expect(by.fixo).toBe(20000);
    expect(by.cartao).toBe(1200);
    expect(by.variavel).toBe(800);
  });

  it("concentração top 3", () => {
    const r = montarRelatorioGastos({ itensMes, historicoCats: hist, receitaMes: 30000, categorias: [], fixas: [] });
    // Casa 20000 de 22000 ≈ 90%+ com top3
    expect(r.concentracaoPct).toBeGreaterThan(90);
  });

  it("recorrentes a partir das fixas de consumo", () => {
    const fixas = [
      { descricao: "UNIMED", categoria: "Saúde", valor: 2430, diaVencimento: 25 },
      { descricao: "Aporte meta", categoria: "Investimento", valor: 1000 }, // movimentação → fora
    ];
    const r = montarRelatorioGastos({ itensMes, historicoCats: hist, receitaMes: 30000, categorias: [], fixas });
    expect(r.recorrentes.map((x) => x.nome)).toEqual(["UNIMED"]);
    expect(r.recorrentesTotal).toBe(2430);
  });

  it("orçamento estourado entra em estouros e derruba a saúde", () => {
    const cats = [{ nome: "Casa", tipo: "despesa", limite: 15000 }];
    const r = montarRelatorioGastos({ itensMes, historicoCats: hist, receitaMes: 30000, categorias: cats, fixas: [] });
    expect(r.estouros.map((e) => e.nome)).toContain("Casa");
    expect(r.score).toBeLessThan(100);
  });

  it("projeção de fechamento no mês corrente separa realizado de a vencer", () => {
    const r = montarRelatorioGastos({ itensMes, historicoCats: hist, receitaMes: 30000, categorias: [], fixas: [], ehMesCorrente: true, hojeISO: "2026-07-15" });
    expect(r.realizado).toBe(20800); // Casa (paga) + Mercado (paga, data<=15)
    expect(r.aVencer).toBe(1200);    // Eletro pendente dia 20
    expect(r.fechamentoPrevisto).toBe(22000);
  });

  it("score alto quando tudo saudável", () => {
    const bom = [{ categoria: "Casa", valor: 15000, fonte: "fixa", tipo: "fixa" }, { categoria: "Mercado", valor: 800, fonte: "transacao", tipo: "variavel" }, { categoria: "Lazer", valor: 3000, fonte: "transacao", tipo: "variavel" }, { categoria: "Saúde", valor: 2000, fonte: "fixa", tipo: "fixa" }];
    const r = montarRelatorioGastos({ itensMes: bom, historicoCats: [{ Casa: 15000, Mercado: 800, Lazer: 3000, "Saúde": 2000 }], receitaMes: 40000, categorias: [], fixas: [] });
    expect(r.score).toBeGreaterThanOrEqual(80);
  });
});
