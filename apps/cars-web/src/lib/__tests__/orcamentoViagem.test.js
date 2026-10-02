import { describe, it, expect } from "vitest";
import { resumoOrcamento, estimarOrcamento, duracaoViagem, emReais } from "../orcamentoViagem.js";

describe("orçamento de viagem", () => {
  it("duração e conversão", () => {
    expect(duracaoViagem({ inicio: "2026-11-10", fim: "2026-11-15" })).toEqual({ dias: 6, noites: 5 });
    expect(emReais(100, "EUR", { EUR: 6 })).toBe(600);
    expect(emReais(100, "USD", {})).toBe(0);
  });
  it("dinheiro, milhas e misto", () => {
    const orc = { pessoas: 2, itens: [
      { cat: "passagens", forma: "milhas", milhas: 60000, programa: "Smiles", valor: 999 },
      { cat: "passagens", forma: "misto", milhas: 20000, programa: "LATAM Pass", valor: 300, moeda: "BRL", pago: true },
      { cat: "hospedagem", valor: 200, moeda: "EUR", pago: false },
    ] };
    const r = resumoOrcamento(orc, { EUR: 6 }, { dias: 5 });
    expect(r.previsto).toBe(300 + 1200);   // milhas puras não somam dinheiro
    expect(r.pago).toBe(300);
    expect(r.falta).toBe(1200);
    expect(r.milhas).toBe(80000);
    expect(r.milhasBRL).toBe(60 * 18 + 20 * 25);
    expect(r.total).toBe(1500 + 1580);
    expect(r.porPessoa).toBe(3080 / 2);
    expect(r.semCambio).toBe(false);
    expect(resumoOrcamento(orc, {}, { dias: 5 }).semCambio).toBe(true);
  });
  it("estimativa só preenche categorias vazias", () => {
    const itens = estimarOrcamento("economica", 2, { dias: 3, noites: 2 }, true, [{ cat: "hospedagem" }]);
    expect(itens.some(i => i.cat === "hospedagem")).toBe(false);
    expect(itens.find(i => i.cat === "alimentacao").valor).toBe(120 * 2 * 3);
  });
});
