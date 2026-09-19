import { describe, it, expect } from "vitest";
import { calcularJuros, taxaMensalDe } from "../juros.js";

describe("taxaMensalDe", () => {
  it("mensal passa direto; anual converte (composta geométrica, simples /12)", () => {
    expect(taxaMensalDe(1, "mes", true)).toBeCloseTo(0.01);
    expect(taxaMensalDe(12, "ano", false)).toBeCloseTo(0.01);
    expect(taxaMensalDe(12.6825, "ano", true)).toBeCloseTo(0.01, 4); // (1,01)^12−1 ≈ 12,6825% a.a.
  });
});

describe("calcularJuros", () => {
  it("compostos sem aporte: 1.000 a 1% a.m. por 12 meses ≈ 1.126,83", () => {
    const r = calcularJuros({ principal: 1000, taxa: 1, meses: 12, composto: true });
    expect(r.montante).toBeCloseTo(1126.83, 1);
    expect(r.totalInvestido).toBe(1000);
    expect(r.totalJuros).toBeCloseTo(126.83, 1);
    expect(r.serie.length).toBe(13); // mês 0 até 12
  });

  it("simples sem aporte: 1.000 a 1% a.m. por 12 meses = 1.120,00", () => {
    const r = calcularJuros({ principal: 1000, taxa: 1, meses: 12, composto: false });
    expect(r.montante).toBeCloseTo(1120, 2);
  });

  it("compostos com aporte no fim do mês: fórmula da série confere", () => {
    // 100/mês a 1% por 3 meses, sem principal: 100*(1,01²+1,01+1) = 303,01
    const r = calcularJuros({ principal: 0, taxa: 1, meses: 3, aporteMensal: 100, composto: true });
    expect(r.montante).toBeCloseTo(303.01, 2);
    expect(r.totalInvestido).toBe(300);
  });

  it("simples com aporte: cada aporte rende pelos meses restantes", () => {
    // aportes de 100 nos meses 1..3 a 1%: 100*(1+0,02) + 100*(1+0,01) + 100 = 303,00
    const r = calcularJuros({ principal: 0, taxa: 1, meses: 3, aporteMensal: 100, composto: false });
    expect(r.montante).toBeCloseTo(303, 2);
  });

  it("entradas inválidas não estouram (taxa 0, meses 0, negativos)", () => {
    expect(calcularJuros({}).montante).toBe(0);
    expect(calcularJuros({ principal: -5, taxa: -1, meses: -3 }).montante).toBe(0);
    const r = calcularJuros({ principal: 500, taxa: 0, meses: 6 });
    expect(r.montante).toBe(500);
    expect(r.totalJuros).toBe(0);
  });
});
