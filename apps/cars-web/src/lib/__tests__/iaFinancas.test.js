import { describe, it, expect } from "vitest";
import { montarResumoMes, promptAnaliseMes } from "../iaFinancas.js";

const TX = [
  { tipo: "receita", valor: 5000, data: "2026-07-05", categoria: "Salário" },
  { tipo: "despesa", valor: 1800, data: "2026-07-10", categoria: "Moradia" },
  { tipo: "despesa", valor: 600, data: "2026-07-12", categoria: "Alimentação" },
  { tipo: "despesa", valor: 2000, data: "2026-07-15", categoria: "Investimento" }, // fora (movimentação)
  { tipo: "despesa", valor: 999, data: "2026-06-10", categoria: "Moradia" },        // outro mês
];

describe("iaFinancas", () => {
  it("resumo: só o mês pedido, só gasto de consumo, top categorias ordenadas", () => {
    const r = montarResumoMes(TX, { mesISO: "2026-07" });
    expect(r.receitas).toBe(5000);
    expect(r.despesas).toBe(2400);          // 1800+600 (Investimento excluído)
    expect(r.saldo).toBe(2600);
    expect(r.topCategorias.map((c) => c.nome)).toEqual(["Moradia", "Alimentação"]);
    expect(r.topCategorias.find((c) => c.nome === "Investimento")).toBeUndefined();
  });

  it("prompt inclui os números e os extras", () => {
    const r = montarResumoMes(TX, { mesISO: "2026-07" });
    const p = promptAnaliseMes(r, { score: "63/100", alertas: ["Excesso de caixa parado"], assinaturasQtd: 2, assinaturasTotal: 89 });
    expect(p).toContain("Mês: 2026-07");
    expect(p).toContain("Moradia");
    expect(p).toContain("63/100");
    expect(p).toContain("Excesso de caixa parado");
    expect(p).toContain("Assinaturas recorrentes: 2");
  });
});
