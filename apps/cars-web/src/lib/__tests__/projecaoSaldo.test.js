import { describe, it, expect } from "vitest";
import { getProjecaoSaldo } from "../agregador.js";

// Data fixa pra previsibilidade dos meses (15/05/2026).
const HOJE = new Date(2026, 4, 15);

describe("getProjecaoSaldo", () => {
  it("parte do saldo somado das contas e gera N meses", () => {
    const state = { contas: [{ nome: "A", saldo: 1000 }, { nome: "B", saldo: 500 }] };
    const r = getProjecaoSaldo(state, "tudo", 6, HOJE);
    expect(r.saldoInicial).toBe(1500);
    expect(r.meses).toHaveLength(6);
    // Sem despesas/ganhos, o saldo se mantém.
    expect(r.meses[5].saldoFim).toBe(1500);
  });

  it("subtrai despesa fixa pendente do mês", () => {
    const state = {
      contas: [{ nome: "A", saldo: 1000 }],
      fixaOcorrencias: [
        { id: "o1", fixaId: "f1", mes: "2026-05", dataVencimento: "2026-05-20", status: "pendente", valor: 200 },
      ],
      fixas: [{ id: "f1", descricao: "Aluguel" }],
    };
    const r = getProjecaoSaldo(state, "tudo", 3, HOJE);
    expect(r.meses[0].saidas).toBe(200);
    expect(r.meses[0].saldoFim).toBe(800);
    expect(r.meses[1].saldoFim).toBe(800); // mês seguinte sem ocorrência
  });

  it("ignora fixa já paga (não conta de novo)", () => {
    const state = {
      contas: [{ nome: "A", saldo: 1000 }],
      fixaOcorrencias: [
        { id: "o1", fixaId: "f1", mes: "2026-05", dataVencimento: "2026-05-20", status: "paga", valor: 200 },
      ],
      fixas: [{ id: "f1", descricao: "Aluguel" }],
    };
    const r = getProjecaoSaldo(state, "tudo", 3, HOJE);
    expect(r.meses[0].saidas).toBe(0);
    expect(r.meses[0].saldoFim).toBe(1000);
  });

  it("soma recebível previsto (devedor não recebido) como entrada", () => {
    const state = {
      contas: [{ nome: "A", saldo: 0 }],
      devedores: [{ id: "d1", nome: "João", vencimento: "2026-06-10", valor: 300 }],
    };
    const r = getProjecaoSaldo(state, "tudo", 3, HOJE);
    // mês 0 = maio (sem nada), mês 1 = junho (+300)
    expect(r.meses[0].entradas).toBe(0);
    expect(r.meses[1].entradas).toBe(300);
    expect(r.meses[1].saldoFim).toBe(300);
  });

  it("ignora conta marcada 'fora do patrimônio' no saldo inicial", () => {
    const state = {
      contas: [
        { nome: "A", saldo: 1000 },
        { nome: "Reserva de terceiro", saldo: 500, foraPatrimonio: true },
      ],
    };
    const r = getProjecaoSaldo(state, "tudo", 3, HOJE);
    expect(r.saldoInicial).toBe(1000);
  });

  it("converte conta em moeda estrangeira pela cotação no saldo inicial", () => {
    const state = {
      contas: [
        { nome: "A", saldo: 1000 },
        { nome: "USD", saldo: 100, moeda: "USD", cotacao: 5 },
      ],
    };
    const r = getProjecaoSaldo(state, "tudo", 3, HOJE);
    expect(r.saldoInicial).toBe(1500);
  });
});
