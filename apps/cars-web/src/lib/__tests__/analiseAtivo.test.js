import { describe, it, expect } from "vitest";
import { rentabilidade12m, montarPromptAnaliseAtivo } from "../analiseAtivo.js";

const AGORA = new Date("2026-09-29T12:00:00Z");
const t = (iso) => Date.parse(iso);

describe("rentabilidade12m", () => {
  it("calcula preço + proventos do período (FII típico)", () => {
    const hist = [
      { time: t("2025-10-01"), close: 100 },
      { time: t("2026-03-01"), close: 95 },
      { time: t("2026-09-01"), close: 110 },
    ];
    const divs = [
      { pagamento: "2026-08-15", valor: 1 },
      { pagamento: "2026-02-15", valor: 1 },
      { pagamento: "2024-01-15", valor: 99 }, // fora dos 12m — ignora
    ];
    const r = rentabilidade12m(hist, divs, AGORA);
    expect(r.precoInicial).toBe(100);
    expect(r.precoFinal).toBe(110);
    expect(r.pctPreco).toBeCloseTo(10, 5);
    expect(r.somaProventos).toBe(2);
    expect(r.pctProventos).toBeCloseTo(2, 5);
    expect(r.pctTotal).toBeCloseTo(12, 5);
    expect(r.meses).toBe(11);
  });

  it("ordena histórico fora de ordem e ignora closes inválidos", () => {
    const hist = [
      { time: t("2026-09-01"), close: 50 },
      { time: t("2025-10-01"), close: 40 },
      { time: t("2026-01-01"), close: null },
    ];
    const r = rentabilidade12m(hist, [], AGORA);
    expect(r.precoInicial).toBe(40);
    expect(r.precoFinal).toBe(50);
    expect(r.pctTotal).toBeCloseTo(25, 5);
  });

  it("sem dados suficientes → null", () => {
    expect(rentabilidade12m([], [], AGORA)).toBe(null);
    expect(rentabilidade12m([{ time: 1, close: 10 }], [], AGORA)).toBe(null);
  });
});

describe("montarPromptAnaliseAtivo", () => {
  it("inclui ticker, preço, rentabilidade e as regras de segurança", () => {
    const p = montarPromptAnaliseAtivo(
      { symbol: "HGLG11", name: "CSHG Logística", price: 160.5 },
      { pctPreco: 5.1, pctProventos: 8.2, pctTotal: 13.3, meses: 12 },
    );
    expect(p).toContain("HGLG11");
    expect(p).toContain("R$ 160.50");
    expect(p).toContain("total ~13.3%");
    expect(p).toContain("NÃO faça recomendação");
    expect(p).toContain("ANALISTAS");
  });

  it("sem rentabilidade, omite a linha e segue válido", () => {
    const p = montarPromptAnaliseAtivo({ symbol: "PETR4" }, null);
    expect(p).toContain("PETR4");
    expect(p).not.toContain("Rentabilidade dos últimos");
  });
});
