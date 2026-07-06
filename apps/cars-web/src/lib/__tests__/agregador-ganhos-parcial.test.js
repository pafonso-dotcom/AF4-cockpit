import { describe, it, expect } from "vitest";
import { getGanhosDoMes } from "../agregador.js";

describe("getGanhosDoMes · recebimento parcial", () => {
  it("devedor pendente com recebimento parcial entra pelo SALDO ABERTO, não pelo valor cheio", () => {
    const state = {
      devedores: [{ id: "d1", nome: "Carla", valor: 15000, valorRecebido: 6000, vencimento: "2026-07-10", recebido: false }],
    };
    const g = getGanhosDoMes("2026-07", state).find(x => x.id === "d1");
    expect(g).toBeTruthy();
    expect(g.valor).toBe(9000); // falta 9.000
    expect(g.status).toBe("pendente");
  });

  it("devedor totalmente recebido via parciais (aberto = 0) não gera pendência", () => {
    const state = {
      devedores: [{ id: "d1", nome: "Carla", valor: 15000, valorRecebido: 15000, vencimento: "2026-07-10", recebido: false }],
    };
    expect(getGanhosDoMes("2026-07", state).find(x => x.id === "d1")).toBeUndefined();
  });
});

describe("getGanhosDoMes · atrasados (incluirAtrasados)", () => {
  const state = {
    devedores: [{ id: "d1", nome: "Carla", valor: 15000, valorRecebido: 6000, vencimento: "2026-06-10", recebido: false }],
    cheques: [{ id: "c1", de: "ERENILSON", valor: 12500, vencimento: "2026-05-20", status: "aguardando" }],
  };

  it("por padrão, item vencido em mês anterior NÃO entra no mês corrente (comportamento antigo)", () => {
    const g = getGanhosDoMes("2026-07", state);
    expect(g.find(x => x.id === "d1")).toBeUndefined();
    expect(g.find(x => x.id === "cheque::c1")).toBeUndefined();
  });

  it("com incluirAtrasados, devedor e cheque vencidos entram no mês com status atrasada e saldo aberto", () => {
    const g = getGanhosDoMes("2026-07", state, undefined, { incluirAtrasados: true });
    const dev = g.find(x => x.id === "d1");
    expect(dev).toBeTruthy();
    expect(dev.valor).toBe(9000);
    expect(dev.status).toBe("atrasada");
    const ch = g.find(x => x.id === "cheque::c1");
    expect(ch).toBeTruthy();
    expect(ch.valor).toBe(12500);
    expect(ch.status).toBe("atrasada");
  });

  it("incluirAtrasados não duplica itens do próprio mês", () => {
    const st = { devedores: [{ id: "d2", nome: "João", valor: 500, vencimento: "2026-07-05", recebido: false }] };
    const g = getGanhosDoMes("2026-07", st, undefined, { incluirAtrasados: true }).filter(x => x.id === "d2");
    expect(g).toHaveLength(1);
    expect(g[0].status).toBe("pendente");
  });

  it("atrasadosDesde limita o alcance: parcela do ano anterior NÃO é puxada", () => {
    const st = {
      devedores: [
        { id: "d2025", nome: "Boa Bola", valor: 2553, vencimento: "2025-11-05", recebido: false }, // ano anterior
        { id: "d2026", nome: "Boa Bola", valor: 2553, vencimento: "2026-06-05", recebido: false }, // atrasado no ano
      ],
    };
    const g = getGanhosDoMes("2026-07", st, undefined, { incluirAtrasados: true, atrasadosDesde: "2026-01" });
    expect(g.find(x => x.id === "d2025")).toBeUndefined(); // fora do piso
    expect(g.find(x => x.id === "d2026")).toBeTruthy();    // dentro do ano da projeção
  });
});
