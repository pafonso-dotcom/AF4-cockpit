import { describe, it, expect } from "vitest";
import { proventosRecebidosPorTicker } from "../invest-utils.js";

describe("proventosRecebidosPorTicker", () => {
  const historico = [
    { tipo: "recebimento", ticker: "KNCR11", valor: 100.5 },
    { tipo: "recebimento", ticker: "kncr11", valor: 18.3 },  // case-insensitive
    { tipo: "recebimento", ticker: "MXRF11", valor: 42.0 },
    { tipo: "reinvestimento", ticker: "KNCR11", valor: 999 }, // não é recebimento — ignora
    { tipo: "recebimento", valor: 10 },                        // sem ticker — ignora
  ];

  it("soma só os recebimentos, por ticker normalizado", () => {
    const m = proventosRecebidosPorTicker(historico);
    expect(m.KNCR11).toBeCloseTo(118.8, 5);
    expect(m.MXRF11).toBeCloseTo(42.0, 5);
    expect(Object.keys(m)).toHaveLength(2);
  });

  it("tolera histórico vazio/ausente", () => {
    expect(proventosRecebidosPorTicker([])).toEqual({});
    expect(proventosRecebidosPorTicker(undefined)).toEqual({});
  });
});
