import { describe, it, expect } from "vitest";
import {
  PERFIS_OBJETIVO,
  ORDEM_CLASSES,
  ATALHOS_MIX,
  calcularAlocacaoPorMix,
  ajustarMix,
} from "../monte-carteira-config.js";

describe("PERFIS_OBJETIVO", () => {
  it("cada perfil soma 100", () => {
    for (const objetivo of ["renda", "crescimento", "reserva"]) {
      const soma = Object.values(PERFIS_OBJETIVO[objetivo]).reduce((s, v) => s + v, 0);
      expect(soma).toBe(100);
    }
  });
});

describe("calcularAlocacaoPorMix", () => {
  it("100% renda usa só perfil de renda", () => {
    const r = calcularAlocacaoPorMix({ renda: 100, crescimento: 0, reserva: 0 });
    const fii = r.find(x => x.tipo === "fii");
    expect(fii.pct).toBe(45);
  });

  it("mix 50/30/20 = média ponderada correta", () => {
    const r = calcularAlocacaoPorMix({ renda: 50, crescimento: 30, reserva: 20 });
    const fii = r.find(x => x.tipo === "fii");
    // 0.5*45 + 0.3*15 + 0.2*5 = 22.5 + 4.5 + 1 = 28
    expect(fii.pct).toBeCloseTo(28, 1);
    const acao = r.find(x => x.tipo === "acao");
    // 0.5*15 + 0.3*30 + 0.2*0 = 7.5 + 9 + 0 = 16.5
    expect(acao.pct).toBeCloseTo(16.5, 1);
  });

  it("soma da alocação resultante é 100", () => {
    const r = calcularAlocacaoPorMix({ renda: 33, crescimento: 33, reserva: 34 });
    const soma = r.reduce((s, x) => s + x.pct, 0);
    expect(soma).toBeCloseTo(100, 1);
  });

  it("retorna na ordem ORDEM_CLASSES", () => {
    const r = calcularAlocacaoPorMix({ renda: 50, crescimento: 30, reserva: 20 });
    expect(r.map(x => x.tipo)).toEqual(ORDEM_CLASSES);
  });
});

describe("ajustarMix", () => {
  it("mantém soma 100 quando muda um slider", () => {
    const r = ajustarMix({ renda: 50, crescimento: 30, reserva: 20 }, "renda", 70);
    const soma = r.renda + r.crescimento + r.reserva;
    expect(soma).toBe(100);
    expect(r.renda).toBe(70);
  });

  it("redistribui proporcionalmente nos outros 2", () => {
    // Era 50/30/20 — agora renda vira 70, sobram 30 pra distribuir
    // entre crescimento (30/50=0.6) e reserva (20/50=0.4)
    const r = ajustarMix({ renda: 50, crescimento: 30, reserva: 20 }, "renda", 70);
    expect(r.crescimento).toBe(18); // 0.6 * 30
    expect(r.reserva).toBe(12);     // 0.4 * 30
  });

  it("quando outras estão zeradas, divide igualmente", () => {
    const r = ajustarMix({ renda: 100, crescimento: 0, reserva: 0 }, "renda", 40);
    // Sobram 60 pra crescimento + reserva, divide igualmente
    expect(r.crescimento).toBe(30);
    expect(r.reserva).toBe(30);
  });

  it("clampa valor entre 0 e 100", () => {
    expect(ajustarMix({ renda: 50, crescimento: 25, reserva: 25 }, "renda", 150).renda).toBe(100);
    expect(ajustarMix({ renda: 50, crescimento: 25, reserva: 25 }, "renda", -10).renda).toBe(0);
  });
});

describe("ATALHOS_MIX", () => {
  it("cada atalho tem mix válido somando 100", () => {
    for (const a of ATALHOS_MIX) {
      const soma = a.mix.renda + a.mix.crescimento + a.mix.reserva;
      expect(soma).toBe(100);
    }
  });
});
