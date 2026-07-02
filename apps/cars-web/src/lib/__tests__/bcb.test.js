import { describe, it, expect } from "vitest";
import { acumularMensais, retornoDePontos } from "../bcb.js";

describe("acumularMensais", () => {
  it("compõe taxas mensais em % no acumulado do período", () => {
    // 1% a.m. por 12 meses → (1.01^12 − 1) × 100 ≈ 12,6825%
    expect(acumularMensais(Array(12).fill(1))).toBeCloseTo(12.6825, 3);
  });
  it("aceita strings (formato da API SGS) e ignora inválidos", () => {
    expect(acumularMensais(["0.5", "0.5", "abc"])).toBeCloseTo(1.0025, 3);
  });
  it("retorna 0 pra lista vazia", () => {
    expect(acumularMensais([])).toBe(0);
  });
});

describe("retornoDePontos", () => {
  it("calcula o retorno % entre o primeiro e o último ponto", () => {
    expect(retornoDePontos([100000, 105000, 110000])).toBeCloseTo(10, 5);
  });
  it("retorna null com menos de 2 pontos ou base inválida", () => {
    expect(retornoDePontos([100000])).toBe(null);
    expect(retornoDePontos([])).toBe(null);
    expect(retornoDePontos([0, 100])).toBe(null);
  });
});
