import { describe, it, expect } from "vitest";
import { montarDRE } from "../dre.js";

const MES = "2026-09";
const CONTA = { id: "c1", nome: "ITAU", escopo: "pessoal" };

describe("montarDRE — cascata do mês", () => {
  it("separa fixas, variáveis e cartão, e fecha a conta (sobra + proventos = resultado)", () => {
    const state = {
      contas: [CONTA],
      fixas: [{ id: "f1", descricao: "Aluguel", valor: 2000, escopo: "pessoal" }],
      fixaOcorrencias: [{ id: "o1", fixaId: "f1", mes: MES, data: "2026-09-05", valor: 2000, paga: true }],
      transacoes: [
        { id: "t1", tipo: "receita", descricao: "Salário", valor: 10000, conta: "ITAU", data: "2026-09-01", compensado: true },
        { id: "t2", tipo: "despesa", descricao: "Mercado", valor: 800, conta: "ITAU", data: "2026-09-10", compensado: true },
        { id: "t3", tipo: "despesa", descricao: "iFood", valor: 200, data: "2026-09-11", cartaoId: "card1", compensado: true },
      ],
      cartoes: [{ id: "card1", nome: "Visa" }],
    };
    const dre = montarDRE(MES, state, "tudo");
    expect(dre.receitas).toBe(10000);
    expect(dre.fixas).toBe(2000);
    expect(dre.variaveis).toBe(800);
    expect(dre.cartoes).toBe(200);
    expect(dre.sobraOperacional).toBe(10000 - 2000 - 800 - 200);
    expect(dre.resultado).toBe(dre.sobraOperacional); // sem proventos
    expect(dre.detalhe.variaveis[0]).toEqual({ descricao: "Mercado", valor: 800 });
  });

  it("proventos saem das receitas e ganham linha própria (tx + carteirinha)", () => {
    const state = {
      contas: [CONTA],
      transacoes: [
        { id: "t1", tipo: "receita", descricao: "Salário", valor: 5000, conta: "ITAU", data: "2026-09-01", compensado: true },
        { id: "p1", tipo: "receita", descricao: "Dividendos ITSA4", valor: 120, conta: "ITAU", data: "2026-09-15", compensado: true },
      ],
    };
    const carteiraProventos = { historico: [
      { id: "h1", tipo: "recebimento", data: "2026-09-20", valor: 30, ticker: "MXRF11" },
      { id: "h2", tipo: "recebimento", data: "2026-08-20", valor: 99 }, // outro mês: fora
      { id: "h3", tipo: "reinvestimento", data: "2026-09-21", valor: 50 }, // não é recebimento
    ] };
    const dre = montarDRE(MES, state, "tudo", { carteiraProventos });
    expect(dre.receitas).toBe(5000);
    expect(dre.proventos).toBe(150);
    expect(dre.resultado).toBe(5000 + 150);
  });

  it("respeita o escopo (negócio não entra no pessoal)", () => {
    const state = {
      contas: [CONTA, { id: "c2", nome: "LOJA", escopo: "negocio" }],
      transacoes: [
        { id: "t1", tipo: "receita", valor: 1000, conta: "ITAU", data: "2026-09-01", compensado: true, descricao: "PF" },
        { id: "t2", tipo: "receita", valor: 9000, conta: "LOJA", data: "2026-09-01", compensado: true, descricao: "PJ" },
      ],
    };
    expect(montarDRE(MES, state, "pessoal").receitas).toBe(1000);
    expect(montarDRE(MES, state, "negocio").receitas).toBe(9000);
    expect(montarDRE(MES, state, "tudo").receitas).toBe(10000);
  });
});
