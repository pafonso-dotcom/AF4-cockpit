import { describe, it, expect } from "vitest";
import { posicaoConsolidada, leituraConsultor } from "../relatorioMensal.js";
import { saldoContaBRL } from "../cambio.js";

describe("posicaoConsolidada", () => {
  it("soma contas (com câmbio), proventos e invest BR, deduz cartões; US$ à parte", () => {
    const pos = posicaoConsolidada({
      contas: [
        { nome: "Nubank", saldo: 1000 },
        { nome: "US", saldo: 100, moeda: "USD", cotacao: 5 },      // 500 BRL
        { nome: "Fora", saldo: 999, foraPatrimonio: true },        // não entra
      ],
      ativos: [
        { ticker: "PETR4", tipo: "acao", qtd: 10, preco: 40 },     // 400 BR
        { ticker: "AAPL", tipo: "stock", qtd: 2, preco: 200 },     // 400 USD
      ],
      parcelamentos: [
        { totalParcelas: 10, valorParcela: 50, parcelasPagas: [1, 2] }, // 8×50 = 400 aberto
      ],
      carteiraProventos: { saldo: 150 },
      saldoContaBRL,
    });
    expect(pos.contas).toBe(1500);
    expect(pos.proventos).toBe(150);
    expect(pos.investBR).toBe(400);
    expect(pos.investUSD).toBe(400);
    expect(pos.cartoesAbertos).toBe(400);
    expect(pos.liquido).toBe(1500 + 150 + 400 - 400);
  });
});

describe("leituraConsultor", () => {
  const fmtX = (v) => `R$${Math.round(v)}`;
  it("gera frases de poupança, top categoria, delta, pico e padrão fds", () => {
    const frases = leituraConsultor({
      financas: {
        receitas: 1000, despesas: 750, sobra: 250, deltaDespesas: -12,
        categoriasGeral: [{ nome: "Mercado", valor: 300 }],
      },
      mesISO: "2026-09",
      mapaGastos: { diaMax: 5, max: 200, total: 600, porDia: { 5: { total: 200 }, 7: { total: 200 }, 8: { total: 200 } } },
      insightFds: { tipo: "fds", ratio: 2 },
      fmt: fmtX,
    });
    expect(frases).toHaveLength(5);
    expect(frases[0]).toContain("poupou 25%");
    expect(frases[0]).toContain("acima da regra dos 20%");
    expect(frases[1]).toContain("Mercado");
    expect(frases[1]).toContain("30% da renda");
    expect(frases[2]).toContain("CAÍRAM 12%");
    expect(frases[3]).toContain("05/09");
    expect(frases[4]).toContain("2× mais");
  });

  it("mês no vermelho vira alerta", () => {
    const frases = leituraConsultor({ financas: { receitas: 1000, despesas: 1200, sobra: -200 }, mesISO: "2026-09", fmt: fmtX });
    expect(frases[0]).toContain("NO VERMELHO");
  });

  it("sem dados → sem frases", () => {
    expect(leituraConsultor({})).toEqual([]);
  });
});
