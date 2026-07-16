import { describe, it, expect } from "vitest";
import { movimentacoesInvestMes, ehProventoTx } from "../movimentacoesInvest.js";

describe("movimentacoesInvestMes", () => {
  it("classifica compras, vendas e proventos do mês (via campos investOp)", () => {
    const txs = [
      { id: "c1", tipo: "despesa", investOp: "compra", ticker: "PETR4", qtd: 100, preco: 30, valor: 3000, data: "2026-07-05" },
      { id: "v1", tipo: "receita", investOp: "venda", ticker: "VALE3", qtd: 50, preco: 60, valor: 3000, resultado: 400, data: "2026-07-10" },
      { id: "p1", tipo: "receita", ticker: "MXRF11", descricao: "Dividendo MXRF11", valor: 120, data: "2026-07-12" },
    ];
    const r = movimentacoesInvestMes(txs, "2026-07");
    expect(r.compras).toHaveLength(1);
    expect(r.vendas).toHaveLength(1);
    expect(r.proventos).toHaveLength(1);
    expect(r.totalComprado).toBe(3000);
    expect(r.totalVendido).toBe(3000);
    expect(r.totalProventos).toBe(120);
    expect(r.resultadoVendas).toBe(400);
    expect(r.proventos[0].tipo).toBe("Dividendo");
  });

  it("lê compras/vendas antigas pela descrição (sem investOp)", () => {
    const txs = [
      { id: "c1", tipo: "despesa", descricao: "Aporte PETR4 (10 × R$ 30,00)", valor: 300, data: "2026-07-05" },
      { id: "v1", tipo: "receita", descricao: "Venda VALE3 (5 × R$ 60,00)", obs: "Resultado: R$ 50,00 (lucro)", valor: 300, data: "2026-07-08" },
    ];
    const r = movimentacoesInvestMes(txs, "2026-07");
    expect(r.compras[0].ticker).toBe("PETR4");
    expect(r.compras[0].qtd).toBe(10);
    expect(r.compras[0].preco).toBe(30);
    expect(r.vendas[0].ticker).toBe("VALE3");
    expect(r.vendas[0].preco).toBe(60);
  });

  it("extrai resultado (lucro/prejuízo) do obs", () => {
    const txs = [
      { id: "v1", tipo: "receita", descricao: "Venda ABEV3 (10 × R$ 12,00)", obs: "Resultado: R$ 80,00 (prejuízo)", valor: 120, data: "2026-07-03" },
    ];
    const r = movimentacoesInvestMes(txs, "2026-07");
    expect(r.vendas[0].resultado).toBe(-80);
    expect(r.resultadoVendas).toBe(-80);
  });

  it("filtra pelo mês pedido (ignora outros meses)", () => {
    const txs = [
      { id: "p1", tipo: "receita", descricao: "Dividendo MXRF11", valor: 100, data: "2026-06-30" },
      { id: "p2", tipo: "receita", descricao: "Dividendo MXRF11", valor: 200, data: "2026-07-01" },
    ];
    const r = movimentacoesInvestMes(txs, "2026-07");
    expect(r.proventos).toHaveLength(1);
    expect(r.totalProventos).toBe(200);
  });

  it("ehProventoTx exclui saldo/transferência/aporte/venda", () => {
    expect(ehProventoTx({ tipo: "receita", descricao: "Dividendo ITSA4" })).toBe(true);
    expect(ehProventoTx({ tipo: "receita", descricao: "Venda ITSA4 (10 × R$ 9,00)" })).toBe(false);
    expect(ehProventoTx({ tipo: "receita", descricao: "Transferência da Carteira de Proventos" })).toBe(false);
    expect(ehProventoTx({ tipo: "despesa", descricao: "Dividendo ITSA4" })).toBe(false);
  });
});
