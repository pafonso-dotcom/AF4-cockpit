import { describe, it, expect } from "vitest";
import { montarContextoDiagnostico, montarPromptDiagnostico } from "../diagnosticoCarteira.js";

const ativos = [
  { ticker: "HGLG11", nome: "CSHG", tipo: "fii", segmento: "Logística", qtd: 100, pm: 90, preco: 100 },
  { ticker: "WEGE3", nome: "WEG", tipo: "acao", segmento: "Indústria", qtd: 20, pm: 44.89, preco: 46.68 },
];

describe("montarContextoDiagnostico", () => {
  it("monta posições com peso e resultado reais", () => {
    const ctx = montarContextoDiagnostico({ ativos });
    expect(ctx.posicoes).toHaveLength(2);
    const hglg = ctx.posicoes.find((p) => p.ticker === "HGLG11");
    expect(hglg.valor).toBeCloseTo(10000, 2);
    expect(hglg.pesoPct).toBeCloseTo((10000 / 10933.6) * 100, 1);
    expect(hglg.resultadoPct).toBeCloseTo(11.11, 1);
    expect(ctx.totais.valor).toBeCloseTo(10933.6, 1);
  });

  it("calcula concentração por classe e maior posição", () => {
    const ctx = montarContextoDiagnostico({ ativos });
    const fii = ctx.concentracaoPorClasse.find((c) => c.tipo === "fii");
    expect(fii.pesoPct).toBeCloseTo(91.5, 1);
    expect(ctx.maiorPosicao.ticker).toBe("HGLG11");
  });

  it("anexa nota de fundamentos e YoC quando existem", () => {
    const fundamentos = { HGLG11: { dados: { dy: 9.5 }, classe: "fii" } };
    const scores = { HGLG11: { score: 85, badge: "Forte", recomendacao: "Comprar" } };
    const proventosReais = { HGLG11: [{ pagamento: "2099-01-01", valor: 3.35 }] };
    const ctx = montarContextoDiagnostico({ ativos, fundamentos, scores, proventosReais });
    const hglg = ctx.posicoes.find((p) => p.ticker === "HGLG11");
    expect(hglg.fundamentos).toEqual({ score: 85, badge: "Forte", recomendacao: "Comprar" });
    expect(hglg.yocPct).toBeCloseTo((3.35 / 90) * 100, 2);
    const wege = ctx.posicoes.find((p) => p.ticker === "WEGE3");
    expect(wege.fundamentos).toBeUndefined();
  });

  it("carteira vazia gera contexto vazio sem quebrar", () => {
    const ctx = montarContextoDiagnostico({ ativos: [] });
    expect(ctx.posicoes).toEqual([]);
    expect(ctx.totais.valor).toBe(0);
  });
});

describe("montarPromptDiagnostico", () => {
  it("inclui os dados reais e o formato JSON esperado", () => {
    const ctx = montarContextoDiagnostico({ ativos, benchmarks: { cdi12m: 11.2 } });
    const prompt = montarPromptDiagnostico(ctx);
    expect(prompt).toContain("HGLG11");
    expect(prompt).toContain("notaGeral");
    expect(prompt).toContain("11.2");
  });
});
