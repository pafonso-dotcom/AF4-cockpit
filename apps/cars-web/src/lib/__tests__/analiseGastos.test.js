import { describe, it, expect } from "vitest";
import { analiseGastosMes } from "../analiseGastos.js";

const d = (tipo, valor, data, categoria, extra = {}) => ({ tipo, valor, data, categoria, ...extra });
const TX = [
  // Julho (mês analisado)
  d("despesa", 1800, "2026-07-05", "Moradia"),
  d("despesa", 700, "2026-07-10", "Alimentação"),
  d("despesa", 300, "2026-07-12", "Lazer"),          // nova (não tinha em junho)
  d("despesa", 2000, "2026-07-15", "Investimento"),  // fora (movimentação)
  d("despesa", 500, "2026-07-16", "Transferência"),  // fora
  d("receita", 5000, "2026-07-01", "Salário"),       // receita não conta
  // Junho (mês anterior)
  d("despesa", 1500, "2026-06-05", "Moradia"),
  d("despesa", 900, "2026-06-10", "Alimentação"),
];

describe("analiseGastosMes", () => {
  const r = analiseGastosMes(TX, { mesISO: "2026-07" });

  it("total só de consumo (exclui investimento/transferência/receita)", () => {
    expect(r.total).toBe(2800);           // 1800 + 700 + 300
    expect(r.totalAnterior).toBe(2400);   // 1500 + 900
    expect(r.totalPct).toBeCloseTo(((2800 - 2400) / 2400) * 100, 4);
  });

  it("categorias ordenadas por valor, com variação vs mês anterior", () => {
    expect(r.categorias.map((c) => c.nome)).toEqual(["Moradia", "Alimentação", "Lazer"]);
    const moradia = r.categorias.find((c) => c.nome === "Moradia");
    expect(moradia.variacao).toBeCloseTo(((1800 - 1500) / 1500) * 100, 4); // +20%
    const alim = r.categorias.find((c) => c.nome === "Alimentação");
    expect(alim.variacao).toBeCloseTo(((700 - 900) / 900) * 100, 4);       // -22,2%
  });

  it("categoria nova (sem mês anterior) marca nova=true e variacao=null", () => {
    const lazer = r.categorias.find((c) => c.nome === "Lazer");
    expect(lazer.nova).toBe(true);
    expect(lazer.variacao).toBeNull();
  });

  it("maiorAlta = categoria que mais subiu em reais", () => {
    expect(r.maiorAlta?.nome).toBe("Moradia"); // +300 (Alimentação caiu)
  });

  it("foraDaAnalise lista as despesas de movimentação do mês", () => {
    const fora = r.foraDaAnalise.map((f) => f.nome);
    expect(fora).toContain("Investimento");
    expect(fora).toContain("Transferência");
    expect(r.foraDaAnalise.find((f) => f.nome === "Investimento").motivo).toBe("movimentacao");
  });

  it("excluir tira uma categoria de consumo do total e a joga pra foraDaAnalise", () => {
    const x = analiseGastosMes(TX, { mesISO: "2026-07", excluir: ["Lazer"] });
    expect(x.total).toBe(2500); // 2800 - 300 (Lazer)
    expect(x.categorias.map((c) => c.nome)).not.toContain("Lazer");
    const lazerFora = x.foraDaAnalise.find((f) => f.nome === "Lazer");
    expect(lazerFora?.motivo).toBe("manual");
  });

  it("categorias conhecidas sem gasto no mês entram como opção (semGasto, valor 0)", () => {
    const x = analiseGastosMes(TX, { mesISO: "2026-07", categorias: ["Moradia", "Educação", "Pets"] });
    const fora = x.foraDaAnalise.filter((f) => f.motivo === "semGasto").map((f) => f.nome);
    expect(fora).toContain("Educação"); // conhecida, sem gasto no mês
    expect(fora).toContain("Pets");
    expect(fora).not.toContain("Moradia"); // já conta (tem gasto)
    expect(x.foraDaAnalise.find((f) => f.nome === "Educação").valor).toBe(0);
  });

  it("incluir coloca uma categoria de movimentação de volta no total", () => {
    const x = analiseGastosMes(TX, { mesISO: "2026-07", incluir: ["Investimento"] });
    expect(x.total).toBe(4800); // 2800 + 2000 (Investimento)
    const inv = x.categorias.find((c) => c.nome === "Investimento");
    expect(inv?.forcada).toBe(true);
    expect(x.foraDaAnalise.map((f) => f.nome)).not.toContain("Investimento");
  });
});
