import { describe, it, expect } from "vitest";
import { calcOrcamentoCategorias } from "../orcamentos.js";

const cat = (nome, limite) => ({ id: nome, nome, tipo: "despesa", limite, cor: "#000" });
const t = (categoria, valor, data) => ({ categoria, valor, data, tipo: "despesa" });

describe("calcOrcamentoCategorias", () => {
  it("calcula gasto e % do orçamento da categoria no mês (ignora outros meses)", () => {
    const cats = [cat("Mercado", 1000)];
    const txs = [
      t("Mercado", 300, "2026-06-03"),
      t("Mercado", 500, "2026-06-20"),
      t("Mercado", 200, "2026-05-10"), // mês anterior — não conta
    ];
    const r = calcOrcamentoCategorias(cats, txs, "2026-06");
    expect(r).toHaveLength(1);
    expect(r[0].gasto).toBe(800);
    expect(r[0].pct).toBeCloseTo(80, 5);
    expect(r[0].estado).toBe("alerta");
  });

  it("marca 'estourado' quando passa do limite", () => {
    const r = calcOrcamentoCategorias([cat("Lazer", 200)], [t("Lazer", 250, "2026-06-01")], "2026-06");
    expect(r[0].estado).toBe("estourado");
    expect(r[0].pct).toBeCloseTo(125, 5);
  });

  it("'ok' quando abaixo de 80%", () => {
    const r = calcOrcamentoCategorias([cat("Transporte", 500)], [t("Transporte", 100, "2026-06-01")], "2026-06");
    expect(r[0].estado).toBe("ok");
  });

  it("ignora categorias sem limite e receitas", () => {
    const cats = [cat("Mercado", 0), { id: "sal", nome: "Salário", tipo: "receita", limite: 5000 }];
    const r = calcOrcamentoCategorias(cats, [], "2026-06");
    expect(r).toHaveLength(0);
  });

  it("ordena por % desc", () => {
    const cats = [cat("A", 100), cat("B", 100)];
    const txs = [t("A", 30, "2026-06-01"), t("B", 90, "2026-06-01")];
    const r = calcOrcamentoCategorias(cats, txs, "2026-06");
    expect(r.map((x) => x.nome)).toEqual(["B", "A"]);
  });
});

describe("calcOrcamentoComGastos (gastos agregados: fixas + parcelas + avulsas)", async () => {
  const { calcOrcamentoComGastos } = await import("../orcamentos.js");
  const cats = [
    { id: "1", nome: "Mercado", tipo: "despesa", limite: 1000, cor: "#f00" },
    { id: "2", nome: "Lazer", tipo: "despesa", limite: 200 },
    { id: "3", nome: "Sem limite", tipo: "despesa" },
    { id: "4", nome: "Salário", tipo: "receita", limite: 999 },
  ];

  it("calcula pct/estado a partir da lista {nome, valor}", () => {
    const gastos = [
      { nome: "Mercado", valor: 500 },
      { nome: "Mercado", valor: 350 },
      { nome: "Lazer", valor: 250 },
      { nome: "Sem limite", valor: 50 },
    ];
    const r = calcOrcamentoComGastos(cats, gastos);
    expect(r.map(x => x.nome)).toEqual(["Lazer", "Mercado"]); // ordenado por % desc
    const lazer = r[0], mercado = r[1];
    expect(lazer.estado).toBe("estourado");
    expect(mercado.gasto).toBe(850);
    expect(mercado.estado).toBe("alerta"); // 85%
  });

  it("ignora receitas e categorias sem limite; sem gasto = 0% ok", () => {
    const r = calcOrcamentoComGastos(cats, []);
    expect(r.length).toBe(2);
    expect(r.every(x => x.estado === "ok" && x.gasto === 0)).toBe(true);
  });
});
