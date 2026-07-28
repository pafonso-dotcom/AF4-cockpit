import { describe, it, expect } from "vitest";
import { simularFiiRf } from "../simuladorFiiRf.js";

describe("simularFiiRf", () => {
  it("aporte de R$1.000 por 240 meses a 10% a.a. bate o valor futuro esperado", () => {
    const r = simularFiiRf({ aporteMensal: 1000, prazoMeses: 240, rentFiiAA: 10, rentRfAA: 13, inflacaoAA: 4.5 });
    // FV de 240 aportes mensais de 1000 a 10% a.a. (≈ 0,7974% a.m.) ~ R$ 718k
    expect(r.fii.patrimonio).toBeGreaterThan(710_000);
    expect(r.fii.patrimonio).toBeLessThan(730_000);
    // A Renda Fixa (13% a.a.) acumula mais patrimônio que o FII (10% a.a.).
    expect(r.rf.patrimonio).toBeGreaterThan(r.fii.patrimonio);
    expect(r.vencedor).toBe("rf");
  });

  it("total aportado = aporte × prazo, e ganho = patrimônio − aportado", () => {
    const r = simularFiiRf({ aporteMensal: 1000, prazoMeses: 240, rentFiiAA: 10, rentRfAA: 13 });
    expect(r.totalAportado).toBe(240_000);
    expect(r.fii.ganho).toBeCloseTo(r.fii.patrimonio - 240_000, 2);
    expect(r.rf.ganho).toBeCloseTo(r.rf.patrimonio - 240_000, 2);
  });

  it("taxa 0% a.a. → patrimônio = soma dos aportes, sem juros", () => {
    const r = simularFiiRf({ aporteMensal: 500, prazoMeses: 12, rentFiiAA: 0, rentRfAA: 0 });
    expect(r.fii.patrimonio).toBe(6000);
    expect(r.rf.patrimonio).toBe(6000);
    expect(r.fii.ganho).toBe(0);
    expect(r.vencedor).toBe("empate");
  });

  it("renda mensal estimada = patrimônio × taxa a.a. / 12; renda real desconta inflação", () => {
    const r = simularFiiRf({ aporteMensal: 1000, prazoMeses: 120, rentFiiAA: 12, rentRfAA: 12, inflacaoAA: 5 });
    expect(r.fii.rendaMensal).toBeCloseTo(r.fii.patrimonio * 0.12 / 12, 2);
    // Real < nominal porque a inflação de 10 anos corrói o poder de compra.
    expect(r.fii.rendaMensalReal).toBeLessThan(r.fii.rendaMensal);
    expect(r.deflator).toBeGreaterThan(1);
  });

  it("prazo 0 → tudo zero, sem estourar", () => {
    const r = simularFiiRf({ aporteMensal: 1000, prazoMeses: 0, rentFiiAA: 10, rentRfAA: 13 });
    expect(r.fii.patrimonio).toBe(0);
    expect(r.totalAportado).toBe(0);
    expect(r.serie).toHaveLength(0);
  });

  it("cada marco traz a renda mensal (dividendo FII / rendimento RF) daquele patrimônio", () => {
    const r = simularFiiRf({ aporteMensal: 1000, prazoMeses: 120, rentFiiAA: 9, rentRfAA: 12, pontos: 6 });
    for (const p of r.serie) {
      expect(p.rendaFii).toBeCloseTo(p.fii * 0.09 / 12, 2);
      expect(p.rendaRf).toBeCloseTo(p.rf * 0.12 / 12, 2);
    }
    // A renda mensal cresce junto com o patrimônio ao longo do tempo.
    const ult = r.serie[r.serie.length - 1];
    expect(ult.rendaFii).toBeGreaterThan(r.serie[0].rendaFii);
    // No último marco (fim do prazo) bate com a renda final consolidada.
    expect(ult.rendaFii).toBeCloseTo(r.fii.rendaMensal, 2);
  });

  it("a série termina exatamente no prazo informado", () => {
    const r = simularFiiRf({ aporteMensal: 1000, prazoMeses: 240, rentFiiAA: 10, rentRfAA: 13, pontos: 6 });
    expect(r.serie[r.serie.length - 1].mes).toBe(240);
    expect(r.serie.length).toBeGreaterThan(1);
  });
});
