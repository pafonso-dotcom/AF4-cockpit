import { describe, it, expect } from "vitest";
import { mesesDefault, inferirMesesDoHistorico, montarMapaDividendos, proventosPorCota12m, metaProventos } from "../mapaDividendos.js";
import { YIELDS_MENSAIS } from "../yields-base.js";

describe("metaProventos", () => {
  const rows = [
    { ticker: "KNCR11", tipo: "fii", candidato: false, valor: 10766, dy: 12.0, rendaAnual: 1291.92 },
    { ticker: "MXRF11", tipo: "fii", candidato: true, valor: 5000, dy: 13.0, rendaAnual: 650 },
    { ticker: "SEMDY3", tipo: "acao", candidato: false, valor: 1000, dy: 0, rendaAnual: 0 },
  ];
  const precos = { KNCR11: 107.66 };

  it("calcula renda atual, gap e % da meta", () => {
    const r = metaProventos({ rows, metaMensal: 500, precos });
    expect(r.rendaMensalAtual).toBeCloseTo((1291.92 + 650) / 12, 2);
    expect(r.gapMensal).toBeCloseTo(500 - r.rendaMensalAtual, 2);
    expect(r.pctAtingido).toBeCloseTo((r.rendaMensalAtual / 500) * 100, 1);
    expect(r.atingida).toBe(false);
  });

  it("sugestões: aporte necessário pra fechar o gap só com aquele ativo, maiores DY primeiro", () => {
    const r = metaProventos({ rows, metaMensal: 500, precos });
    expect(r.sugestoes[0].ticker).toBe("MXRF11"); // DY 13% > 12%
    const kncr = r.sugestoes.find(s => s.ticker === "KNCR11");
    // aporte = gapAnual / (dy/100)
    expect(kncr.aporteNecessario).toBeCloseTo((r.gapMensal * 12) / 0.12, 0);
    // cotas quando o preço é conhecido
    expect(kncr.cotas).toBe(Math.ceil(kncr.aporteNecessario / 107.66));
    // sem DY não entra na lista
    expect(r.sugestoes.find(s => s.ticker === "SEMDY3")).toBeUndefined();
  });

  it("meta já atingida não gera sugestões", () => {
    const r = metaProventos({ rows, metaMensal: 100, precos });
    expect(r.atingida).toBe(true);
    expect(r.gapMensal).toBe(0);
    expect(r.sugestoes).toEqual([]);
  });

  it("meta inválida/zero devolve estado neutro", () => {
    const r = metaProventos({ rows, metaMensal: 0, precos });
    expect(r.atingida).toBe(false);
    expect(r.pctAtingido).toBe(0);
    expect(r.sugestoes).toEqual([]);
  });
});

describe("proventosPorCota12m", () => {
  it("soma o valor por cota dos pagamentos dos últimos 12 meses", () => {
    const divs = [
      { pagamento: "2026-06-13", valor: 1.10 },
      { pagamento: "2026-01-15", valor: 1.20 },
      { pagamento: "2024-05-01", valor: 9.99 }, // fora da janela
    ];
    const hoje = new Date(2026, 5, 15);
    expect(proventosPorCota12m(divs, hoje)).toBeCloseTo(2.30, 5);
  });
  it("retorna 0 sem histórico", () => {
    expect(proventosPorCota12m([], new Date(2026, 5, 15))).toBe(0);
    expect(proventosPorCota12m(undefined, new Date(2026, 5, 15))).toBe(0);
  });
});

describe("mesesDefault", () => {
  it("FII paga todos os 12 meses", () => {
    expect(mesesDefault("fii")).toHaveLength(12);
  });
  it("ação paga trimestral (4 meses)", () => {
    expect(mesesDefault("acao")).toEqual([2, 5, 8, 11]);
  });
  it("tipos sem dividendo retornam vazio", () => {
    expect(mesesDefault("cripto")).toEqual([]);
  });
});

