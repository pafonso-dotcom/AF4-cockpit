import { describe, it, expect } from "vitest";
import { YIELDS_MENSAIS, calcularRendaMensalCarteira } from "../yields-base.js";

describe("YIELDS_MENSAIS", () => {
  it("tem yield positivo pras classes que pagam renda", () => {
    expect(YIELDS_MENSAIS.fii).toBeGreaterThan(0);
    expect(YIELDS_MENSAIS.acao).toBeGreaterThan(0);
    expect(YIELDS_MENSAIS.tesouro).toBeGreaterThan(0);
  });
  it("cripto e outro têm yield zero", () => {
    expect(YIELDS_MENSAIS.cripto).toBe(0);
    expect(YIELDS_MENSAIS.outro).toBe(0);
  });
});

describe("calcularRendaMensalCarteira", () => {
  it("retorna zero quando carteira vazia", () => {
    const r = calcularRendaMensalCarteira([]);
    expect(r.rendaMensal).toBe(0);
    expect(r.breakdown).toEqual([]);
  });
  it("soma valor × yield por classe", () => {
    // 100k FIIs × 0.8% = 800
    // 100k Tesouro × 0.85% = 850
    // Total: 1650
    const r = calcularRendaMensalCarteira([
      { tipo: "fii",     valor: 100_000 },
      { tipo: "tesouro", valor: 100_000 },
    ]);
    expect(r.rendaMensal).toBeCloseTo(1650, 0);
    expect(r.breakdown).toHaveLength(2);
  });
  it("tipo desconhecido vira yield zero", () => {
    const r = calcularRendaMensalCarteira([{ tipo: "xpto", valor: 100_000 }]);
    expect(r.rendaMensal).toBe(0);
  });
});
