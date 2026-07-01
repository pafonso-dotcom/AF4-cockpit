import { describe, it, expect } from "vitest";
import { getDespesasDoMes } from "../agregador.js";

const base = { contas: [], fixaOcorrencias: [], dividas: [], parcelamentos: [], transacoes: [], devedores: [], cartoes: [], cheques: [] };

describe("getDespesasDoMes — fixas virtuais (meses/anos sem ocorrência materializada)", () => {
  it("mostra a fixa num mês futuro sem ocorrência gerada (ex.: 2027)", () => {
    const state = { ...base, fixas: [{ id: "f1", descricao: "Aluguel", valor: 2500, diaVencimento: 10, inicioEm: "2025-01", terminoEm: null, categoria: "Moradia" }] };
    const desp = getDespesasDoMes("2027-03", state, "tudo");
    const f = desp.find(d => d.fonte === "fixa");
    expect(f).toBeTruthy();
    expect(f.valor).toBe(2500);
    expect(f.status).toBe("pendente");
  });

  it("NÃO duplica quando já existe ocorrência materializada no mês", () => {
    const state = {
      ...base,
      fixas: [{ id: "f1", descricao: "Aluguel", valor: 2500, diaVencimento: 10, inicioEm: "2025-01", categoria: "Moradia" }],
      fixaOcorrencias: [{ id: "occ-f1-2027-03", fixaId: "f1", mes: "2027-03", dataVencimento: "2027-03-10", valor: 2500, status: "pendente" }],
    };
    const desp = getDespesasDoMes("2027-03", state, "tudo");
    expect(desp.filter(d => d.fonte === "fixa").length).toBe(1);
  });

  it("respeita terminoEm — fixa encerrada não aparece depois", () => {
    const state = { ...base, fixas: [{ id: "f1", descricao: "Curso", valor: 300, diaVencimento: 5, inicioEm: "2025-01", terminoEm: "2026-12", categoria: "Educação" }] };
    expect(getDespesasDoMes("2027-01", state, "tudo").some(d => d.fonte === "fixa")).toBe(false);
    expect(getDespesasDoMes("2026-06", state, "tudo").some(d => d.fonte === "fixa")).toBe(true);
  });

  it("respeita inicioEm — fixa não aparece antes de começar", () => {
    const state = { ...base, fixas: [{ id: "f1", descricao: "Plano", valor: 120, diaVencimento: 1, inicioEm: "2026-09", categoria: "Saúde" }] };
    expect(getDespesasDoMes("2026-06", state, "tudo").some(d => d.fonte === "fixa")).toBe(false);
    expect(getDespesasDoMes("2027-01", state, "tudo").some(d => d.fonte === "fixa")).toBe(true);
  });
});
