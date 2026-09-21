import { describe, it, expect } from "vitest";
import { congelarCarteira, snapshotParaAno } from "../snapshotCarteira.js";
import { montarRelatorioIR } from "../relatorioIR.js";

const ativos = [
  { ticker: "PETR4", tipo: "acao", qtd: 100, pm: 30, preco: 38 },
  { ticker: "HGLG11", tipo: "fii", qtd: 50, pm: 160, preco: 155 },
  { ticker: "VENDIDO3", tipo: "acao", qtd: 0, pm: 10, preco: 12 }, // zerado: fora
];

describe("congelarCarteira", () => {
  it("congela só posições com qtd > 0, com custo e valor", () => {
    const s = congelarCarteira(ativos, "2026-12-31", () => "id1");
    expect(s.data).toBe("2026-12-31");
    expect(s.itens).toHaveLength(2);
    expect(s.itens.map(i => i.ticker)).toEqual(["HGLG11", "PETR4"]); // ordem por custo
    expect(s.totalCusto).toBe(100 * 30 + 50 * 160);
    expect(s.totalValor).toBe(100 * 38 + 50 * 155);
  });
});

describe("snapshotParaAno", () => {
  const snaps = [
    { id: "a", data: "2025-06-10", itens: [] },
    { id: "b", data: "2025-12-31", itens: [] },
    { id: "c", data: "2026-03-01", itens: [] },
  ];
  it("pega o mais recente DENTRO do ano-base", () => {
    expect(snapshotParaAno(snaps, "2025").id).toBe("b");
    expect(snapshotParaAno(snaps, "2026").id).toBe("c");
  });
  it("sem snapshot no ano → null (não vaza de outro exercício)", () => {
    expect(snapshotParaAno(snaps, "2024")).toBeNull();
  });
});

describe("montarRelatorioIR com snapshot", () => {
  it("bens vêm do snapshot congelado, não da carteira viva", () => {
    const snap = congelarCarteira(ativos, "2026-12-31", () => "s");
    // carteira "viva" mudou depois do congelamento
    const vivos = [{ ticker: "NOVA4", tipo: "acao", qtd: 999, pm: 1, preco: 1 }];
    const rel = montarRelatorioIR({ ativos: vivos, transacoes: [], ano: "2026", snapshot: snap });
    expect(rel.posicaoDe).toBe("2026-12-31");
    expect(rel.bens.map(b => b.ticker).sort()).toEqual(["HGLG11", "PETR4"]);
    expect(rel.totalBens).toBe(100 * 30 + 50 * 160);
  });
  it("sem snapshot mantém comportamento antigo (carteira atual)", () => {
    const rel = montarRelatorioIR({ ativos, transacoes: [], ano: "2026" });
    expect(rel.posicaoDe).toBeNull();
    expect(rel.bens).toHaveLength(2);
  });
});
