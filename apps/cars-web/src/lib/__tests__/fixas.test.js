import { describe, it, expect } from "vitest";
import { dataVencimentoNoMes, gerarOcorrencias } from "../fixas.js";

describe("dataVencimentoNoMes", () => {
  it("monta a data com o dia informado", () => {
    expect(dataVencimentoNoMes("2026-07", 20)).toBe("2026-07-20");
  });
  it("faz o clamp em 28 pra evitar dia inválido em fevereiro", () => {
    expect(dataVencimentoNoMes("2026-02", 30)).toBe("2026-02-28");
  });
  it("usa 1 como fallback quando o dia é inválido/ausente", () => {
    expect(dataVencimentoNoMes("2026-07", null)).toBe("2026-07-01");
    expect(dataVencimentoNoMes("2026-07", 0)).toBe("2026-07-01");
  });
});

describe("gerarOcorrencias — usa o diaVencimento da fixa (regressão do bug de edição)", () => {
  it("gera as 12 ocorrências do ano com o dia configurado", () => {
    const fixa = { id: "f1", descricao: "Luz", valor: 1031.16, diaVencimento: 20 };
    const occ = gerarOcorrencias(fixa, 2026);
    expect(occ).toHaveLength(12);
    expect(occ[6].dataVencimento).toBe("2026-07-20"); // julho = índice 6
    expect(occ.every(o => o.dataVencimento.endsWith("-20"))).toBe(true);
  });

  it("respeita inicioEm/terminoEm", () => {
    const fixa = { id: "f2", descricao: "Curso", valor: 100, diaVencimento: 5, inicioEm: "2026-03", terminoEm: "2026-05" };
    const occ = gerarOcorrencias(fixa, 2026);
    expect(occ.map(o => o.mes)).toEqual(["2026-03", "2026-04", "2026-05"]);
  });
});
