import { describe, it, expect } from "vitest";
import { getGanhosDoMes } from "../agregador.js";

describe("cheques no getGanhosDoMes", () => {
  const state = {
    contas: [{ nome: "CC", escopo: "pessoal" }],
    cheques: [
      { id: "k1", de: "João", valor: 500, vencimento: "2026-07-10", status: "aguardando", escopo: "pessoal" },
      { id: "k2", de: "Maria", valor: 300, vencimento: "2026-07-20", status: "compensado", escopo: "pessoal" },
      { id: "k3", de: "Ana", valor: 200, vencimento: "2026-07-25", status: "devolvido", escopo: "pessoal" },
    ],
  };
  it("conta só o aguardando como pendente no mês do vencimento", () => {
    const g = getGanhosDoMes("2026-07", state, "tudo");
    const chs = g.filter(x => x.categoria === "Cheques");
    expect(chs).toHaveLength(1);
    expect(chs[0].valor).toBe(500);
    expect(chs[0].status).toBe("pendente");
  });
  it("não conta cheque fora do mês", () => {
    const g = getGanhosDoMes("2026-08", state, "tudo");
    expect(g.filter(x => x.categoria === "Cheques")).toHaveLength(0);
  });
});
