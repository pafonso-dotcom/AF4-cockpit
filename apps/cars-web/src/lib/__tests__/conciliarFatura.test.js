import { describe, it, expect } from "vitest";
import { matchTransacaoExistente } from "../importarFatura.js";

// item = linha "vista" da fatura (vinda da IA): { descricao, valor, data_compra "DD/MM/YYYY" }
const item = (descricao, valor, data_compra) => ({ tipo: "vista", descricao, valor, data_compra });
// tx = transação já lançada no sistema
const tx = (o) => ({ id: o.id || "t", tipo: "despesa", compensado: true, ...o });

describe("matchTransacaoExistente", () => {
  it("casa por valor igual + data próxima + descrição parecida", () => {
    const lista = [tx({ id: "a", descricao: "Mercado Pão de Açúcar", valor: 150.0, data: "2026-05-10" })];
    const m = matchTransacaoExistente(item("PAO DE ACUCAR", 150.0, "10/05/2026"), lista);
    expect(m?.id).toBe("a");
  });

  it("não casa quando o valor difere acima da tolerância", () => {
    const lista = [tx({ id: "a", descricao: "Mercado", valor: 150.0, data: "2026-05-10" })];
    const m = matchTransacaoExistente(item("Mercado", 180.0, "10/05/2026"), lista);
    expect(m).toBeNull();
  });

  it("aceita tolerância de 1 centavo no valor", () => {
    const lista = [tx({ id: "a", descricao: "Uber", valor: 25.0, data: "2026-05-10" })];
    const m = matchTransacaoExistente(item("UBER *TRIP", 25.01, "10/05/2026"), lista);
    expect(m?.id).toBe("a");
  });

  it("não casa quando a data está fora da janela", () => {
    const lista = [tx({ id: "a", descricao: "Posto", valor: 200.0, data: "2026-05-01" })];
    const m = matchTransacaoExistente(item("Posto", 200.0, "20/05/2026"), lista);
    expect(m).toBeNull();
  });

  it("ignora transações que já vieram de fatura (origem fatura-*)", () => {
    const lista = [tx({ id: "a", descricao: "Mercado", valor: 150.0, data: "2026-05-10", origem: "fatura-itau" })];
    const m = matchTransacaoExistente(item("Mercado", 150.0, "10/05/2026"), lista);
    expect(m).toBeNull();
  });

  it("ignora despesas amarradas a OUTRO cartão", () => {
    const lista = [tx({ id: "a", descricao: "Mercado", valor: 150.0, data: "2026-05-10", cartaoId: "c2" })];
    const m = matchTransacaoExistente(item("Mercado", 150.0, "10/05/2026"), lista, { cartaoId: "c1" });
    expect(m).toBeNull();
  });

  it("casa quando o cartão bate", () => {
    const lista = [tx({ id: "a", descricao: "Mercado", valor: 150.0, data: "2026-05-10", cartaoId: "c1" })];
    const m = matchTransacaoExistente(item("Mercado", 150.0, "10/05/2026"), lista, { cartaoId: "c1" });
    expect(m?.id).toBe("a");
  });

  it("não reaproveita uma transação já usada (usados)", () => {
    const lista = [tx({ id: "a", descricao: "Mercado", valor: 150.0, data: "2026-05-10" })];
    const m = matchTransacaoExistente(item("Mercado", 150.0, "10/05/2026"), lista, { usados: new Set(["a"]) });
    expect(m).toBeNull();
  });

  it("entre dois candidatos do mesmo valor, escolhe o de data mais próxima", () => {
    const lista = [
      tx({ id: "longe", descricao: "Loja", valor: 99.9, data: "2026-05-13" }),
      tx({ id: "perto", descricao: "Loja", valor: 99.9, data: "2026-05-10" }),
    ];
    const m = matchTransacaoExistente(item("Loja", 99.9, "10/05/2026"), lista);
    expect(m?.id).toBe("perto");
  });

  it("ignora receitas (só concilia despesas)", () => {
    const lista = [tx({ id: "a", tipo: "receita", descricao: "Mercado", valor: 150.0, data: "2026-05-10" })];
    const m = matchTransacaoExistente(item("Mercado", 150.0, "10/05/2026"), lista);
    expect(m).toBeNull();
  });
});
