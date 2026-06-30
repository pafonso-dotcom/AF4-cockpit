import { describe, it, expect } from "vitest";
import { mesesDefault, inferirMesesDoHistorico, montarMapaDividendos } from "../mapaDividendos.js";
import { YIELDS_MENSAIS } from "../yields-base.js";

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
