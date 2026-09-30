import { describe, it, expect } from "vitest";
import { renomearContaNosLancamentos } from "../renomearConta.js";

describe("renomearContaNosLancamentos (bug do extrato vazio, 2026-09-30)", () => {
  it("propaga o novo nome pra transações, fixas e ativos", () => {
    const r = renomearContaNosLancamentos("BANCO DA AF4", "AF4-CARROS", {
      transacoes: [
        { id: "t1", conta: "BANCO DA AF4", valor: 73000 },
        { id: "t2", conta: "ITAU", valor: 10 },
      ],
      fixas: [{ id: "f1", contaPadrao: "BANCO DA AF4" }, { id: "f2", contaPadrao: "" }],
      ativos: [{ id: "a1", conta: "BANCO DA AF4" }],
    });
    expect(r.transacoes[0].conta).toBe("AF4-CARROS");
    expect(r.transacoes[1].conta).toBe("ITAU");
    expect(r.fixas[0].contaPadrao).toBe("AF4-CARROS");
    expect(r.fixas[1].contaPadrao).toBe("");
    expect(r.ativos[0].conta).toBe("AF4-CARROS");
    expect(r.n).toBe(3);
  });

  it("nome com espaço nas pontas casa mesmo assim (trim dos dois lados)", () => {
    const r = renomearContaNosLancamentos(" AF4 ", "AF4-CARROS", {
      transacoes: [{ id: "t1", conta: "AF4" }],
    });
    expect(r.transacoes[0].conta).toBe("AF4-CARROS");
    expect(r.n).toBe(1);
  });

  it("sem nada pra trocar devolve n=0", () => {
    const r = renomearContaNosLancamentos("X", "Y", { transacoes: [{ id: "t1", conta: "Z" }] });
    expect(r.n).toBe(0);
  });
});
