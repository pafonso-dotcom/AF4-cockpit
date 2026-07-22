import { describe, it, expect } from "vitest";
import { resumoEmprestimos } from "../emprestimos.js";

const devedores = [
  {
    id: "e1", nome: "Jorge", emprestimo: true, principal: 10000,
    jurosMensal: 200, meses: 12, dataEmprestimo: "2026-01-10",
    recebido: false,
    recebimentos: [
      { tipo: "juros", valor: 200, data: "2026-02-10", mesJuros: "2026-02" },
      { tipo: "juros", valor: 200, data: "2026-03-10", mesJuros: "2026-03" },
    ],
  },
  {
    id: "e2", nome: "Maria", emprestimo: true, principal: 5000,
    jurosMensal: 0, juros: 0, dataEmprestimo: "2026-05-01",
    recebido: true, // principal devolvido
    recebimentos: [{ tipo: "principal", valor: 5000, data: "2026-06-01" }],
  },
  // não-empréstimo (devedor comum) — ignorado
  { id: "d1", nome: "Fulano", valor: 300 },
];

describe("resumoEmprestimos", () => {
  const r = resumoEmprestimos(devedores);

  it("pega só os empréstimos", () => {
    expect(r.emprestimos).toHaveLength(2);
    expect(r.emprestimos.some(e => e.nome === "Fulano")).toBe(false);
  });

  it("soma o total emprestado (principal)", () => {
    expect(r.totalEmprestado).toBe(15000);
  });

  it("soma juros recebidos e juros a receber", () => {
    const jorge = r.emprestimos.find(e => e.id === "e1");
    expect(jorge.jurosPrevisto).toBe(2400); // 200 × 12
    expect(jorge.jurosRecebido).toBe(400);  // 2 × 200
    expect(jorge.jurosAReceber).toBe(2000);
    expect(r.totalJurosRecebido).toBe(400);
    expect(r.totalJurosAReceber).toBe(2000);
  });

  it("traz os lançamentos de juros com datas, ordenados", () => {
    const jorge = r.emprestimos.find(e => e.id === "e1");
    expect(jorge.jurosLancamentos.map(x => x.data)).toEqual(["2026-02-10", "2026-03-10"]);
  });

  it("principal em aberto: quitado zera, aberto conta o que falta", () => {
    const jorge = r.emprestimos.find(e => e.id === "e1");
    const maria = r.emprestimos.find(e => e.id === "e2");
    expect(jorge.principalAberto).toBe(10000);
    expect(maria.principalAberto).toBe(0); // recebido=true
    expect(r.totalPrincipalAberto).toBe(10000);
  });

  it("ordena abertos antes dos quitados", () => {
    expect(r.emprestimos[0].quitado).toBe(false);
    expect(r.emprestimos[r.emprestimos.length - 1].quitado).toBe(true);
  });
});
