import { describe, it, expect } from "vitest";
import { entradasDoMes, entradasDeRecebiveis } from "../entradas.js";

const tx = [
  { tipo: "receita", valor: 40000, data: "2026-07-05", categoria: "Salário" },
  { tipo: "receita", valor: 2000, data: "2026-07-10", categoria: "Proventos" },
  { tipo: "receita", valor: 5000, data: "2026-07-12", categoria: "Venda" },
  { tipo: "receita", valor: 3000, data: "2026-07-15", categoria: "Transferência", transferenciaId: "x1" },
  { tipo: "receita", valor: 1000, data: "2026-07-16", categoria: "Resgate CDB" },
  { tipo: "receita", valor: 8000, data: "2026-07-18", categoria: "Empréstimo", emprestimoRetorno: true },
  { tipo: "receita", valor: 300, data: "2026-07-18", categoria: "Juros recebidos", emprestimoJuros: true },
  { tipo: "despesa", valor: 999, data: "2026-07-20", categoria: "Mercado" },
];

describe("entradasDoMes", () => {
  it("conta só dinheiro novo (salário, proventos, venda, juros)", () => {
    const r = entradasDoMes(tx, "2026-07");
    expect(r.total).toBe(40000 + 2000 + 5000 + 300);
  });

  it("transferência entre contas não conta", () => {
    const r = entradasDoMes(tx, "2026-07");
    expect(r.porCategoria["Transferência"]).toBeUndefined();
    expect(r.foraPorMotivo.transferencia).toBe(3000);
  });

  it("resgate de investimento não conta", () => {
    const r = entradasDoMes(tx, "2026-07");
    expect(r.porCategoria["Resgate CDB"]).toBeUndefined();
    expect(r.foraPorMotivo.resgate).toBe(1000);
  });

  it("retorno de empréstimo (principal) não conta, mas juros conta", () => {
    const r = entradasDoMes(tx, "2026-07");
    expect(r.porCategoria["Empréstimo"]).toBeUndefined();
    expect(r.foraPorMotivo.emprestimo).toBe(8000);
    expect(r.porCategoria["Juros recebidos"]).toBe(300);
  });

  it("ajuste manual: incluir força uma transferência a contar", () => {
    const r = entradasDoMes(tx, "2026-07", { incluir: ["Transferência"] });
    expect(r.porCategoria["Transferência"]).toBe(3000);
  });

  it("ajuste manual: excluir tira uma entrada real", () => {
    const r = entradasDoMes(tx, "2026-07", { excluir: ["Venda"] });
    expect(r.porCategoria["Venda"]).toBeUndefined();
    expect(r.total).toBe(40000 + 2000 + 300);
  });

  it("foraTotal soma tudo que não é entrada", () => {
    const r = entradasDoMes(tx, "2026-07");
    expect(r.foraTotal).toBe(3000 + 1000 + 8000);
  });
});

describe("entradasDeRecebiveis (base getGanhosDoMes)", () => {
  const ganhos = [
    { categoria: "Salário", valor: 40000, status: "paga" },
    { categoria: "Cheques", valor: 22200, status: "pendente" },
    { categoria: "Vendas", valor: 5000, status: "paga" },
    { categoria: "Juros de empréstimo", valor: 486, status: "paga" },
    { categoria: "Empréstimo (principal)", valor: 8000, status: "pendente" },
    { categoria: "Transferência", valor: 3000, status: "paga" },
  ];

  it("separa recebido de a receber e soma tudo", () => {
    const r = entradasDeRecebiveis(ganhos);
    expect(r.recebido).toBe(40000 + 5000 + 486);
    expect(r.aReceber).toBe(22200);            // cheque pendente
    expect(r.total).toBe(40000 + 5000 + 486 + 22200);
  });

  it("principal de empréstimo e transferência ficam fora; juros conta", () => {
    const r = entradasDeRecebiveis(ganhos);
    expect(r.porCategoria["Empréstimo (principal)"]).toBeUndefined();
    expect(r.porCategoria["Transferência"]).toBeUndefined();
    expect(r.porCategoria["Juros de empréstimo"]).toBe(486);
    expect(r.foraPorMotivo.emprestimo).toBe(8000);
    expect(r.foraPorMotivo.transferencia).toBe(3000);
  });

  it("ajuste manual força uma categoria a contar", () => {
    const r = entradasDeRecebiveis(ganhos, { incluir: ["Empréstimo (principal)"] });
    expect(r.porCategoria["Empréstimo (principal)"]).toBe(8000);
  });
});
