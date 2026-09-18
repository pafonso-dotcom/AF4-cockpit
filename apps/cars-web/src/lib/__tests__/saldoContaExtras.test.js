import { describe, it, expect } from "vitest";
import { serieSaldoConta, pendentesDaConta, ultimaMovimentacao } from "../saldoConta.js";

const conta = { nome: "Nubank", saldo: 1000 };
const HOJE = new Date(2026, 8, 18); // 18/09/2026 (local)

describe("serieSaldoConta", () => {
  it("anda pra trás a partir do saldo atual usando só compensadas", () => {
    const tx = [
      { conta: "Nubank", tipo: "despesa", valor: 200, data: "2026-09-18", compensado: true }, // hoje
      { conta: "Nubank", tipo: "receita", valor: 500, data: "2026-09-17", compensado: true }, // ontem
      { conta: "Nubank", tipo: "despesa", valor: 999, data: "2026-09-16", compensado: false }, // pendente: fora
    ];
    const s = serieSaldoConta(conta, tx, 5, HOJE);
    expect(s.length).toBe(5);
    expect(s[4]).toBe(1000);        // hoje (fim do dia) = saldo atual
    expect(s[3]).toBe(1200);        // antes da despesa de hoje (1000 + 200)
    expect(s[2]).toBe(700);         // antes da receita de ontem (1200 − 500)
    expect(s[1]).toBe(700);
  });

  it("ignora outras contas e datas fora da janela", () => {
    const tx = [
      { conta: "Itaú", tipo: "despesa", valor: 100, data: "2026-09-18", compensado: true },
      { conta: "Nubank", tipo: "despesa", valor: 100, data: "2026-01-01", compensado: true },
    ];
    const s = serieSaldoConta(conta, tx, 3, HOJE);
    expect(s.every(v => v === 1000)).toBe(true);
  });
});

describe("pendentesDaConta", () => {
  it("soma pendentes com sinal e projeta o saldo", () => {
    const tx = [
      { conta: "Nubank", tipo: "despesa", valor: 300, compensado: false },
      { conta: "Nubank", tipo: "receita", valor: 100, compensado: false },
      { conta: "Nubank", tipo: "despesa", valor: 50, compensado: true }, // já no saldo
    ];
    const p = pendentesDaConta(conta, tx);
    expect(p.qtd).toBe(2);
    expect(p.delta).toBe(-200);
    expect(p.saldoApos).toBe(800);
  });
});

describe("ultimaMovimentacao", () => {
  it("acha a mais recente da conta (qualquer status)", () => {
    const tx = [
      { conta: "Nubank", tipo: "despesa", valor: 45, data: "2026-09-10", descricao: "Mercado" },
      { conta: "Nubank", tipo: "receita", valor: 900, data: "2026-09-15", descricao: "Pix", compensado: false },
      { conta: "Itaú", tipo: "despesa", valor: 999, data: "2026-09-17" },
    ];
    const u = ultimaMovimentacao(conta, tx);
    expect(u.data).toBe("2026-09-15");
    expect(u.tipo).toBe("receita");
    expect(u.valor).toBe(900);
  });

  it("null sem transações da conta", () => {
    expect(ultimaMovimentacao(conta, [])).toBeNull();
  });
});
