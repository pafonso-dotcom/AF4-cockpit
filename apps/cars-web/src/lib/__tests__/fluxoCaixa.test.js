import { describe, it, expect } from "vitest";
import { montarFluxoCaixa } from "../fluxoCaixa.js";

const HOJE = new Date(2026, 8, 28); // 28/09/2026
const CONTA = { id: "c1", nome: "ITAU", saldo: 1000, moeda: "BRL", escopo: "pessoal" };

describe("montarFluxoCaixa — projeção diária do caixa", () => {
  it("acumula evento a evento em ordem cronológica e fecha o saldo", () => {
    const state = {
      contas: [CONTA],
      fixas: [{ id: "f1", descricao: "Aluguel", valor: 300, escopo: "pessoal", inicioEm: "2026-10" }],
      fixaOcorrencias: [{ id: "o1", fixaId: "f1", mes: "2026-10", dataVencimento: "2026-10-05", valor: 300 }],
      devedores: [{ id: "d1", nome: "Jorge", valor: 500, vencimento: "2026-10-02", escopo: "pessoal" }],
    };
    const f = montarFluxoCaixa(state, "tudo", 30, HOJE);
    expect(f.saldoInicial).toBe(1000);
    expect(f.eventos.map(e => `${e.data} ${e.tipo} ${e.valor}`)).toEqual([
      "2026-10-02 entrada 500",
      "2026-10-05 saida 300",
    ]);
    expect(f.eventos[0].saldoApos).toBe(1500);
    expect(f.eventos[1].saldoApos).toBe(1200);
    expect(f.saldoFinal).toBe(1200);
    expect(f.primeiroNegativo).toBe(null);
  });

  it("atrasado cai no bucket de HOJE com a flag", () => {
    const state = {
      contas: [CONTA],
      dividas: [{ id: "dv1", nome: "Boleto vencido", valor: 200, vencimento: "2026-09-10", escopo: "pessoal" }],
    };
    const f = montarFluxoCaixa(state, "tudo", 30, HOJE);
    const ev = f.eventos.find(e => e.descricao.includes("Boleto"));
    expect(ev.data).toBe("2026-09-28");
    expect(ev.atrasado).toBe(true);
  });

  it("detecta o primeiro dia em que o caixa fura e o pior dia", () => {
    const state = {
      contas: [{ ...CONTA, saldo: 100 }],
      dividas: [
        { id: "d1", nome: "Parcela carro", valor: 400, vencimento: "2026-10-03", escopo: "pessoal" },
        { id: "d2", nome: "Escola", valor: 200, vencimento: "2026-10-10", escopo: "pessoal" },
      ],
      devedores: [{ id: "r1", nome: "Cliente", valor: 800, vencimento: "2026-10-15", escopo: "pessoal" }],
    };
    const f = montarFluxoCaixa(state, "tudo", 30, HOJE);
    expect(f.primeiroNegativo).toBe("2026-10-03"); // 100 − 400 = −300
    expect(f.piorDia).toEqual({ dataISO: "2026-10-10", saldo: -500 });
    expect(f.saldoFinal).toBe(300);
  });

  it("respeita o escopo", () => {
    const state = {
      contas: [CONTA, { id: "c2", nome: "LOJA", saldo: 9000, moeda: "BRL", escopo: "negocio" }],
      dividas: [{ id: "d1", nome: "Fornecedor", valor: 100, vencimento: "2026-10-01", escopo: "negocio" }],
    };
    const pes = montarFluxoCaixa(state, "pessoal", 30, HOJE);
    expect(pes.saldoInicial).toBe(1000);
    expect(pes.eventos).toEqual([]);
    const neg = montarFluxoCaixa(state, "negocio", 30, HOJE);
    expect(neg.saldoInicial).toBe(9000);
    expect(neg.eventos.length).toBe(1);
  });
});
