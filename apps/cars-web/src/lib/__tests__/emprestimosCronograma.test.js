import { describe, it, expect } from "vitest";
import { resumoEmprestimos } from "../emprestimos.js";

const HOJE = new Date(2026, 8, 18); // 18/09/2026

const emprestimo = (over = {}) => ({
  id: "e1", nome: "Carla", emprestimo: true,
  principal: 10000, jurosMensal: 300, meses: 6,
  dataEmprestimo: "2026-06-10",
  recebimentos: [],
  ...over,
});

describe("cronograma de juros dos empréstimos", () => {
  it("gera as parcelas com vencimento mensal e marca atrasadas", () => {
    // Parcelas vencem 10/07, 10/08, 10/09 (passadas) e 10/10, 10/11, 10/12.
    // Recebeu só a 1ª → 2ª e 3ª atrasadas, resto previsto.
    const r = resumoEmprestimos([emprestimo({
      recebimentos: [{ tipo: "juros", valor: 300, data: "2026-07-10" }],
    })], HOJE);
    const e = r.emprestimos[0];
    expect(e.cronograma.length).toBe(6);
    expect(e.cronograma[0].status).toBe("recebida");
    expect(e.cronograma[0].venc).toBe("2026-07-10");
    expect(e.cronograma[1].status).toBe("atrasada");
    expect(e.cronograma[2].status).toBe("atrasada");
    expect(e.cronograma[3].status).toBe("prevista");
    expect(e.atrasadas).toBe(2);
    expect(e.jurosAtrasado).toBe(600);
    expect(r.parcelasAtrasadas).toBe(2);
    expect(r.totalJurosAtrasado).toBe(600);
  });

  it("empréstimo em dia não acusa atraso", () => {
    const r = resumoEmprestimos([emprestimo({
      recebimentos: [
        { tipo: "juros", valor: 300, data: "2026-07-10" },
        { tipo: "juros", valor: 300, data: "2026-08-10" },
        { tipo: "juros", valor: 300, data: "2026-09-10" },
      ],
    })], HOJE);
    expect(r.emprestimos[0].atrasadas).toBe(0);
    expect(r.emprestimos[0].cronograma[3].status).toBe("prevista");
  });

  it("quitado não gera atraso e retornadoPct chega a 100", () => {
    const r = resumoEmprestimos([emprestimo({
      recebido: true,
      recebimentos: [
        ...Array.from({ length: 6 }, (_, i) => ({ tipo: "juros", valor: 300, data: `2026-0${Math.min(7 + i, 9)}-10` })),
        { tipo: "principal", valor: 10000, data: "2026-12-10" },
      ],
    })], HOJE);
    const e = r.emprestimos[0];
    expect(e.atrasadas).toBe(0);
    expect(e.retornadoPct).toBeCloseTo(100);
  });

  it("retornadoPct parcial = (juros + principal recebidos) / (principal + juros previstos)", () => {
    const r = resumoEmprestimos([emprestimo({
      recebimentos: [{ tipo: "juros", valor: 300, data: "2026-07-10" }],
    })], HOJE);
    // (300) / (10000 + 1800) ≈ 2,54%
    expect(r.emprestimos[0].retornadoPct).toBeCloseTo((300 / 11800) * 100, 1);
  });

  it("dia 29-31 vira 28 no vencimento (não pula fevereiro)", () => {
    const r = resumoEmprestimos([emprestimo({ dataEmprestimo: "2026-01-31", meses: 2, recebimentos: [] })], HOJE);
    expect(r.emprestimos[0].cronograma[0].venc).toBe("2026-02-28");
  });
});
