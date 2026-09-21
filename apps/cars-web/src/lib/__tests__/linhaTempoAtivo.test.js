import { describe, it, expect } from "vitest";
import { linhaTempoAtivo } from "../movimentacoesInvest.js";

const transacoes = [
  { id: "t1", tipo: "despesa", investOp: "compra", ticker: "PETR4", qtd: 100, data: "2026-01-10", valor: 3000, descricao: "Aporte PETR4 (100 × R$ 30,00)" },
  { id: "t2", tipo: "receita", investOp: "venda", ticker: "PETR4", qtd: 40, data: "2026-05-02", valor: 1400, resultado: 200, descricao: "Venda PETR4 (40 × R$ 35,00)" },
  { id: "t3", tipo: "receita", categoria: "Proventos", descricao: "PETR4 · Dividendo", conta: "Nubank", data: "2026-06-15", valor: 80 },
  { id: "t4", tipo: "despesa", investOp: "compra", ticker: "VALE3", qtd: 10, data: "2026-02-01", valor: 600, descricao: "Aporte VALE3" },
  { id: "t5", tipo: "receita", categoria: "Salário", descricao: "Salário", data: "2026-06-01", valor: 5000 },
];
const historicoCarteira = [
  { id: "h1", tipo: "recebimento", ticker: "PETR4", data: "2026-07-14", valor: 95, descricao: "PETR4 · JCP de 14/07" },
  { id: "h2", tipo: "reinvestimento", ticker: "PETR4", data: "2026-07-15", valor: -95, descricao: "Reinvestido em PETR4 · 2,5 cotas" },
  { id: "h3", tipo: "recebimento", ticker: "HGLG11", data: "2026-07-14", valor: 110, descricao: "HGLG11 · Rendimento" },
];

describe("linhaTempoAtivo", () => {
  it("junta compras, vendas e proventos SÓ do ticker, em ordem cronológica", () => {
    const ev = linhaTempoAtivo("PETR4", { transacoes, historicoCarteira });
    expect(ev.map(e => e.tipo)).toEqual(["compra", "venda", "provento", "provento", "reinvestimento"]);
    expect(ev[0]).toMatchObject({ valor: 3000, qtd: 100, preco: 30 });
    expect(ev[1].resultado).toBe(200);
    expect(ev[2].detalhe).toContain("em conta");
    expect(ev[3].detalhe).toContain("carteira de proventos");
    expect(ev[4].valor).toBe(95); // reinvestimento em valor absoluto
  });

  it("não vaza operações de outros tickers nem receitas comuns", () => {
    const ev = linhaTempoAtivo("VALE3", { transacoes, historicoCarteira });
    expect(ev).toHaveLength(1);
    expect(ev[0].tipo).toBe("compra");
  });

  it("ticker vazio → lista vazia", () => {
    expect(linhaTempoAtivo("", { transacoes, historicoCarteira })).toEqual([]);
  });
});
