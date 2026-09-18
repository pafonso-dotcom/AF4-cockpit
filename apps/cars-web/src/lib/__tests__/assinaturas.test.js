import { describe, it, expect } from "vitest";
import { detectarAssinaturas, chaveAssinatura } from "../intelligence.js";

const HOJE = new Date("2026-09-18");
const tx = (descricao, valor, data) => ({ tipo: "despesa", descricao, valor, data });

describe("chaveAssinatura (agrupamento fuzzy)", () => {
  it("junta a mesma assinatura com códigos variáveis da fatura", () => {
    expect(chaveAssinatura("NETFLIX.COM *8471")).toBe(chaveAssinatura("Netflix.com"));
    expect(chaveAssinatura("IFD*Maestro Hamburgueria")).toBe(chaveAssinatura("Maestro Hamburgueria 123"));
    expect(chaveAssinatura("Spotify BR 09/2026")).toBe(chaveAssinatura("SPOTIFY BR"));
  });
});

describe("detectarAssinaturas turbinado", () => {
  it("agrupa descrições com código variável e detecta a assinatura", () => {
    const r = detectarAssinaturas([
      tx("NETFLIX.COM *11", 44.9, "2026-07-05"),
      tx("NETFLIX.COM *22", 44.9, "2026-08-05"),
      tx("NETFLIX.COM *33", 44.9, "2026-09-05"),
    ], HOJE);
    expect(r.length).toBe(1);
    expect(r[0].conhecida).toBe(true);
    expect(r[0].ocorrencias).toBe(3);
    expect(r[0].aumento).toBeNull();
    expect(r[0].parada).toBe(false);
  });

  it("avisa AUMENTO quando a última cobrança sobe vs média das anteriores", () => {
    const r = detectarAssinaturas([
      tx("Spotify", 21.9, "2026-06-10"),
      tx("Spotify", 21.9, "2026-07-10"),
      tx("Spotify", 27.9, "2026-09-10"), // subiu ~27%
    ], HOJE);
    expect(r.length).toBe(1);
    expect(r[0].aumento).toBeTruthy();
    expect(r[0].aumento.de).toBeCloseTo(21.9);
    expect(r[0].aumento.para).toBeCloseTo(27.9);
    expect(r[0].valorUltimo).toBeCloseTo(27.9);
  });

  it("serviço conhecido que subiu MUITO (>30%) não é descartado", () => {
    const r = detectarAssinaturas([
      tx("Netflix", 25.9, "2026-06-05"),
      tx("Netflix", 25.9, "2026-07-05"),
      tx("Netflix", 39.9, "2026-09-05"), // +54% — antes o filtro de 30% descartava
    ], HOJE);
    expect(r.length).toBe(1);
    expect(r[0].aumento).toBeTruthy();
  });

  it("marca PARADA quando não cobra há mais de ~1,6x o intervalo", () => {
    const r = detectarAssinaturas([
      tx("Deezer", 19.9, "2026-03-02"),
      tx("Deezer", 19.9, "2026-04-02"),
      tx("Deezer", 19.9, "2026-05-02"), // última há ~4,5 meses (mensal)
    ], HOJE);
    expect(r[0].parada).toBe(true);
    expect(r[0].diasSemCobrar).toBeGreaterThan(100);
  });

  it("ordenação: aumento primeiro, paradas por último", () => {
    const r = detectarAssinaturas([
      tx("Deezer", 19.9, "2026-02-02"), tx("Deezer", 19.9, "2026-03-02"),      // parada
      tx("Spotify", 21.9, "2026-08-10"), tx("Spotify", 27.9, "2026-09-10"),    // aumento
      tx("Academia Central", 120, "2026-08-01"), tx("Academia Central", 120, "2026-09-01"), // normal
    ], HOJE);
    expect(r[0].aumento).toBeTruthy();
    expect(r[r.length - 1].parada).toBe(true);
  });
});
