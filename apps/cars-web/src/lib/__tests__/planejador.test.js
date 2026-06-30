import { describe, it, expect } from "vitest";
import { taxaMensal, pmtMeta, projetarRiqueza, dividirBaldes, montarPlano } from "../planejador.js";

// Cenário exato da planilha de origem (validação das fórmulas).
describe("taxaMensal", () => {
  it("converte taxa anual em mensal equivalente", () => {
    expect(taxaMensal(0.11)).toBeCloseTo(0.008734593824, 8);
    expect(taxaMensal(0.1507)).toBeCloseTo(0.01176622148, 8);
  });
});

describe("pmtMeta", () => {
  it("reserva 10k → 63,6k em 12 meses a 11% ≈ 4168,78/mês", () => {
    expect(pmtMeta(10000, 63600, 12, 0.11)).toBeCloseTo(4168.78, 1);
  });
  it("entrada apto 20k → 200k em 60 meses a 11% ≈ 2120,34/mês", () => {
    expect(pmtMeta(20000, 200000, 60, 0.11)).toBeCloseTo(2120.34, 1);
  });
  it("carro 5k → 80k em 36 meses a 11% ≈ 1738,26/mês", () => {
    expect(pmtMeta(5000, 80000, 36, 0.11)).toBeCloseTo(1738.26, 1);
  });
  it("retorna 0 quando a meta já está coberta", () => {
    expect(pmtMeta(100000, 50000, 12, 0.11)).toBe(0);
  });
  it("retorna 0 com meses <= 0", () => {
    expect(pmtMeta(0, 1000, 0, 0.11)).toBe(0);
  });
});

describe("projetarRiqueza", () => {
  it("50k + 11.916/mês a 15,07% por 264 meses ≈ 22,3M (FV) e 8,9M (hoje)", () => {
    const r = projetarRiqueza(50000, 11915.96761, 0.1507, 264, 0.0426);
    expect(r.fv).toBeCloseTo(22299734, -3); // ~22,3 milhões
    expect(r.vp).toBeCloseTo(8906556, -3);  // ~8,9 milhões em valor de hoje
  });
});

describe("dividirBaldes", () => {
  it("reproduz o split da planilha (25106 / 16278 / 11916)", () => {
    const b = dividirBaldes(53300, 0.8427672956, 0.9107142857);
    expect(b.reserva).toBeCloseTo(25105.97, 0);
    expect(b.duravel).toBeCloseTo(16278.06, 0);
    expect(b.riqueza).toBeCloseTo(11915.97, 0);
    expect(b.reserva + b.duravel + b.riqueza).toBeCloseTo(53300, 2);
  });
  it("garante o piso da riqueza quando os outros baldes dominam", () => {
    const b = dividirBaldes(1000, 1, 1, { reserva: 0.5, duravel: 0.5, riqueza: 0 }, 0.05);
    expect(b.riqueza).toBeCloseTo(50, 5); // 5% piso
    expect(b.reserva + b.duravel + b.riqueza).toBeCloseTo(1000, 5);
  });
  it("sobra 0 → tudo 0", () => {
    expect(dividirBaldes(0, 1, 1)).toEqual({ reserva: 0, duravel: 0, riqueza: 0 });
  });
});

describe("montarPlano (integração com o cenário da planilha)", () => {
  const plano = montarPlano({
    sobra: 53300,
    despesaEssencial: 10600,
    mesesReserva: 6,
    saldoReserva: 10000,
    saldoRiqueza: 50000,
    dividaCara: 8000,
    idadeAtual: 38,
    idadeAposentadoria: 60,
    bensDuraveis: [
      { nome: "Entrada do apartamento", valor: 200000, meses: 60, jaTenho: 20000 },
      { nome: "Carro", valor: 80000, meses: 36, jaTenho: 5000 },
    ],
  });

  it("alvo da reserva = essencial × meses", () => {
    expect(plano.alvoReserva).toBe(63600);
  });
  it("baldes batem com a planilha", () => {
    expect(plano.baldes.reserva).toBeCloseTo(25105.97, 0);
    expect(plano.baldes.duravel).toBeCloseTo(16278.06, 0);
    expect(plano.baldes.riqueza).toBeCloseTo(11915.97, 0);
  });
  it("alerta de dívida cara quando há saldo", () => {
    expect(plano.quitarDividaPrimeiro).toBe(true);
  });
  it("projeção da riqueza ≈ 22,3M / 8,9M aos 60", () => {
    expect(plano.projecao.fv).toBeCloseTo(22299734, -4);
    expect(plano.projecao.vp).toBeCloseTo(8906556, -4);
    expect(plano.projecao.anos).toBe(22);
  });
  it("lista metas com PMT (reserva + 2 bens)", () => {
    expect(plano.metas.map(m => m.nome)).toEqual(["Reserva de emergência", "Entrada do apartamento", "Carro"]);
    expect(plano.metas[0].pmt).toBeCloseTo(4168.78, 0);
  });
});
