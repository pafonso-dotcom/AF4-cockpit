import { describe, it, expect } from "vitest";
import { diagnosticoMes } from "../diagnosticoGastos.js";

describe("diagnosticoMes", () => {
  const hist = [
    { Casa: 15000, Mercado: 800, Lazer: 300 },
    { Casa: 15400, Mercado: 780, Lazer: 320 },
    { Casa: 15200, Mercado: 820, Lazer: 280 },
  ]; // média: Casa 15200, Mercado 800, Lazer 300

  it("marca categoria acima do padrão e calcula o excesso", () => {
    const d = diagnosticoMes({ Casa: 20336, Mercado: 800, Lazer: 300 }, hist);
    const casa = d.foraDoPadrao.find((i) => i.categoria === "Casa");
    expect(casa.estado).toBe("acima");
    expect(Math.round(casa.delta)).toBe(5136);
    expect(Math.round(casa.media)).toBe(15200);
  });

  it("categoria estável não entra em foraDoPadrao", () => {
    const d = diagnosticoMes({ Casa: 15200, Mercado: 800, Lazer: 300 }, hist);
    expect(d.foraDoPadrao.length).toBe(0);
  });

  it("detecta novo pico (categoria sem histórico que disparou)", () => {
    const d = diagnosticoMes({ Casa: 15200, "Desp. Família": 8000 }, hist);
    const fam = d.foraDoPadrao.find((i) => i.categoria === "Desp. Família");
    expect(fam.estado).toBe("pico");
    expect(fam.novoPico).toBe(true);
  });

  it("categoria bem abaixo da média vira 'abaixo'", () => {
    const d = diagnosticoMes({ Casa: 15200, Mercado: 200, Lazer: 300 }, hist);
    const merc = d.foraDoPadrao.find((i) => i.categoria === "Mercado");
    expect(merc.estado).toBe("abaixo");
  });

  it("sugestões de corte = categorias acima/pico, com economia = excesso", () => {
    const d = diagnosticoMes({ Casa: 20336, Mercado: 800, "Desp. Família": 8000 }, hist);
    const nomes = d.cortes.map((c) => c.categoria);
    expect(nomes).toContain("Casa");
    expect(nomes).toContain("Desp. Família");
    expect(nomes).not.toContain("Mercado");
    expect(Math.round(d.potencialTotal)).toBe(5136 + 8000);
  });

  it("veredito total: soma e variação vs média", () => {
    const d = diagnosticoMes({ Casa: 20336, Mercado: 800, Lazer: 300 }, hist);
    expect(Math.round(d.totalMes)).toBe(21436);
    expect(Math.round(d.totalMedia)).toBe(16300);
    expect(Math.round(d.pctTotal)).toBe(32); // 5136/16300 ≈ 31,5% → 32
  });

  it("ignora categorias irrelevantes (abaixo de minValor)", () => {
    const d = diagnosticoMes({ Casa: 15200, Cafe: 12 }, hist);
    expect(d.foraDoPadrao.find((i) => i.categoria === "Cafe")).toBeUndefined();
  });

  it("sem histórico não quebra", () => {
    const d = diagnosticoMes({ Casa: 100 }, []);
    expect(d.totalMedia).toBe(0);
    expect(d.pctTotal).toBe(null);
  });
});
