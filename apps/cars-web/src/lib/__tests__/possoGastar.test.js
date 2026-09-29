import { describe, it, expect } from "vitest";
import { calcularPossoGastar } from "../possoGastar.js";

const HOJE = new Date(2026, 8, 21); // 21/09/2026 → faltam 10 dias no mês
const CONTA = { id: "c1", nome: "ITAU", saldo: 2000, moeda: "BRL", escopo: "pessoal" };

describe("calcularPossoGastar", () => {
  it("sobra ÷ dias restantes, só com o que está agendado", () => {
    const state = {
      contas: [CONTA],
      dividas: [{ id: "d1", nome: "Boleto", valor: 500, vencimento: "2026-09-25", escopo: "pessoal" }],
      devedores: [{ id: "r1", nome: "Jorge", valor: 300, vencimento: "2026-09-28", escopo: "pessoal" }],
      // variáveis do passado NÃO entram (estimativa desligada de propósito)
      transacoes: [{ id: "t1", tipo: "despesa", descricao: "Mercado", valor: 900, conta: "ITAU", data: "2026-08-10", compensado: true }],
    };
    const r = calcularPossoGastar(state, "tudo", HOJE);
    expect(r.diasRestantes).toBe(10);
    expect(r.sobraMes).toBe(1800); // 2000 − 500 + 300
    expect(r.porDia).toBeCloseTo(180, 5);
    expect(r.semana).toBeCloseTo(1260, 5);
    expect(r.fura).toBe(false);
  });

  it("caixa furando no meio do mês → posso gastar 0 e o dia do buraco", () => {
    const state = {
      contas: [{ ...CONTA, saldo: 100 }],
      dividas: [{ id: "d1", nome: "Parcela", valor: 400, vencimento: "2026-09-23", escopo: "pessoal" }],
      devedores: [{ id: "r1", nome: "Cliente", valor: 800, vencimento: "2026-09-29", escopo: "pessoal" }],
    };
    const r = calcularPossoGastar(state, "tudo", HOJE);
    expect(r.fura).toBe(true);
    expect(r.porDia).toBe(0);
    expect(r.primeiroNegativo).toBe("2026-09-23");
    expect(r.sobraMes).toBe(500); // fecha positivo, mas fura antes
  });

  it("último dia do mês: divide por 1", () => {
    const r = calcularPossoGastar({ contas: [CONTA] }, "tudo", new Date(2026, 8, 30));
    expect(r.diasRestantes).toBe(1);
    expect(r.porDia).toBe(2000);
  });
});
