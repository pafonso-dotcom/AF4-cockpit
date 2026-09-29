import { describe, it, expect } from "vitest";
import { detectarAnomalias } from "../anomalias.js";

const HOJE = new Date(2026, 8, 29); // 29/09/2026
const fmt = (v) => `R$${Math.round(v)}`;
const tx = (data, valor, categoria, descricao = "") => ({ id: Math.random().toString(36), tipo: "despesa", data, valor, categoria, descricao });

describe("detectarAnomalias", () => {
  it("categoria 2× acima da média dos 3 meses vira alerta vermelho", () => {
    const transacoes = [
      // média Mercado 3m = 300
      tx("2026-06-10", 300, "Mercado"), tx("2026-07-10", 300, "Mercado"), tx("2026-08-10", 300, "Mercado"),
      // mês atual: 700 (2,3×)
      tx("2026-09-05", 400, "Mercado"), tx("2026-09-20", 300, "Mercado"),
    ];
    const a = detectarAnomalias({ transacoes, hoje: HOJE, fmt });
    expect(a.length).toBe(1);
    expect(a[0].cor).toBe("red");
    expect(a[0].texto).toContain("Mercado");
    expect(a[0].texto).toContain("2.3×");
  });

  it("mês normal não alerta; sem histórico (1 mês só) também não", () => {
    const normal = [
      tx("2026-06-10", 300, "Mercado"), tx("2026-07-10", 300, "Mercado"), tx("2026-08-10", 300, "Mercado"),
      tx("2026-09-10", 350, "Mercado"),
    ];
    expect(detectarAnomalias({ transacoes: normal, hoje: HOJE, fmt })).toEqual([]);
    const semHistorico = [tx("2026-08-10", 100, "Pet"), tx("2026-09-10", 500, "Pet")];
    expect(detectarAnomalias({ transacoes: semHistorico, hoje: HOJE, fmt })).toEqual([]);
  });

  it("compra atípica (3× a média da categoria) nos últimos 7 dias", () => {
    const transacoes = [
      tx("2026-06-10", 150, "Lazer"), tx("2026-07-10", 150, "Lazer"), tx("2026-08-10", 150, "Lazer"),
      tx("2026-09-27", 600, "Lazer", "Show do Bruno Mars"), // 4× a média, ≥300, há 2 dias
      tx("2026-09-02", 900, "Lazer", "antiga"),             // fora dos 7 dias → não entra como compra
    ];
    const a = detectarAnomalias({ transacoes, hoje: HOJE, fmt });
    const compra = a.find(x => x.texto.includes("atípica"));
    expect(compra).toBeTruthy();
    expect(compra.texto).toContain("Show do Bruno Mars");
    expect(compra.cor).toBe("gold");
  });

  it("limita a 3 avisos, do mais grave pro menos", () => {
    const transacoes = [];
    for (const cat of ["A", "B", "C", "D"]) {
      transacoes.push(tx("2026-06-10", 200, cat), tx("2026-07-10", 200, cat), tx("2026-08-10", 200, cat));
      transacoes.push(tx("2026-09-10", cat === "A" ? 2000 : 500, cat)); // A = 10×, resto 2,5×
    }
    const a = detectarAnomalias({ transacoes, hoje: HOJE, fmt });
    expect(a.length).toBe(3);
    expect(a[0].texto).toContain("A já está");
  });
});
