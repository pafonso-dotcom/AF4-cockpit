import { describe, it, expect } from "vitest";
import {
  calcAlocacaoPorClasse,
  calcRentabilidadeAtivo,
  calcCarteiraSaude,
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

describe("calcCarteiraSaude", () => {
  it("returns zeros for empty input", () => {
    expect(calcCarteiraSaude([])).toEqual({
      score: 0,
      herfindahl: 0,
      totalAtivos: 0,
      noLucro: 0,
      pctLucro: 0,
      total: 0,
    });
  });

  it("returns zeros for null/undefined input", () => {
    expect(calcCarteiraSaude(null).score).toBe(0);
    expect(calcCarteiraSaude(undefined).score).toBe(0);
    expect(calcCarteiraSaude(null).total).toBe(0);
  });

  it("returns zeros when no asset is valid (qtd*preco <= 0)", () => {
    const r = calcCarteiraSaude([
      { tipo: "acao", qtd: 0, preco: 50, pm: 10 },
      { tipo: "fii", qtd: 10, preco: 0, pm: 5 },
    ]);
    expect(r.score).toBe(0);
    expect(r.herfindahl).toBe(0);
    expect(r.totalAtivos).toBe(0);
    expect(r.total).toBe(0);
  });

  it("single class with one asset in profit", () => {
    const r = calcCarteiraSaude([
      { tipo: "acao", qtd: 10, preco: 25, pm: 20 }, // valor 250, no lucro
    ]);
    // total=250, herfindahl = 1.0 (single class)
    // scoreDiversidade = max(0, min(30, 30 * (1 - (1 - 0.10)/0.30))) = max(0, min(30, 30*(1-3))) = 0
    // pctLucro = 100, scoreLucro = 25
    // scoreQtd = min(15, 1*1.5) = 1.5
    // score = round(30 + 0 + 25 + 1.5) = 57
    expect(r.total).toBe(250);
    expect(r.totalAtivos).toBe(1);
    expect(r.noLucro).toBe(1);
    expect(r.pctLucro).toBe(100);
    expect(r.herfindahl).toBeCloseTo(1.0, 5);
    expect(r.score).toBe(57);
  });

  it("multi-class diversified with mixed lucro/prejuizo", () => {
    const r = calcCarteiraSaude([
      { tipo: "acao", qtd: 10, preco: 10, pm: 5 },  // 100, lucro
      { tipo: "fii", qtd: 10, preco: 10, pm: 8 },   // 100, lucro
      { tipo: "stock", qtd: 10, preco: 10, pm: 12 },// 100, prejuizo
      { tipo: "etf", qtd: 10, preco: 10, pm: 15 },  // 100, prejuizo
    ]);
    // total=400, 4 classes a 25% cada → herfindahl = 4*0.25^2 = 0.25
    expect(r.total).toBe(400);
    expect(r.totalAtivos).toBe(4);
    expect(r.noLucro).toBe(2);
    expect(r.pctLucro).toBe(50);
    expect(r.herfindahl).toBeCloseTo(0.25, 5);
    // scoreDiversidade = 30 * (1 - (0.25-0.10)/0.30) = 30 * (1 - 0.5) = 15
    // scoreLucro = 50/100 * 25 = 12.5
    // scoreQtd = min(15, 4*1.5) = 6
    // score = round(30 + 15 + 12.5 + 6) = round(63.5) = 64
    expect(r.score).toBe(64);
  });

  it("all in loss → low score on profit component", () => {
    const r = calcCarteiraSaude([
      { tipo: "acao", qtd: 10, preco: 5, pm: 10 },  // prejuizo
      { tipo: "fii", qtd: 10, preco: 5, pm: 10 },   // prejuizo
    ]);
    // total=100, 2 classes a 50% → h = 2*0.25 = 0.5
    expect(r.noLucro).toBe(0);
    expect(r.pctLucro).toBe(0);
    expect(r.herfindahl).toBeCloseTo(0.5, 5);
    // scoreDiversidade = max(0, min(30, 30*(1-(0.5-0.1)/0.3))) = max(0,min(30, 30*(1-1.333))) = 0
    // scoreLucro = 0, scoreQtd = min(15, 2*1.5) = 3
    // score = round(30 + 0 + 0 + 3) = 33
    expect(r.score).toBe(33);
  });

  it("treats preco == pm as not in profit (uses strict >)", () => {
    const r = calcCarteiraSaude([
      { tipo: "acao", qtd: 10, preco: 10, pm: 10 },
    ]);
    expect(r.noLucro).toBe(0);
    expect(r.pctLucro).toBe(0);
  });

  it("supports precoMedio as alias of pm", () => {
    const r = calcCarteiraSaude([
      { tipo: "acao", qtd: 10, preco: 20, precoMedio: 10 }, // lucro
    ]);
    expect(r.noLucro).toBe(1);
    expect(r.pctLucro).toBe(100);
  });

  it("falls back to 'outro' for missing tipo when computing herfindahl", () => {
    const r = calcCarteiraSaude([
      { qtd: 10, preco: 10, pm: 5 },           // tipo missing -> "outro" 100
      { tipo: null, qtd: 10, preco: 10, pm: 5 }, // -> "outro" 100
    ]);
    // 1 classe "outro" com 200 -> h = 1
    expect(r.total).toBe(200);
    expect(r.herfindahl).toBeCloseTo(1.0, 5);
  });

  it("caps the score at 100 for an ideal portfolio", () => {
    // 10 classes diferentes em pesos iguais → h = 0.10 (limite ideal)
    // Todos em lucro, 10+ ativos
    const classes = ["acao", "fii", "stock", "reit", "etf", "cripto", "rf", "tesouro", "cdb", "outro"];
    const ativos = classes.map(tipo => ({ tipo, qtd: 10, preco: 20, pm: 10 }));
    const r = calcCarteiraSaude(ativos);
    expect(r.totalAtivos).toBe(10);
    expect(r.noLucro).toBe(10);
    expect(r.pctLucro).toBe(100);
    expect(r.herfindahl).toBeCloseTo(0.10, 5);
    // scoreDiversidade = 30 (h <= 0.10)
    // scoreLucro = 25
    // scoreQtd = min(15, 10*1.5) = 15
    // score = min(100, round(30+30+25+15)) = 100
    expect(r.score).toBe(100);
  });

  it("score is capped at 100 even when components would exceed it", () => {
    // 20 ativos, todos no lucro, 10 classes em pesos iguais
    const classes = ["acao", "fii", "stock", "reit", "etf", "cripto", "rf", "tesouro", "cdb", "outro"];
    const ativos = [];
    for (const tipo of classes) {
      ativos.push({ tipo, qtd: 5, preco: 20, pm: 10 });
      ativos.push({ tipo, qtd: 5, preco: 20, pm: 10 });
    }
    const r = calcCarteiraSaude(ativos);
    expect(r.totalAtivos).toBe(20);
    expect(r.score).toBe(100);
  });

  it("ignores invalid assets when counting noLucro", () => {
    const r = calcCarteiraSaude([
      { tipo: "acao", qtd: 10, preco: 20, pm: 10 }, // valid + lucro
      { tipo: "acao", qtd: 0, preco: 20, pm: 10 },  // invalid (qtd=0) — skipped
      { tipo: "acao", qtd: 5, preco: 0, pm: 10 },   // invalid (preco=0) — skipped
    ]);
    expect(r.totalAtivos).toBe(1);
    expect(r.noLucro).toBe(1);
  });
});
