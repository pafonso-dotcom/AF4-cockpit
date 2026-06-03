import { describe, it, expect } from "vitest";
import { chaveTransacao, marcarDuplicadas } from "../extratoParser.js";

describe("chaveTransacao", () => {
  it("usa valor absoluto (sinal não importa)", () => {
    const a = { data: "2024-01-15", valor: 150.5, tipo: "despesa", descricao: "Mercado XYZ" };
    const b = { data: "2024-01-15", valor: -150.5, tipo: "despesa", descricao: "mercado xyz" };
    expect(chaveTransacao(a)).toBe(chaveTransacao(b));
  });

  it("ignora a descrição (mesma data/valor/tipo → mesma chave)", () => {
    // O mesmo lançamento pode ter descrições bem diferentes em fontes distintas.
    const a = { data: "2024-02-01", valor: 10, tipo: "despesa", descricao: "PIX João" };
    const b = { data: "2024-02-01", valor: 10, tipo: "despesa", descricao: "TRANSF ENVIADA 0001" };
    expect(chaveTransacao(a)).toBe(chaveTransacao(b));
  });

  it("difere quando data, valor ou tipo mudam", () => {
    const base = { data: "2024-01-15", valor: 100, tipo: "despesa", descricao: "X" };
    expect(chaveTransacao(base)).not.toBe(chaveTransacao({ ...base, valor: 101 }));
    expect(chaveTransacao(base)).not.toBe(chaveTransacao({ ...base, data: "2024-01-16" }));
    expect(chaveTransacao(base)).not.toBe(chaveTransacao({ ...base, tipo: "receita" }));
  });

  it("lida com entrada nula/indefinida sem quebrar", () => {
    expect(typeof chaveTransacao(null)).toBe("string");
    expect(typeof chaveTransacao({})).toBe("string");
  });
});

describe("marcarDuplicadas", () => {
  it("marca como duplicada o que já existe nos lançamentos", () => {
    const existentes = [
      { data: "2024-01-15", valor: 150, tipo: "despesa", descricao: "Mercado XYZ" },
    ];
    const novas = [
      { _id: "1", data: "2024-01-15", valor: 150, tipo: "despesa", descricao: "Mercado XYZ" }, // dup
      { _id: "2", data: "2024-01-16", valor: 50, tipo: "despesa", descricao: "Uber" },         // nova
    ];
    const r = marcarDuplicadas(novas, existentes);
    expect(r[0]._duplicada).toBe(true);
    expect(r[1]._duplicada).toBe(false);
  });

  it("marca repetições dentro do próprio lote (a partir da 2ª)", () => {
    const novas = [
      { _id: "1", data: "2024-03-01", valor: 20, tipo: "despesa", descricao: "Café" },
      { _id: "2", data: "2024-03-01", valor: 20, tipo: "despesa", descricao: "Café" },
    ];
    const r = marcarDuplicadas(novas, []);
    expect(r[0]._duplicada).toBe(false);
    expect(r[1]._duplicada).toBe(true);
  });

  it("não muta as transações originais e preserva campos", () => {
    const novas = [{ _id: "1", data: "2024-01-01", valor: 10, tipo: "despesa", descricao: "X", categoria: "Outros" }];
    const r = marcarDuplicadas(novas, []);
    expect(novas[0]._duplicada).toBeUndefined();
    expect(r[0].categoria).toBe("Outros");
    expect(r[0]._duplicada).toBe(false);
  });

  it("aceita listas vazias/nulas", () => {
    expect(marcarDuplicadas([], [])).toEqual([]);
    expect(marcarDuplicadas(null, null)).toEqual([]);
  });
});
