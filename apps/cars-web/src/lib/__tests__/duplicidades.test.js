import { describe, it, expect } from "vitest";
import { varrerDuplicidades } from "../duplicidades.js";

describe("varrerDuplicidades", () => {
  it("agrupa transações repetidas (mesmo tipo/valor/data/conta/descrição) e mantém 1", () => {
    const state = {
      transacoes: [
        { id: "t1", tipo: "despesa", valor: 100, data: "2026-07-05", conta: "ITAU", descricao: "Mercado" },
        { id: "t2", tipo: "despesa", valor: 100, data: "2026-07-05", conta: "ITAU", descricao: "mercado" }, // dup (case)
        { id: "t3", tipo: "despesa", valor: 100, data: "2026-07-06", conta: "ITAU", descricao: "Mercado" }, // data diferente → não dup
      ],
    };
    const r = varrerDuplicidades(state);
    expect(r.totalGrupos).toBe(1);
    expect(r.totalExtra).toBe(1);
    const g = r.grupos[0];
    expect(g.manter).toBe("t1");
    expect(g.remover).toEqual(["t2"]);
    expect(r.porTipo.transacoes.remover).toEqual(["t2"]);
  });

  it("detecta dívidas e cartões duplicados; ignora itens sem id", () => {
    const state = {
      dividas: [
        { id: "d1", nome: "Luz", valor: 200, vencimento: "2026-07-10" },
        { id: "d2", nome: "luz", valor: 200, vencimento: "2026-07-10" },
      ],
      cartoes: [
        { id: "c1", nome: "Nubank" }, { id: "c2", nome: "nubank" }, { nome: "Nubank" }, // sem id não conta
      ],
    };
    const r = varrerDuplicidades(state);
    expect(r.porTipo.dividas.remover).toEqual(["d2"]);
    expect(r.porTipo.cartoes.remover).toEqual(["c2"]);
  });

  it("sem duplicidade → tudo zerado", () => {
    const r = varrerDuplicidades({
      transacoes: [{ id: "t1", tipo: "receita", valor: 10, data: "2026-01-01", conta: "A", descricao: "x" }],
      contas: [{ id: "c1", nome: "ITAU" }, { id: "c2", nome: "Nubank" }],
    });
    expect(r.totalGrupos).toBe(0);
    expect(r.totalExtra).toBe(0);
    expect(r.grupos).toEqual([]);
  });
});
