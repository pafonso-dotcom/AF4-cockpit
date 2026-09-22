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
      // compra à vista DENTRO da fatura (pendente) — categoria real, DATA no mês
      { id: "tv", tipo: "despesa", cartaoId: "cx", origem: "fatura-itau", compensado: false,
        data: "2026-09-01", valor: 300, categoria: "Alimentação", descricao: "Mercado no cartão" },
      // gasto normal de banco no mês
      { id: "tb", tipo: "despesa", data: "2026-09-03", valor: 200, categoria: "Alimentação",
        compensado: true, descricao: "Feira débito" },
      // compra em fatura de MÊS ANTERIOR (data ago): consumo de agosto, não set
      { id: "tprev", tipo: "despesa", cartaoId: "cx", origem: "fatura-itau", compensado: false,
        data: "2026-08-28", valor: 999, categoria: "Alimentação", descricao: "Compra de agosto" },
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

describe("consumo · fatura do MÊS SEGUINTE (compra em set, fatura de out)", () => {
  // Caso real do usuário: compra depois do fechamento → fatura de outubro.
  // O agregador de setembro esconde a compra (nem lump nem item); no CONSUMO
  // ela conta em SETEMBRO, na data da compra, com a categoria dela.
  const state = {
    contas: [], fixas: [], fixaOcorrencias: [], dividas: [], devedores: [], cheques: [], parcelamentos: [],
    cartoes: [{
      id: "cx", nome: "XP",
      faturaImportada: { valorTotal: 800, vencimento: "2026-10-10", competencia: "2026-10", paga: false },
    }],
    transacoes: [
      { id: "t1", tipo: "despesa", cartaoId: "cx", origem: "fatura-sicredi", compensado: false,
        data: "2026-09-15", valor: 800, categoria: "Alimentação", descricao: "Mercado grande" },
      { id: "t2", tipo: "despesa", data: "2026-09-03", valor: 200, categoria: "Alimentação",
        compensado: true, descricao: "Feira débito" },
    ],
  };
  const { itensConsumoDoMes } = require("../relatorioMensal.js");

  it("setembro soma banco + compra da fatura de outubro (pela data)", () => {
    const itens = itensConsumoDoMes("2026-09", state, "tudo");
    const alim = itens.filter(i => i.categoria === "Alimentação");
    expect(alim.reduce((s, i) => s + i.valor, 0)).toBe(1000); // 200 + 800
  });
  it("outubro não conta a compra de novo (só o lump, que fica fora do consumo)", () => {
    const itens = itensConsumoDoMes("2026-10", state, "tudo");
    expect(itens.filter(i => i.categoria === "Alimentação")).toHaveLength(0);
    expect(itens.filter(i => i.categoria === "Cartão · fatura")).toHaveLength(0);
  });
});

describe("categoriasGeral · filha (parentId) soma dentro da mãe", () => {
  const state = {
    contas: [], fixas: [], fixaOcorrencias: [], dividas: [], devedores: [], cheques: [], cartoes: [], parcelamentos: [],
    categorias: [
      { id: "ci", nome: "Compras Internet", tipo: "despesa" },
      { id: "ali2", nome: "AliExpress", tipo: "despesa", parentId: "ci" },
      { id: "ml", nome: "MercadoLivre", tipo: "despesa", parentId: "ci" },
    ],
    transacoes: [
      { id: "a", tipo: "despesa", data: "2026-09-05", valor: 100, categoria: "AliExpress", compensado: true },
      { id: "b", tipo: "despesa", data: "2026-09-06", valor: 50, categoria: "MercadoLivre", compensado: true },
      { id: "c", tipo: "despesa", data: "2026-09-07", valor: 30, categoria: "Compras Internet", compensado: true },
    ],
  };
  const { relatorioMensal } = require("../relatorioMensal.js");
  const rel = relatorioMensal("2026-09", state, "tudo", []);

  it("a mãe soma as filhas e elas aparecem como filhos", () => {
    const ci = rel.financas.categoriasGeral.find(p => p.nome === "Compras Internet");
    expect(ci.valor).toBe(180);
    expect(ci.filhos.map(f => f.nome).sort()).toEqual(["AliExpress", "MercadoLivre"]);
    expect(rel.financas.categoriasGeral.find(p => p.nome === "AliExpress")).toBeUndefined();
  });
});
