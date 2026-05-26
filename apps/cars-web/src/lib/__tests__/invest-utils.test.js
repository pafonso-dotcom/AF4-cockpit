import { describe, it, expect } from "vitest";
import {
  calcAlocacaoPorClasse,
  calcRentabilidadeAtivo,
} from "../invest-utils.js";

describe("calcAlocacaoPorClasse", () => {
  it("returns empty array for empty input", () => {
    expect(calcAlocacaoPorClasse([])).toEqual([]);
    expect(calcAlocacaoPorClasse(null)).toEqual([]);
    expect(calcAlocacaoPorClasse(undefined)).toEqual([]);
  });

  it("groups by tipo, sums qtd*preco and computes pct", () => {
    const ativos = [
      { tipo: "acao", qtd: 10, preco: 20 }, // 200
      { tipo: "acao", qtd: 5, preco: 40 },  // 200, classe acao total = 400
      { tipo: "fii", qtd: 10, preco: 100 }, // 1000
    ];
    const res = calcAlocacaoPorClasse(ativos);
    // Total = 1400. fii first (1000 > 400).
    expect(res).toHaveLength(2);
    expect(res[0].tipo).toBe("fii");
    expect(res[0].valor).toBe(1000);
    expect(res[0].pct).toBeCloseTo(1000 / 1400 * 100, 5);
    expect(res[0].label).toBe("FIIs");
    expect(res[0].cor).toBe("#10b981");
    expect(res[1].tipo).toBe("acao");
    expect(res[1].valor).toBe(400);
    expect(res[1].pct).toBeCloseTo(400 / 1400 * 100, 5);
    expect(res[1].label).toBe("Ações BR");
    expect(res[1].cor).toBe("#f5a524");
  });

  it("ignores ativos with qtd or preco zero/negative/missing", () => {
    const ativos = [
      { tipo: "acao", qtd: 10, preco: 20 },     // valid 200
      { tipo: "acao", qtd: 0, preco: 50 },      // qtd 0 — skipped
      { tipo: "acao", qtd: 5, preco: 0 },       // preco 0 — skipped
      { tipo: "acao", qtd: -1, preco: 10 },     // negative — skipped
      { tipo: "acao", qtd: 10 },                // missing preco — skipped
      { tipo: "acao", preco: 10 },              // missing qtd — skipped
      { tipo: "acao", qtd: null, preco: 50 },   // null — skipped
    ];
    const res = calcAlocacaoPorClasse(ativos);
    expect(res).toHaveLength(1);
    expect(res[0].valor).toBe(200);
    expect(res[0].pct).toBe(100);
  });

  it("falls back to 'outro' for missing tipo", () => {
    const ativos = [
      { qtd: 10, preco: 10 },               // tipo missing
      { tipo: null, qtd: 5, preco: 4 },     // tipo null
      { tipo: "", qtd: 2, preco: 5 },       // tipo empty string
    ];
    const res = calcAlocacaoPorClasse(ativos);
    expect(res).toHaveLength(1);
    expect(res[0].tipo).toBe("outro");
    expect(res[0].label).toBe("Outros");
    expect(res[0].cor).toBe("#9ca3af");
    expect(res[0].valor).toBe(100 + 20 + 10);
    expect(res[0].pct).toBe(100);
  });

  it("returns empty array when no asset is valid", () => {
    const ativos = [
      { tipo: "acao", qtd: 0, preco: 100 },
      { tipo: "fii", qtd: 10, preco: 0 },
    ];
    expect(calcAlocacaoPorClasse(ativos)).toEqual([]);
  });

  it("uses fallback color/label for unknown tipo", () => {
    const ativos = [{ tipo: "exotic", qtd: 10, preco: 10 }];
    const res = calcAlocacaoPorClasse(ativos);
    expect(res).toHaveLength(1);
    expect(res[0].tipo).toBe("exotic");
    expect(res[0].label).toBe("exotic");
    expect(res[0].cor).toBe("#9ca3af");
  });
});

describe("calcRentabilidadeAtivo", () => {
  it("computes custo, valor, ganho and pctGanho for profit", () => {
    const r = calcRentabilidadeAtivo({ qtd: 10, preco: 25, pm: 20 });
    // custo = 10 * 20 = 200, valor = 10 * 25 = 250, ganho = 50, pct = 25%
    expect(r.custo).toBe(200);
    expect(r.valor).toBe(250);
    expect(r.ganho).toBe(50);
    expect(r.pctGanho).toBeCloseTo(25, 5);
  });

  it("supports precoMedio as alias of pm", () => {
    const r = calcRentabilidadeAtivo({ qtd: 10, preco: 25, precoMedio: 20 });
    expect(r.custo).toBe(200);
    expect(r.ganho).toBe(50);
    expect(r.pctGanho).toBeCloseTo(25, 5);
  });

  it("prefers pm when both pm and precoMedio are present", () => {
    const r = calcRentabilidadeAtivo({ qtd: 1, preco: 100, pm: 50, precoMedio: 80 });
    expect(r.custo).toBe(50);
    expect(r.ganho).toBe(50);
  });

  it("computes negative ganho for loss", () => {
    const r = calcRentabilidadeAtivo({ qtd: 4, preco: 10, pm: 15 });
    // custo = 60, valor = 40, ganho = -20, pct = -33.33...
    expect(r.custo).toBe(60);
    expect(r.valor).toBe(40);
    expect(r.ganho).toBe(-20);
    expect(r.pctGanho).toBeCloseTo(-33.3333333, 5);
  });

  it("returns pctGanho 0 when custo is 0", () => {
    const r = calcRentabilidadeAtivo({ qtd: 10, preco: 25, pm: 0 });
    expect(r.custo).toBe(0);
    expect(r.valor).toBe(250);
    expect(r.ganho).toBe(250);
    expect(r.pctGanho).toBe(0);
  });

  it("treats missing pm/precoMedio as 0", () => {
    const r = calcRentabilidadeAtivo({ qtd: 5, preco: 10 });
    expect(r.custo).toBe(0);
    expect(r.valor).toBe(50);
    expect(r.ganho).toBe(50);
    expect(r.pctGanho).toBe(0);
  });

  it("handles null / undefined input gracefully", () => {
    expect(calcRentabilidadeAtivo(null)).toEqual({ custo: 0, valor: 0, ganho: 0, pctGanho: 0 });
    expect(calcRentabilidadeAtivo(undefined)).toEqual({ custo: 0, valor: 0, ganho: 0, pctGanho: 0 });
    expect(calcRentabilidadeAtivo({})).toEqual({ custo: 0, valor: 0, ganho: 0, pctGanho: 0 });
  });

  it("coerces non-numeric strings to 0", () => {
    const r = calcRentabilidadeAtivo({ qtd: "abc", preco: "xyz", pm: "nope" });
    expect(r.custo).toBe(0);
    expect(r.valor).toBe(0);
    expect(r.ganho).toBe(0);
    expect(r.pctGanho).toBe(0);
  });
});
