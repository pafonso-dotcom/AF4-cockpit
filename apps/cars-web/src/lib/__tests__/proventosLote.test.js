import { describe, it, expect } from "vitest";
import { montarBaixaLote } from "../proventosLote.js";

const pendentes = [
  { id: "a1", ticker: "HGLG11", tipo: "Rendimento", data: "2026-09-14", total: 110 },
  { id: "a2", ticker: "PETR4", tipo: "Dividendo", data: "2026-09-20", total: 55.5 },
  { id: "a3", ticker: "XPML11", tipo: "Rendimento", data: "2026-09-25", total: 0 }, // sem valor: fora
];

describe("montarBaixaLote", () => {
  it("destino carteira: marca recebidos e cria movimentos de recebimento", () => {
    let n = 0;
    const r = montarBaixaLote(pendentes, { destino: "carteira", dataBaixa: "2026-09-21", mkId: () => `id${++n}` });
    expect(r.itens).toHaveLength(2);
    expect(r.total).toBeCloseTo(165.5);
    expect(r.recebidos.a1).toEqual({ dataBaixa: "2026-09-21", valor: 110, destino: "carteira" });
    expect(r.recebidos.a3).toBeUndefined();
    expect(r.movimentos).toHaveLength(2);
    expect(r.movimentos[0]).toMatchObject({ tipo: "recebimento", valor: 110, proventoKey: "a1", ticker: "HGLG11" });
    expect(r.transacoes).toHaveLength(0);
  });

  it("destino conta: cria uma receita compensada por provento", () => {
    const r = montarBaixaLote(pendentes, {
      destino: "conta", contaDestino: "Nubank", dataBaixa: "2026-09-21",
      categoria: "Proventos", mkId: () => "x",
    });
    expect(r.transacoes).toHaveLength(2);
    expect(r.transacoes[1]).toMatchObject({
      tipo: "receita", conta: "Nubank", categoria: "Proventos",
      valor: 55.5, compensado: true, descricao: "PETR4 · Dividendo",
    });
    expect(r.recebidos.a2).toMatchObject({ destino: "conta", contaDestino: "Nubank" });
    expect(r.movimentos).toHaveLength(0);
  });

  it("lista vazia não quebra", () => {
    const r = montarBaixaLote([], { destino: "carteira", dataBaixa: "2026-09-21" });
    expect(r.itens).toHaveLength(0);
    expect(r.total).toBe(0);
  });
});
