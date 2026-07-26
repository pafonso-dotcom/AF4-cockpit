import { describe, it, expect } from "vitest";
import { proximosMesesFixa } from "../adiantamentoFixa.js";

describe("proximosMesesFixa", () => {
  it("devolve os N meses SEGUINTES (sem o base), com o dia de vencimento", () => {
    expect(proximosMesesFixa("2026-11", 3, 10)).toEqual([
      { mes: "2026-12", dataVencimento: "2026-12-10" },
      { mes: "2027-01", dataVencimento: "2027-01-10" },
      { mes: "2027-02", dataVencimento: "2027-02-10" },
    ]);
  });

  it("dia de vencimento é limitado a 1..28", () => {
    expect(proximosMesesFixa("2026-01", 1, 31)[0].dataVencimento).toBe("2026-02-28");
    expect(proximosMesesFixa("2026-01", 1, 0)[0].dataVencimento).toBe("2026-02-01");
  });

  it("n <= 0 ou base inválido → vazio", () => {
    expect(proximosMesesFixa("2026-01", 0, 5)).toEqual([]);
    expect(proximosMesesFixa("", 3, 5)).toEqual([]);
  });
});
