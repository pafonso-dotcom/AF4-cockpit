import { describe, it, expect } from "vitest";
import { revisarGanhos } from "../revisorGanhos.js";

// Helper pra montar transação de receita rapidamente.
const r = (data, valor, descricao = "X", categoria = "Salário") => ({
  tipo: "receita", data, valor, descricao, categoria,
});
const d = (data, valor) => ({ tipo: "despesa", data, valor, descricao: "gasto", categoria: "Casa" });

describe("revisarGanhos", () => {
  it("soma só as receitas do mês e ignora despesas", () => {
    const tx = [
      r("2026-06-05", 3000), r("2026-06-20", 500),
      d("2026-06-10", 999), // despesa ignorada
      r("2026-05-05", 1000), // mês anterior
    ];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.total).toBe(3500);
  });

  it("compara com o mês anterior e calcula variação %", () => {
    const tx = [r("2026-06-05", 3000), r("2026-05-05", 2000)];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.totalAnterior).toBe(2000);
    expect(out.variacaoPct).toBeCloseTo(50, 5); // 2000 -> 3000 = +50%
  });

  it("variação null quando não há receita no mês anterior", () => {
    const tx = [r("2026-06-05", 3000)];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.totalAnterior).toBe(0);
    expect(out.variacaoPct).toBeNull();
  });

  it("compõe a renda por fonte (categoria) ordenada por valor desc, com %", () => {
    const tx = [
      r("2026-06-01", 4000, "salario", "Salário"),
      r("2026-06-02", 1000, "venda", "Vendas"),
    ];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.fontes[0]).toMatchObject({ fonte: "Salário", valor: 4000 });
    expect(out.fontes[0].pct).toBeCloseTo(80, 5);
    expect(out.fontes[1]).toMatchObject({ fonte: "Vendas", valor: 1000 });
  });

  it("sinaliza concentração quando uma fonte >= 60% da renda", () => {
    const tx = [r("2026-06-01", 9000, "s", "Salário"), r("2026-06-02", 1000, "v", "Vendas")];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.concentracao).toMatchObject({ fonte: "Salário" });
    expect(out.concentracao.pct).toBeCloseTo(90, 5);
  });

  it("não sinaliza concentração quando a renda está distribuída", () => {
    const tx = [r("2026-06-01", 5000, "s", "Salário"), r("2026-06-02", 5000, "v", "Vendas")];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.concentracao).toBeNull();
  });

  it("detecta recorrente esperada que NÃO entrou no mês", () => {
    // 'Aluguel recebido' entrou em mar, abr, mai — mas não em jun.
    const tx = [
      r("2026-03-10", 1500, "Aluguel recebido", "Aluguel"),
      r("2026-04-10", 1500, "Aluguel recebido", "Aluguel"),
      r("2026-05-10", 1500, "Aluguel recebido", "Aluguel"),
      r("2026-06-05", 3000, "Salário", "Salário"),
    ];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.faltando.map(f => f.descricao)).toContain("Aluguel recebido");
    const al = out.faltando.find(f => f.descricao === "Aluguel recebido");
    expect(al.valorTipico).toBe(1500);
  });

  it("não marca como faltando o que já entrou no mês", () => {
    const tx = [
      r("2026-04-10", 1500, "Aluguel recebido", "Aluguel"),
      r("2026-05-10", 1500, "Aluguel recebido", "Aluguel"),
      r("2026-06-10", 1500, "Aluguel recebido", "Aluguel"), // entrou em jun
    ];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.faltando.find(f => f.descricao === "Aluguel recebido")).toBeUndefined();
  });

  it("detecta receitas duplicadas no mês (mesma descrição e valor)", () => {
    const tx = [
      r("2026-06-05", 3000, "Salário", "Salário"),
      r("2026-06-05", 3000, "Salário", "Salário"), // duplicada
    ];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.duplicadas.length).toBe(1);
    expect(out.duplicadas[0]).toMatchObject({ descricao: "Salário", valor: 3000, ocorrencias: 2 });
  });

  it("retorna série dos últimos 6 meses incluindo o mês de referência", () => {
    const tx = [r("2026-06-05", 1000), r("2026-04-05", 500)];
    const out = revisarGanhos(tx, "2026-06");
    expect(out.serie.length).toBe(6);
    expect(out.serie[5]).toMatchObject({ mes: "2026-06", total: 1000 });
    expect(out.serie[3]).toMatchObject({ mes: "2026-04", total: 500 });
    expect(out.serie[4]).toMatchObject({ mes: "2026-05", total: 0 });
  });

  it("é robusto a entrada vazia/indefinida", () => {
    const out = revisarGanhos([], "2026-06");
    expect(out.total).toBe(0);
    expect(out.fontes).toEqual([]);
    expect(out.faltando).toEqual([]);
    expect(out.duplicadas).toEqual([]);
  });
});
