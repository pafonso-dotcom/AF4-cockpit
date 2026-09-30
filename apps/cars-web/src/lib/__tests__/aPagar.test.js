import { describe, it, expect } from "vitest";
import { itensAPagar, resumoAPagar } from "../aPagar.js";

const HOJE = new Date(2026, 8, 30); // 30/09/2026

describe("aPagar — fonte única do 'tudo a pagar' (2026-09-30)", () => {
  const state = {
    dividas: [
      { id: "d1", valor: 500, vencimento: "2026-10-05", pago: false },
      { id: "d2", valor: 999, pago: true }, // paga → fora
    ],
    fixas: [{ id: "f1", nome: "UNIMED" }],
    fixaOcorrencias: [
      { id: "o1", fixaId: "f1", status: "pendente", valor: 2430, dataVencimento: "2026-09-25", mes: "2026-09" },
      { id: "o2", fixaId: "f1", status: "paga", valor: 2430, mes: "2026-08" },      // paga → fora
      { id: "o3", fixaId: "morta", status: "pendente", valor: 100, mes: "2026-09" }, // fixa excluída → fora
    ],
    parcelamentos: [
      // valorParcela explícito MANDA (valorTotal inconsistente com juros)
      { id: "p1", totalParcelas: 4, valorParcela: 100, valorTotal: 480, parcelasPagas: [1], dataPrimeira: "2026-09-10" },
      // sem data: entra com venc indefinido
      { id: "p2", totalParcelas: 2, valorTotal: 200, parcelasPagas: [] },
    ],
    transacoes: [
      // avulsa pendente de CONTA ÓRFÃ (renomeada) — CONTA no total
      { id: "t1", tipo: "despesa", valor: 73000, conta: "BANCO DA AF4", data: "2026-12-01", compensado: false },
      { id: "t2", tipo: "despesa", valor: 50, compensado: true },                     // compensada → fora
      { id: "t3", tipo: "despesa", valor: 10, compensado: false, origemParcelamentoId: "p1" }, // origem parcela → fora
    ],
  };

  it("soma cada fonte com a fórmula canônica", () => {
    const r = resumoAPagar(state, HOJE);
    // 500 (dívida) + 2430 (fixa) + 300 (3× parcela de 100) + 200 (2× 100 sem data) + 73000 (órfã)
    expect(r.total).toBeCloseTo(500 + 2430 + 300 + 200 + 73000, 2);
    expect(r.cartoes).toBeCloseTo(500, 2); // 300 + 200
  });

  it("porAno soma igual ao total e bucketa 'sem data' por último", () => {
    const r = resumoAPagar(state, HOJE);
    expect(r.porAno.reduce((s, a) => s + a.valor, 0)).toBeCloseTo(r.total, 2);
    expect(r.porAno[r.porAno.length - 1].ano).toBe("sem data");
    expect(r.porAno.find(a => a.ano === "2026").valor).toBeCloseTo(500 + 2430 + 300 + 73000, 2);
  });

  it("pagarMes: vence no mês corrente + sem data", () => {
    const r = resumoAPagar(state, HOJE);
    // fixa 25/09 (mês corrente) + parcela p1 n2 (10/10? não)... p1: parcelas 2,3,4 em out/nov/dez → fora do mês
    // sem data (200) cai no mês corrente
    expect(r.pagarMes).toBeCloseTo(2430 + 200, 2);
  });

  it("prox7: só vencimentos de hoje a hoje+7", () => {
    const r = resumoAPagar(state, HOJE);
    // 30/09→07/10: dívida 05/10 (500) + parcela p1 n... p1 dataPrimeira 10/09 → n2=10/10 fora; nada mais
    expect(r.prox7.total).toBeCloseTo(500, 2);
    expect(r.prox7.count).toBe(1);
  });

  it("itens têm rótulo e flag de cartão", () => {
    const itens = itensAPagar(state);
    expect(itens.find(i => i.desc === "UNIMED")).toBeTruthy();
    expect(itens.filter(i => i.cartao)).toHaveLength(5); // 3 de p1 + 2 de p2
  });
});
