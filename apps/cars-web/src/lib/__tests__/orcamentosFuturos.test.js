import { describe, it, expect } from "vitest";
import { mesesAte, alvoPassado, calcOrcamentoCompra, resumoOrcamentos } from "../orcamentosFuturos.js";

const HOJE = new Date(2026, 8, 21); // set/2026

describe("mesesAte / alvoPassado", () => {
  it("conta os meses até o alvo (mínimo 1)", () => {
    expect(mesesAte("2027-03", HOJE)).toBe(6);
    expect(mesesAte("2026-10", HOJE)).toBe(1);
    expect(mesesAte("2026-09", HOJE)).toBe(1); // mês corrente → 1
    expect(mesesAte("2026-01", HOJE)).toBe(1); // passado não vira 0/negativo
    expect(mesesAte("errado", HOJE)).toBeNull();
  });
  it("alvoPassado só pra meses anteriores ao corrente", () => {
    expect(alvoPassado("2026-08", HOJE)).toBe(true);
    expect(alvoPassado("2026-09", HOJE)).toBe(false);
    expect(alvoPassado("2027-01", HOJE)).toBe(false);
  });
});

describe("calcOrcamentoCompra", () => {
  it("calcula falta, meses e quanto guardar por mês", () => {
    const c = calcOrcamentoCompra({ valor: 12000, guardado: 3000, alvo: "2027-03" }, HOJE);
    expect(c.falta).toBe(9000);
    expect(c.meses).toBe(6);
    expect(c.porMes).toBe(1500);
    expect(c.pct).toBe(25);
    expect(c.passado).toBe(false);
  });
  it("plano completo: falta 0, pct 100; alvo passado com falta marca `passado`", () => {
    expect(calcOrcamentoCompra({ valor: 500, guardado: 700, alvo: "2027-01" }, HOJE).falta).toBe(0);
    expect(calcOrcamentoCompra({ valor: 500, guardado: 500, alvo: "2027-01" }, HOJE).pct).toBe(100);
    expect(calcOrcamentoCompra({ valor: 500, guardado: 100, alvo: "2026-05" }, HOJE).passado).toBe(true);
    expect(calcOrcamentoCompra({ valor: 500, guardado: 500, alvo: "2026-05" }, HOJE).passado).toBe(false);
  });
});

describe("resumoOrcamentos", () => {
  it("soma valores, faltas e o total a guardar por mês (planos completos não somam /mês)", () => {
    const r = resumoOrcamentos([
      { valor: 12000, guardado: 3000, alvo: "2027-03" }, // 1500/mês
      { valor: 600, guardado: 600, alvo: "2026-12" },    // completo
      { valor: 300, guardado: 0, alvo: "2026-12" },      // 100/mês (3 meses)
    ], HOJE);
    expect(r.qtd).toBe(3);
    expect(r.totalValor).toBe(12900);
    expect(r.totalFalta).toBe(9300);
    expect(r.totalPorMes).toBe(1600);
  });
});
