import { describe, it, expect } from "vitest";
import { analiseGastosMes, mesAnterior } from "../analiseGastos.js";

// Itens já agregados (como saem de getDespesasDoMes): { categoria, valor }.
const g = (categoria, valor) => ({ categoria, valor });

// Cadastro com hierarquia: CASA (pai) → Água, Energia (filhas); Lazer raiz.
const CADASTRO = [
  { id: "casa", nome: "CASA", tipo: "despesa", parentId: null },
  { id: "agua", nome: "Água", tipo: "despesa", parentId: "casa" },
  { id: "energia", nome: "Energia", tipo: "despesa", parentId: "casa" },
  { id: "lazer", nome: "Lazer", tipo: "despesa", parentId: null },
  { id: "merc", nome: "Mercado", tipo: "despesa", parentId: null },
];

const MES = [
  g("Água", 200), g("Energia", 300), g("Mercado", 800), g("Lazer", 150),
  g("Investimento", 5000),      // movimentação → fora
  g("Transferência", 400),      // fora
];
const ANT = [
  g("Água", 180), g("Energia", 250), g("Mercado", 900),
];

describe("analiseGastosMes (agregado + hierarquia)", () => {
  const r = analiseGastosMes(MES, ANT, { mes: "2026-07", mesAnt: "2026-06", categorias: CADASTRO });

  it("total só de consumo (exclui investimento/transferência)", () => {
    expect(r.total).toBe(1450);        // 200+300+800+150
    expect(r.totalAnterior).toBe(1330); // 180+250+900
  });

  it("agrupa filhas no pai (CASA = Água + Energia)", () => {
    const casa = r.grupos.find((x) => x.nome === "CASA");
    expect(casa.valor).toBe(500);
    expect(casa.filhos.map((f) => f.nome).sort()).toEqual(["Energia", "Água"]);
    expect(casa.solo).toBe(false);
  });

  it("categoria raiz sem filhas vira grupo solo", () => {
    const merc = r.grupos.find((x) => x.nome === "Mercado");
    expect(merc.solo).toBe(true);
    expect(merc.valor).toBe(800);
  });

  it("variação do grupo vs mês anterior", () => {
    const casa = r.grupos.find((x) => x.nome === "CASA");
    expect(casa.variacao).toBeCloseTo(((500 - 430) / 430) * 100, 4); // 430 = 180+250
  });

  it("foraDaAnalise lista movimentação do mês", () => {
    const fora = r.foraDaAnalise.map((f) => f.nome);
    expect(fora).toContain("Investimento");
    expect(fora).toContain("Transferência");
    expect(r.foraDaAnalise.find((f) => f.nome === "Investimento").motivo).toBe("movimentacao");
  });

  it("excluir tira uma subcategoria e reduz o grupo", () => {
    const x = analiseGastosMes(MES, ANT, { mes: "2026-07", categorias: CADASTRO, excluir: ["Energia"] });
    const casa = x.grupos.find((c) => c.nome === "CASA");
    expect(casa.valor).toBe(200); // só Água
    expect(x.foraDaAnalise.find((f) => f.nome === "Energia").motivo).toBe("manual");
  });

  it("incluir coloca movimentação no total (forcada) e some do fora", () => {
    const x = analiseGastosMes(MES, ANT, { mes: "2026-07", categorias: CADASTRO, incluir: ["Investimento"] });
    expect(x.total).toBe(6450); // 1450 + 5000
    const inv = x.grupos.find((c) => c.nome === "Investimento");
    expect(inv.filhos[0].forcada).toBe(true);
    expect(x.foraDaAnalise.map((f) => f.nome)).not.toContain("Investimento");
  });

  it("categoria conhecida sem gasto entra como opção (semGasto)", () => {
    const cad = [...CADASTRO, { id: "pets", nome: "Pets", tipo: "despesa", parentId: null }];
    const x = analiseGastosMes(MES, ANT, { mes: "2026-07", categorias: cad });
    const pets = x.foraDaAnalise.find((f) => f.nome === "Pets");
    expect(pets?.motivo).toBe("semGasto");
    expect(pets?.valor).toBe(0);
  });

  it("maiorAlta = grupo que mais subiu em reais", () => {
    expect(r.maiorAlta?.nome).toBe("CASA"); // +70 (Mercado caiu, Lazer é novo)
  });

  it("mesAnterior calcula o mês certo (vira o ano)", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnterior("2026-07")).toBe("2026-06");
  });
});
