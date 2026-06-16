import { describe, it, expect } from "vitest";
import { getGanhosDoMes, getAnualPorMes } from "../agregador.js";

// Simula o caso real: uma receita pessoal (com conta no escopo) + receitas de
// "carros" lançadas SEM conta (órfãs). A tela de Transações, filtrada por
// escopo, esconde as órfãs; antes da correção a Controle Anual mostrava todas.
const contas = [{ id: "c1", nome: "Nubank", escopo: "pessoal" }];
const transacoes = [
  { id: "t1", tipo: "receita", descricao: "Salário", conta: "Nubank", data: "2026-06-05", valor: 5000, compensado: true },
  // Carros lançados sem conta (órfãos) — não aparecem na lista de Transações no escopo Pessoal.
  { id: "t2", tipo: "receita", descricao: "Ora Gt - 2024",       conta: "", data: "2026-06-06", valor: 150058.20, compensado: true },
  { id: "t3", tipo: "receita", descricao: "Haval h6 prêmio",     conta: "", data: "2026-06-06", valor: 226579.63, compensado: true },
];
const state = { transacoes, contas, fixas: [], fixaOcorrencias: [], parcelamentos: [], dividas: [], devedores: [] };

describe("Controle Anual respeita o escopo", () => {
  it("escopo 'pessoal' exclui receitas órfãs (carros sem conta)", () => {
    const ganhos = getGanhosDoMes("2026-06", state, "pessoal");
    const descricoes = ganhos.map(g => g.descricao);
    expect(descricoes).toContain("Salário");
    expect(descricoes).not.toContain("Ora Gt - 2024");
    expect(descricoes).not.toContain("Haval h6 prêmio");
  });

  it("escopo 'tudo' mostra tudo — é onde dá pra achar e excluir os órfãos", () => {
    const ganhos = getGanhosDoMes("2026-06", state, "tudo");
    const descricoes = ganhos.map(g => g.descricao);
    expect(descricoes).toContain("Salário");
    expect(descricoes).toContain("Ora Gt - 2024");
    expect(descricoes).toContain("Haval h6 prêmio");
  });

  it("getAnualPorMes soma só o escopo ativo no mês (junho)", () => {
    const junhoPessoal = getAnualPorMes(2026, state, "pessoal")[5];
    const junhoTudo = getAnualPorMes(2026, state, "tudo")[5];
    expect(junhoPessoal.ganhos).toBeCloseTo(5000, 2);
    expect(junhoTudo.ganhos).toBeCloseTo(5000 + 150058.20 + 226579.63, 2);
  });
});
