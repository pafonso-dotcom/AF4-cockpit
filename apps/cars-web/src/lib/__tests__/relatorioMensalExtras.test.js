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

describe("categoriasGeral · fatura importada aberta entra pelos ITENS", () => {
  const state = {
    contas: [], fixas: [], fixaOcorrencias: [], dividas: [], devedores: [], cheques: [],
    cartoes: [{
      id: "cx", nome: "XP",
      faturaImportada: { valorTotal: 500, vencimento: "2026-09-10", competencia: "2026-09", paga: false },
    }],
    parcelamentos: [{
      id: "px", cartaoId: "cx", descricao: "Geladeira", categoria: "Casa",
      dataPrimeira: "2026-09-05", totalParcelas: 2, valorParcela: 100, parcelasPagas: [],
    }],
    transacoes: [
      // compra à vista DENTRO da fatura (pendente) — categoria real
      { id: "tv", tipo: "despesa", cartaoId: "cx", origem: "fatura-import", compensado: false,
        data: "2026-08-28", valor: 300, categoria: "Alimentação", descricao: "Mercado no cartão" },
      // gasto normal de banco no mês
      { id: "tb", tipo: "despesa", data: "2026-09-03", valor: 200, categoria: "Alimentação",
        compensado: true, descricao: "Feira débito" },
    ],
  };
  const { relatorioMensal } = require("../relatorioMensal.js");
  const rel = relatorioMensal("2026-09", state, "tudo", []);
  const geral = Object.fromEntries(rel.financas.categoriasGeral.map(p => [p.nome, p.valor]));

  it("Alimentação soma banco + cartão (fatura aberta pelos itens)", () => {
    expect(geral["Alimentação"]).toBe(500); // 200 banco + 300 dentro da fatura
  });
  it("parcela pendente do cartão com fatura aberta entra na categoria dela", () => {
    expect(geral["Casa"]).toBe(100); // parcela 1/2 de setembro
  });
  it("o lump 'Cartão · fatura' some do ranking (sem dobrar)", () => {
    expect(geral["Cartão · fatura"]).toBeUndefined();
    expect(rel.financas.despesasGeral).toBe(600); // 200 banco + 300 fatura + 100 parcela
  });
  it("nos COMPROMISSOS (despesas do mês) a fatura continua como um item só", () => {
    expect(rel.financas.despesas).toBe(700); // fatura 500 + feira 200 (itens dela ocultos lá)
  });
  it("itensConsumo alimenta o drill-down com os itens da fatura", () => {
    const alim = rel.financas.itensConsumo.filter(i => i.categoria === "Alimentação");
    expect(alim.map(i => i.id).sort()).toEqual(["tb", "tv"]);
  });
});