describe("inferirMesesDoHistorico", () => {
  it("extrai os meses (0-11) em que o ticker pagou", () => {
    const prov = [
      { data: "2026-01-15", ticker: "ITUB4" },
      { data: "2026-07-10", ticker: "itub4" }, // case-insensitive
      { data: "2026-03-01", ticker: "PETR4" }, // outro ticker
    ];
    expect(inferirMesesDoHistorico("ITUB4", prov)).toEqual([0, 6]);
  });
  it("retorna vazio quando não há histórico", () => {
    expect(inferirMesesDoHistorico("XPTO3", [])).toEqual([]);
  });
});

describe("montarMapaDividendos", () => {
  it("FII distribui renda em todos os meses (valor × yield mensal)", () => {
    const ativos = [{ ticker: "HGLG11", tipo: "fii", qtd: 100, preco: 100 }]; // valor 10000
    const { rows, totaisPorMes } = montarMapaDividendos({ ativos });
    const r = rows[0];
    expect(r.meses).toHaveLength(12);
    // rendaAnual = 10000 * 0.008 * 12 = 960 ; por mês = 80
    expect(r.rendaAnual).toBeCloseTo(10000 * YIELDS_MENSAIS.fii * 12, 5);
    expect(r.rendaPorMes[0]).toBeCloseTo(80, 5);
    expect(totaisPorMes[5]).toBeCloseTo(80, 5);
  });

  it("ação concentra a renda anual nos meses trimestrais", () => {
    const ativos = [{ ticker: "ITUB4", tipo: "acao", qtd: 100, preco: 30 }]; // valor 3000
    const { rows } = montarMapaDividendos({ ativos });
    const r = rows[0];
    expect(r.meses).toEqual([2, 5, 8, 11]);
    const anual = 3000 * YIELDS_MENSAIS.acao * 12;
    expect(r.rendaPorMes[2]).toBeCloseTo(anual / 4, 5);
    expect(r.rendaPorMes[0]).toBe(0); // janeiro não paga
  });

  it("override do usuário sobrepõe o default", () => {
    const ativos = [{ ticker: "ITUB4", tipo: "acao", qtd: 100, preco: 30 }];
    const overrides = { ITUB4: { meses: [0, 6] } };
    const { rows } = montarMapaDividendos({ ativos, overrides });
    expect(rows[0].meses).toEqual([0, 6]);
    expect(rows[0].rendaPorMes[0]).toBeGreaterThan(0);
    expect(rows[0].rendaPorMes[2]).toBe(0);
  });

  it("usa os meses inferidos do histórico quando não há override", () => {
    const ativos = [{ ticker: "ITUB4", tipo: "acao", qtd: 100, preco: 30 }];
    const proventosManuais = [{ data: "2026-02-01", ticker: "ITUB4" }, { data: "2026-08-01", ticker: "ITUB4" }];
    const { rows } = montarMapaDividendos({ ativos, proventosManuais });
    expect(rows[0].meses).toEqual([1, 7]);
  });

  it("inclui candidatos (planejados) com valorPlanejado", () => {
    const candidatos = [{ ticker: "MXRF11", tipo: "fii", valorPlanejado: 5000 }];
    const { rows } = montarMapaDividendos({ ativos: [], candidatos });
    expect(rows[0].ticker).toBe("MXRF11");
    expect(rows[0].candidato).toBe(true);
    expect(rows[0].valor).toBe(5000);
  });

  it("aponta as lacunas (meses sem nenhuma renda)", () => {
    // só uma ação trimestral (Mar/Jun/Set/Dez) → 8 meses ficam vazios
    const ativos = [{ ticker: "ITUB4", tipo: "acao", qtd: 100, preco: 30 }];
    const { lacunas } = montarMapaDividendos({ ativos });
    expect(lacunas).toEqual([0, 1, 3, 4, 6, 7, 9, 10]);
  });

  it("usa DY informado nos fundamentos quando existe", () => {
    const ativos = [{ ticker: "HGLG11", tipo: "fii", qtd: 100, preco: 100 }];
    const fundamentos = { HGLG11: { dados: { dy: 11.2 } } };
    const { rows } = montarMapaDividendos({ ativos, fundamentos });
    expect(rows[0].dy).toBe(11.2);
  });

  it("a renda anual usa o DY real do ativo (fundamentos), não a média da classe", () => {
    // valor 10000; DY médio da classe FII geraria 960 (8%*12), mas o DY real
    // informado nos fundamentos (11,2%) deve prevalecer: 10000 * 0.112 = 1120.
    const ativos = [{ ticker: "HGLG11", tipo: "fii", qtd: 100, preco: 100 }];
    const fundamentos = { HGLG11: { dados: { dy: 11.2 } } };
    const { rows } = montarMapaDividendos({ ativos, fundamentos });
    expect(rows[0].rendaAnual).toBeCloseTo(1120, 5);
  });

  it("candidato com DY explícito usa esse DY na renda anual", () => {
    const candidatos = [{ ticker: "MXRF11", tipo: "fii", valorPlanejado: 5000, dy: 13 }];
    const { rows } = montarMapaDividendos({ ativos: [], candidatos });
    expect(rows[0].rendaAnual).toBeCloseTo(5000 * 0.13, 5);
  });

  it("usa histórico REAL de proventos (brapi) quando disponível — valores exatos por mês", () => {
    // 100 cotas; pagamentos reais de R$0,10/cota em jan, R$0,11 em fev.
    const ativos = [{ ticker: "HGLG11", tipo: "fii", qtd: 100, preco: 100 }];
    const historicoReal = {
      HGLG11: [
        { pagamento: "2026-01-15", valor: 0.10 },
        { pagamento: "2026-02-14", valor: 0.11 },
      ],
    };
    const hoje = new Date(2026, 5, 15); // 15/06/2026 — ambos dentro de 12 meses
    const { rows } = montarMapaDividendos({ ativos, historicoReal, hoje });
    const r = rows[0];
    expect(r.real).toBe(true);
    expect(r.rendaPorMes[0]).toBeCloseTo(10, 5);  // jan: 0.10 × 100
    expect(r.rendaPorMes[1]).toBeCloseTo(11, 5);  // fev: 0.11 × 100
    expect(r.rendaPorMes[2]).toBe(0);
    expect(r.rendaAnual).toBeCloseTo(21, 5);
    expect(r.meses).toEqual([0, 1]);
    // DY passa a refletir o histórico real: 21 / 10000 = 0,21%
    expect(r.dy).toBeCloseTo(0.21, 5);
  });

  it("histórico real ignora pagamentos com mais de 12 meses", () => {
    const ativos = [{ ticker: "HGLG11", tipo: "fii", qtd: 100, preco: 100 }];
    const historicoReal = {
      HGLG11: [
        { pagamento: "2026-05-15", valor: 0.10 }, // dentro da janela
        { pagamento: "2024-01-15", valor: 9.99 }, // fora — ignorado
      ],
    };
    const hoje = new Date(2026, 5, 15);
    const { rows } = montarMapaDividendos({ ativos, historicoReal, hoje });
    expect(rows[0].rendaAnual).toBeCloseTo(10, 5);
    expect(rows[0].meses).toEqual([4]);
  });

  it("candidato NÃO usa histórico real (continua estimado por DY)", () => {
    const candidatos = [{ ticker: "MXRF11", tipo: "fii", valorPlanejado: 5000, dy: 13 }];
    const historicoReal = { MXRF11: [{ pagamento: "2026-05-15", valor: 0.10 }] };
    const hoje = new Date(2026, 5, 15);
    const { rows } = montarMapaDividendos({ ativos: [], candidatos, historicoReal, hoje });
    expect(rows[0].real).toBeFalsy();
    expect(rows[0].rendaAnual).toBeCloseTo(650, 5);
  });

  it("ignora tipos que não pagam dividendo (cripto, cdb)", () => {
    const ativos = [
      { ticker: "BTC", tipo: "cripto", qtd: 1, preco: 300000 },
      { ticker: "CDB1", tipo: "cdb", qtd: 1, preco: 10000 },
      { ticker: "HGLG11", tipo: "fii", qtd: 10, preco: 100 },
    ];
    const { rows } = montarMapaDividendos({ ativos });
    expect(rows.map((r) => r.ticker)).toEqual(["HGLG11"]);
  });
});
