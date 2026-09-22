import { describe, it, expect } from "vitest";
import {
  duracaoMin, fmtDuracao, simplificarOfertas, aplicarFiltros,
  analisarTendencias, deveChecarAgora, registrarChecagem,
} from "../voos.js";

const OFERTA_JSON = {
  dictionaries: { carriers: { TP: "TAP PORTUGAL" } },
  data: [
    {
      id: "1",
      price: { grandTotal: "8750.00", currency: "BRL" },
      numberOfBookableSeats: 3,
      itineraries: [{
        duration: "PT10H15M",
        segments: [
          { departure: { iataCode: "GRU", at: "2026-12-10T22:30:00" }, arrival: { iataCode: "LIS", at: "2026-12-11T11:45:00" }, carrierCode: "TP", number: "82" },
        ],
      }],
    },
    {
      id: "2",
      price: { grandTotal: "7200.00", currency: "BRL" },
      itineraries: [{
        duration: "PT16H40M",
        segments: [
          { departure: { iataCode: "GRU", at: "2026-12-10T08:00:00" }, arrival: { iataCode: "MAD", at: "2026-12-10T20:10:00" }, carrierCode: "IB", number: "6824" },
          { departure: { iataCode: "MAD", at: "2026-12-10T22:40:00" }, arrival: { iataCode: "LIS", at: "2026-12-10T23:40:00" }, carrierCode: "IB", number: "3110" },
        ],
      }],
    },
  ],
};

describe("voos — parse e filtros", () => {
  it("duração ISO vira minutos e texto", () => {
    expect(duracaoMin("PT10H15M")).toBe(615);
    expect(fmtDuracao(615)).toBe("10h15");
  });

  it("simplificarOfertas ordena por preço e destaca escalas com tempo de conexão", () => {
    const ofertas = simplificarOfertas(OFERTA_JSON);
    expect(ofertas[0].preco).toBe(7200);
    expect(ofertas[0].paradasMax).toBe(1);
    expect(ofertas[0].itinerarios[0].escalas).toEqual([{ aeroporto: "MAD", esperaMin: 150 }]);
    expect(ofertas[1].paradasMax).toBe(0);
    expect(ofertas[1].ciasNomes).toEqual(["TAP PORTUGAL"]);
  });

  it("filtros: sem escala, companhia e janela de horário", () => {
    const ofertas = simplificarOfertas(OFERTA_JSON);
    expect(aplicarFiltros(ofertas, { semEscala: true }).map(o => o.id)).toEqual(["1"]);
    expect(aplicarFiltros(ofertas, { cias: ["IB"] }).map(o => o.id)).toEqual(["2"]);
    expect(aplicarFiltros(ofertas, { janela: "noite" }).map(o => o.id)).toEqual(["1"]); // 22:30
    expect(aplicarFiltros(ofertas, { janela: "manha" }).map(o => o.id)).toEqual(["2"]); // 08:00
  });
});

describe("voos — tendências (calendário de preços)", () => {
  it("acha o mês mais barato e o % de desconto vs mediana", () => {
    const json = { data: [
      { departureDate: "2027-01-15", price: { total: "9800" } },
      { departureDate: "2027-01-20", price: { total: "9500" } },
      { departureDate: "2027-02-10", price: { total: "7000" } },
      { departureDate: "2027-03-05", price: { total: "10000" } },
    ] };
    const t = analisarTendencias(json);
    expect(t.meses.map(m => m.mes)).toEqual(["2027-01", "2027-02", "2027-03"]);
    expect(t.maisBarato.mes).toBe("2027-02");
    expect(t.maisBarato.preco).toBe(7000);
    const fev = t.meses.find(m => m.mes === "2027-02");
    expect(fev.descontoPct).toBeGreaterThan(0);
  });
});

describe("voos — monitor de preço", () => {
  it("deveChecarAgora: horário do dia passou e a última checagem foi antes dele", () => {
    const agora = new Date("2026-09-22T21:00:00");
    expect(deveChecarAgora({ horariosChecagem: ["20:00"], ultimaChecagem: "2026-09-22T08:05:00" }, agora)).toBe(true);
    expect(deveChecarAgora({ horariosChecagem: ["20:00"], ultimaChecagem: "2026-09-22T20:30:00" }, agora)).toBe(false);
    expect(deveChecarAgora({ horariosChecagem: ["22:00"], ultimaChecagem: "2026-09-22T08:05:00" }, agora)).toBe(false);
    expect(deveChecarAgora({ horariosChecagem: ["08:00"] }, agora)).toBe(true); // nunca checou
  });

  it("registrarChecagem: histórico, melhor preço e alvo só dispara na transição", () => {
    const m = { alvo: 9000, ultimoPreco: 9400, melhorPreco: 9400, historico: [] };
    const r1 = registrarChecagem(m, 8750, new Date("2026-09-22T20:01:00"));
    expect(r1.atingiuAlvo).toBe(true);
    expect(r1.monitor.ultimoPreco).toBe(8750);
    expect(r1.monitor.melhorPreco).toBe(8750);
    expect(r1.monitor.historico.length).toBe(1);
    // já estava abaixo do alvo → não dispara de novo
    const r2 = registrarChecagem(r1.monitor, 8600);
    expect(r2.atingiuAlvo).toBe(false);
    expect(r2.monitor.melhorPreco).toBe(8600);
    // subiu e desceu de novo → dispara de novo
    const r3 = registrarChecagem(r2.monitor, 9500);
    expect(r3.atingiuAlvo).toBe(false);
    const r4 = registrarChecagem(r3.monitor, 8900);
    expect(r4.atingiuAlvo).toBe(true);
  });
});
