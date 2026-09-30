import { describe, it, expect } from "vitest";
import { competenciaDaCompra, avulsasPendentesNoMes, parcelasPendentesNoMes, competenciaFaturaEsperada } from "../cartaoFatura.js";

describe("competenciaDaCompra", () => {
  it("compra até o dia do fechamento cai no mês da própria data", () => {
    expect(competenciaDaCompra("2026-09-10", 28)).toBe("2026-09");
    expect(competenciaDaCompra("2026-09-28", 28)).toBe("2026-09");
  });

  it("compra DEPOIS do fechamento cai no mês seguinte (vira o ano em dezembro)", () => {
    expect(competenciaDaCompra("2026-09-29", 28)).toBe("2026-10");
    expect(competenciaDaCompra("2026-12-30", 28)).toBe("2027-01");
  });

  it("sem fechamento válido usa o mês da data; data inválida retorna null", () => {
    expect(competenciaDaCompra("2026-09-30", null)).toBe("2026-09");
    expect(competenciaDaCompra("2026-09-30", 0)).toBe("2026-09");
    expect(competenciaDaCompra("ontem", 28)).toBeNull();
  });
});

describe("competenciaFaturaEsperada — mês da fatura em aberto pra pagamento", () => {
  it("Mercado Livre (vence dia 4) importada dia 30/09 → fatura de OUT (bug 2026-09-30)", () => {
    expect(competenciaFaturaEsperada({ vencimento: 4, fechamento: 29 }, "2026-09-30")).toBe("2026-10");
  });

  it("antes do dia de vencimento, a fatura ainda é deste mês", () => {
    expect(competenciaFaturaEsperada({ vencimento: 15, fechamento: 8 }, "2026-09-10")).toBe("2026-09");
    expect(competenciaFaturaEsperada({ vencimento: 15, fechamento: 8 }, "2026-09-15")).toBe("2026-09"); // no dia ainda vale
  });

  it("depois do vencimento vira o mês (e o ano em dezembro)", () => {
    expect(competenciaFaturaEsperada({ vencimento: 15 }, "2026-09-30")).toBe("2026-10");
    expect(competenciaFaturaEsperada({ vencimento: 5 }, "2026-12-20")).toBe("2027-01");
  });

  it("sem vencimento cadastrado ou data inválida → null", () => {
    expect(competenciaFaturaEsperada({ fechamento: 29 }, "2026-09-30")).toBeNull();
    expect(competenciaFaturaEsperada({ vencimento: 4 }, "hoje")).toBeNull();
    expect(competenciaFaturaEsperada(null, "2026-09-30")).toBeNull();
  });
});

describe("avulsasPendentesNoMes", () => {
  const cartao = { id: "xp", fechamento: 28 };
  const tx = (over = {}) => ({
    cartaoId: "xp", tipo: "despesa", compensado: false,
    valor: 100, data: "2026-09-10", ...over,
  });

  it("soma as avulsas pendentes do cartão na competência", () => {
    const t = [tx(), tx({ valor: 50.5, data: "2026-09-12" })];
    expect(avulsasPendentesNoMes(cartao, t, "2026-09")).toBeCloseTo(150.5);
  });

  it("compra após o fechamento conta no mês seguinte", () => {
    const t = [tx({ data: "2026-09-29" })];
    expect(avulsasPendentesNoMes(cartao, t, "2026-09")).toBe(0);
    expect(avulsasPendentesNoMes(cartao, t, "2026-10")).toBe(100);
  });

  it("ignora compensadas, outros cartões, receitas e origem fatura-*", () => {
    const t = [
      tx({ compensado: true }),
      tx({ cartaoId: "outro" }),
      tx({ tipo: "receita" }),
      tx({ origem: "fatura-xp" }),
    ];
    expect(avulsasPendentesNoMes(cartao, t, "2026-09")).toBe(0);
  });

  it("compra-manual e compra-foto contam normalmente", () => {
    const t = [tx({ origem: "compra-manual" }), tx({ origem: "compra-foto", valor: 200 })];
    expect(avulsasPendentesNoMes(cartao, t, "2026-09")).toBe(300);
  });

  it("parcelasPendentesNoMes soma só as parcelas não pagas que vencem no mês", () => {
    const parc = {
      cartaoId: "xp", totalParcelas: 4, valorTotal: 400,
      dataPrimeira: "2026-08-10", parcelasPagas: [1],
    };
    // Parcelas: 1=ago (paga), 2=set, 3=out, 4=nov
    expect(parcelasPendentesNoMes(cartao, [parc], "2026-08")).toBe(0);
    expect(parcelasPendentesNoMes(cartao, [parc], "2026-09")).toBe(100);
    expect(parcelasPendentesNoMes(cartao, [parc], "2026-10")).toBe(100);
    expect(parcelasPendentesNoMes({ id: "outro" }, [parc], "2026-09")).toBe(0);
  });

  it("incluirAnteriores rola compras de competências passadas pra fatura seguinte", () => {
    const t = [tx({ data: "2026-09-10" }), tx({ data: "2026-10-05", valor: 40 })];
    // Sem rolagem: outubro só vê a compra de outubro.
    expect(avulsasPendentesNoMes(cartao, t, "2026-10")).toBe(40);
    // Com rolagem (fatura de setembro fechada/paga): setembro rola pra outubro.
    expect(avulsasPendentesNoMes(cartao, t, "2026-10", { incluirAnteriores: true })).toBe(140);
  });
});
