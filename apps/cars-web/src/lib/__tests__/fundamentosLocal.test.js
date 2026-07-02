import { describe, it, expect } from "vitest";
import { classificar, classeDoAtivo } from "../fundamentosLocal.js";

describe("classeDoAtivo", () => {
  it("normaliza tipos do app para classes IdV", () => {
    expect(classeDoAtivo("fii")).toBe("fii");
    expect(classeDoAtivo("acao")).toBe("acao");
    expect(classeDoAtivo("ação")).toBe("acao");
    expect(classeDoAtivo("stock")).toBe("stock");
    expect(classeDoAtivo("reit")).toBe("reit");
    expect(classeDoAtivo("cripto")).toBe(null);
  });
});

describe("classificar", () => {
  it("retorna null sem registro de fundamentos", () => {
    expect(classificar({ ticker: "XPTO11", tipo: "fii" }, {})).toBe(null);
  });

  it("pontua os dados preenchidos (não pode dar 'Sem dados' com dados presentes)", () => {
    // Regressão: classificar() passava o mapa plano de dados direto pro
    // calcularScoreIdV, que espera { valores: {...} } — resultado era todo
    // ativo analisado pela IA aparecer como "Sem dados" / score 0.
    const fundamentos = {
      HGLG11: {
        ticker: "HGLG11", classe: "fii", nome: "CSHG Logística",
        dados: { tipo: "Tijolo", segmento: "Logística", ipo: 10, patrimonio: 3, dy: 9.5 },
        atualizado_em: "2026-07-01T00:00:00Z",
      },
    };
    const r = classificar({ ticker: "HGLG11", tipo: "fii" }, fundamentos);
    expect(r).not.toBe(null);
    expect(r.preenchidos).toBeGreaterThan(0);
    expect(r.badge).not.toBe("Sem dados");
    // Tijolo + Logística + 10 anos + 3 Bi + DY 9,5% são todos "bom" → score alto
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.recomendacao).toBe("Comprar");
  });

  it("dados ruins geram score baixo e recomendação Evitar", () => {
    const fundamentos = {
      RUIM11: {
        ticker: "RUIM11", classe: "fii", nome: "Fundo Ruim",
        dados: { tipo: "FOF", segmento: "Hotel", ipo: 1, patrimonio: 0.2, dy: 5 },
      },
    };
    const r = classificar({ ticker: "RUIM11", tipo: "fii" }, fundamentos);
    expect(r).not.toBe(null);
    expect(r.score).toBeLessThan(40);
    expect(r.recomendacao).toBe("Evitar");
  });
});
