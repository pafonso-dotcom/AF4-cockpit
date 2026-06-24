import { describe, it, expect } from "vitest";
import { filtrarPorLoja, resumoLoja, migrarNegocioLojas, LOJA_TODAS } from "../negocioLojas.js";

describe("filtrarPorLoja", () => {
  const itens = [{ lojaId: "a" }, { lojaId: "b" }, { lojaId: "a" }];
  it("filtra pela loja", () => { expect(filtrarPorLoja(itens, "a")).toHaveLength(2); });
  it("'todas' devolve tudo", () => { expect(filtrarPorLoja(itens, LOJA_TODAS)).toHaveLength(3); });
  it("entrada nula → []", () => { expect(filtrarPorLoja(null, "a")).toEqual([]); });
});

describe("resumoLoja", () => {
  const state = {
    contas: [{ lojaId: "a", saldo: 1000 }, { lojaId: "b", saldo: 500 }],
    despesasFixas: [{ lojaId: "a", valor: 100 }],
    despesasVar: [{ lojaId: "a", valor: 50 }, { lojaId: "b", valor: 20 }],
    recebimentos: [{ lojaId: "a", valor: 300 }],
  };
  it("resume uma loja", () => {
    const r = resumoLoja(state, "a");
    expect(r.saldoBanco).toBe(1000);
    expect(r.despesasFixas).toBe(100);
    expect(r.despesasVar).toBe(50);
    expect(r.recebimentos).toBe(300);
    expect(r.resultado).toBe(300 - 150);
  });
  it("'todas' consolida", () => {
    const r = resumoLoja(state, LOJA_TODAS);
    expect(r.saldoBanco).toBe(1500);
    expect(r.despesasVar).toBe(70);
  });
});

describe("migrarNegocioLojas", () => {
  it("cria Loja 1 e atribui lojaId aos itens sem", () => {
    const out = migrarNegocioLojas({
      negocioFinContas: [{ id: "c1", saldo: 10 }],
      negocioFinDespesasVar: [{ id: "d1", valor: 5 }],
    });
    expect(out.negocioLojas).toHaveLength(1);
    expect(out.negocioLojas[0].nome).toBe("Loja 1");
    const lojaId = out.negocioLojas[0].id;
    expect(out.negocioLojaAtiva).toBe(lojaId);
    expect(out.negocioFinContas[0].lojaId).toBe(lojaId);
    expect(out.negocioFinDespesasVar[0].lojaId).toBe(lojaId);
    expect(out.negocioRecebimentos).toEqual([]);
  });
  it("preserva lojas existentes e não re-migra", () => {
    const out = migrarNegocioLojas({
      negocioLojas: [{ id: "L9", nome: "Centro" }],
      negocioLojaAtiva: "L9",
      negocioFinContas: [{ id: "c1", saldo: 10, lojaId: "L9" }],
    });
    expect(out.negocioLojas).toEqual([{ id: "L9", nome: "Centro" }]);
    expect(out.negocioLojaAtiva).toBe("L9");
    expect(out.negocioFinContas[0].lojaId).toBe("L9");
  });
});
