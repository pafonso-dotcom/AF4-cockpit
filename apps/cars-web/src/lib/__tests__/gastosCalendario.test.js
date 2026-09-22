import { describe, it, expect } from "vitest";
import { mapaGastosMes, intensidadeGasto, corHeat, CORES_HEAT, insightFimDeSemana } from "../gastosCalendario.js";

const categorias = [
  { id: "c1", nome: "Alimentação", tipo: "despesa" },
  { id: "c2", nome: "Mercado", tipo: "despesa", parentId: "c1" }, // filha
  { id: "c3", nome: "Transporte", tipo: "despesa" },
];
const transacoes = [
  { id: "t1", tipo: "despesa", data: "2026-09-05", valor: 100, categoria: "Alimentação" },
  { id: "t2", tipo: "despesa", data: "2026-09-05", valor: 50, categoria: "Transporte" },
  { id: "t3", tipo: "despesa", data: "2026-09-20", valor: 400, categoria: "Mercado" },
  { id: "t4", tipo: "saida", data: "2026-09-20", valor: 10, categoria: "Transporte" }, // legado conta
  { id: "t5", tipo: "receita", data: "2026-09-20", valor: 999, categoria: "Salário" }, // fora
  { id: "t6", tipo: "despesa", data: "2026-09-12", valor: 80, categoria: "Alimentação", transferenciaId: "x" }, // transferência: fora
  { id: "t7", tipo: "despesa", data: "2026-08-30", valor: 70, categoria: "Mercado" }, // outro mês
  { id: "t8", tipo: "despesa", data: "2026-09-10", valor: 900, categoria: "Cartão", origem: "fatura-pagamento" }, // baixa de fatura: fora
  { id: "t9", tipo: "despesa", data: "2026-09-11", valor: 800, categoria: "Cartão", descricao: "Pagamento fatura XP" }, // idem, pela descrição
];

describe("mapaGastosMes", () => {
  it("soma despesas por dia, ignorando receitas, transferências e outros meses", () => {
    const m = mapaGastosMes({ transacoes, categorias, ym: "2026-09" });
    expect(m.total).toBe(560);
    expect(m.porDia[5].total).toBe(150);
    expect(m.porDia[20].total).toBe(410);
    expect(m.porDia[12]).toBeUndefined();
    expect(m.porDia[10]).toBeUndefined(); // pagamento de fatura não vira pico falso
    expect(m.porDia[11]).toBeUndefined();
    expect(m.max).toBe(410);
    expect(m.diaMax).toBe(20);
    expect(m.porDia[20].top[0]).toEqual({ nome: "Mercado", valor: 400 });
  });

  it("filtro por categoria-raiz inclui as filhas", () => {
    const m = mapaGastosMes({ transacoes, categorias, ym: "2026-09", categoriaFiltro: "Alimentação" });
    expect(m.total).toBe(500); // 100 (Alimentação) + 400 (Mercado, filha)
    expect(m.porDia[5].total).toBe(100);
    expect(m.porDia[20].total).toBe(400);
  });

  it("filtro por categoria sem filhas pega só ela", () => {
    const m = mapaGastosMes({ transacoes, categorias, ym: "2026-09", categoriaFiltro: "Transporte" });
    expect(m.total).toBe(60);
  });
});

describe("intensidadeGasto", () => {
  it("0 sem gasto/max; 1 no pico; escala em raiz quadrada", () => {
    expect(intensidadeGasto(0, 100)).toBe(0);
    expect(intensidadeGasto(100, 0)).toBe(0);
    expect(intensidadeGasto(100, 100)).toBe(1);
    expect(intensidadeGasto(25, 100)).toBeCloseTo(0.5);
  });
});

describe("corHeat", () => {
  it("sem gasto → null; pico → cor mais quente; degraus no meio", () => {
    expect(corHeat(0, 100)).toBeNull();
    expect(corHeat(100, 100)).toBe(CORES_HEAT[3]);
    expect(corHeat(5, 100)).toBe(CORES_HEAT[0]);   // i≈0.22
    expect(corHeat(20, 100)).toBe(CORES_HEAT[1]);  // i≈0.45
    expect(corHeat(50, 100)).toBe(CORES_HEAT[2]);  // i≈0.71
  });
});

describe("insightFimDeSemana", () => {
  it("detecta fim de semana mais caro", () => {
    // set/2026: dia 5 = sábado, dias 7-8 = seg/ter
    const porDia = { 5: { total: 500 }, 7: { total: 100 }, 8: { total: 100 } };
    const ins = insightFimDeSemana(porDia, "2026-09");
    expect(ins).toEqual({ tipo: "fds", ratio: 5 });
  });
  it("equilibrado → null; só um lado → null", () => {
    expect(insightFimDeSemana({ 5: { total: 100 }, 7: { total: 100 } }, "2026-09")).toBeNull();
    expect(insightFimDeSemana({ 7: { total: 100 }, 8: { total: 50 } }, "2026-09")).toBeNull();
  });
});
