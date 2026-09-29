import { describe, it, expect } from "vitest";
import { avaliarAtivoRisco, calcularRadarRisco, montarPromptRadar } from "../radarRisco.js";

const AGORA = new Date("2026-09-29T12:00:00Z");
const t = (iso) => Date.parse(iso);
const mesAMes = (closes, inicio = "2025-10-01") => closes.map((c, i) => {
  const d = new Date(inicio); d.setMonth(d.getMonth() + i);
  return { time: d.getTime(), close: c };
});

describe("avaliarAtivoRisco", () => {
  it("ativo despencando 12m + perto da mínima + concentrado = 🔴 atenção", () => {
    // 100 → 70 (−30% em 12m), último = mínima da faixa
    const hist = mesAMes([100, 96, 92, 88, 85, 82, 80, 78, 76, 74, 72, 70]);
    const r = avaliarAtivoRisco({ ativo: { ticker: "xpto11", tipo: "fii" }, hist, pesoPct: 45, agora: AGORA });
    // −30% 12m (+35) · −7.9% 3m (+20) · 0% da faixa (+20) · concentra 45% (+20)
    expect(r.score).toBe(95);
    expect(r.nivel).toBe("atencao");
    expect(r.ticker).toBe("XPTO11");
    expect(r.sinais.some(s => s.includes("12 meses"))).toBe(true);
    expect(r.sinais.some(s => s.includes("mínima"))).toBe(true);
    expect(r.sinais.some(s => s.includes("concentra 45%"))).toBe(true);
  });

  it("ativo subindo e leve não gera sinais = 🟢 ok", () => {
    const hist = mesAMes([100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122]);
    const r = avaliarAtivoRisco({ ativo: { ticker: "BOM3" }, hist, pesoPct: 10, agora: AGORA });
    expect(r.score).toBe(0);
    expect(r.nivel).toBe("ok");
    expect(r.sinais).toEqual([]);
  });

  it("proventos minguando conta como sinal", () => {
    const hist = mesAMes([100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100, 101]);
    const divs = [
      // último semestre: 0,50 · semestre anterior: 3,00 → queda ~83%
      { pagamento: "2026-08-10", valor: 0.5 },
      { pagamento: "2026-02-10", valor: 1.5 },
      { pagamento: "2025-11-10", valor: 1.5 },
    ];
    const r = avaliarAtivoRisco({ ativo: { ticker: "REND11" }, hist, dividendos: divs, pesoPct: 5, agora: AGORA });
    expect(r.sinais.some(s => s.includes("proventos"))).toBe(true);
    expect(r.score).toBe(15);
  });

  it("sem histórico só considera concentração", () => {
    const r = avaliarAtivoRisco({ ativo: { ticker: "NOVO3" }, hist: [], pesoPct: 30, agora: AGORA });
    expect(r.score).toBe(15);
    expect(r.nivel).toBe("ok"); // sozinho, 15 pts não chega em "observar" (25)
    const forte = avaliarAtivoRisco({ ativo: { ticker: "NOVO3" }, hist: [], pesoPct: 45, agora: AGORA });
    expect(forte.score).toBe(20);
  });
});

describe("calcularRadarRisco", () => {
  it("ordena do maior score pro menor", () => {
    const caindo = mesAMes([100, 90, 80, 70, 65, 60, 58, 56, 54, 52, 50, 48]);
    const subindo = mesAMes([100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155]);
    const lista = calcularRadarRisco([
      { ativo: { ticker: "BOM3" }, hist: subindo, pesoPct: 10 },
      { ativo: { ticker: "RUIM3" }, hist: caindo, pesoPct: 10 },
    ], AGORA);
    expect(lista[0].ticker).toBe("RUIM3");
    expect(lista[0].nivel).toBe("atencao");
    expect(lista[1].ticker).toBe("BOM3");
  });
});

describe("montarPromptRadar", () => {
  it("lista os piores com sinais e mantém as regras", () => {
    const p = montarPromptRadar([
      { ticker: "RUIM3", nome: "Ruim SA", sinais: ["preço caiu 52% em 12 meses"] },
    ]);
    expect(p).toContain("RUIM3");
    expect(p).toContain("preço caiu 52%");
    expect(p).toContain("NÃO faça recomendação");
  });
});
