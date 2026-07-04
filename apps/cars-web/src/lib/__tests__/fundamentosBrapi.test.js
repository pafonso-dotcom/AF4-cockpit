import { describe, it, expect } from "vitest";
import { mapearFundamentosBrapi } from "../fundamentosBrapi.js";

// Amostra realista do shape da brapi (?modules=defaultKeyStatistics,financialData)
const rawAcao = {
  symbol: "WEGE3",
  regularMarketPrice: 46.68,
  regularMarketVolume: 12000000,
  defaultKeyStatistics: {
    dividendYield: 1.35,            // brapi costuma mandar em %
    bookValue: 5.32,                // por ação
    sharesOutstanding: 4200000000,
    enterpriseToEbitda: 22.4,
    priceToBook: 8.77,
  },
  financialData: {
    returnOnEquity: 0.271,          // fração (estilo Yahoo)
    profitMargins: 0.162,
    operatingMargins: 0.184,
    totalDebt: 3500000000,
    ebitda: 7000000000,
  },
};

describe("mapearFundamentosBrapi · ação", () => {
  const { dados } = mapearFundamentosBrapi(rawAcao, "acao");

  it("converte frações pra % (ROE, margens)", () => {
    expect(dados.roe).toBeCloseTo(27.1, 1);
    expect(dados.margemLiq).toBeCloseTo(16.2, 1);
    expect(dados.margemEbit).toBeCloseTo(18.4, 1);
  });
  it("calcula dívida/EBITDA, PL em bilhões e liquidez em milhões", () => {
    expect(dados.dividaEbitda).toBeCloseTo(0.5, 2);
    expect(dados.pl).toBeCloseTo((5.32 * 4200000000) / 1e9, 1);       // ~22.3 Bi
    expect(dados.liquidez).toBeCloseTo((46.68 * 12000000) / 1e6, 0);  // ~560 M/dia
  });
  it("não inventa campo sem dado na resposta", () => {
    expect(dados.ipo).toBeUndefined();
    expect(dados.tagalong).toBeUndefined();
  });
});

describe("mapearFundamentosBrapi · FII e casos de borda", () => {
  it("FII: mapeia DY e patrimônio", () => {
    const { dados } = mapearFundamentosBrapi({
      defaultKeyStatistics: { dividendYield: 11.2, bookValue: 100, sharesOutstanding: 30000000 },
    }, "fii");
    expect(dados.dy).toBeCloseTo(11.2, 1);
    expect(dados.patrimonio).toBeCloseTo(3, 2); // 3 Bi
  });
  it("DY em fração (estilo Yahoo) vira %", () => {
    const { dados } = mapearFundamentosBrapi({ defaultKeyStatistics: { dividendYield: 0.095 } }, "fii");
    expect(dados.dy).toBeCloseTo(9.5, 2);
  });
  it("ROE já em % não é multiplicado de novo", () => {
    const { dados } = mapearFundamentosBrapi({ financialData: { returnOnEquity: 27.1 } }, "acao");
    expect(dados.roe).toBeCloseTo(27.1, 1);
  });
  it("resposta vazia devolve dados vazios sem quebrar", () => {
    expect(mapearFundamentosBrapi(null, "acao").dados).toEqual({});
    expect(mapearFundamentosBrapi({}, "fii").dados).toEqual({});
  });
});
