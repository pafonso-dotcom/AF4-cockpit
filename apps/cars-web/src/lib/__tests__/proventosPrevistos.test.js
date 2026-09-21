// Ambiente node: shim mínimo de localStorage pro import de lerProvReaisCache.
if (typeof globalThis.localStorage === "undefined") {
  const mem = {};
  globalThis.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
}

import { describe, it, expect } from "vitest";
import { proventosPendentesDoMes } from "../proventosPrevistos.js";
import { montarResumoDia } from "../resumoDia.js";

const hoje = new Date(2026, 8, 21); // 21/09/2026

describe("proventosPendentesDoMes", () => {
  const manuais = [
    { id: "m1", ticker: "HGLG11", data: "2026-09-25", total: 120 },
    { id: "m2", ticker: "PETR4", data: "2026-09-10", total: 80 },
    { id: "m3", ticker: "XPML11", data: "2026-10-05", total: 90 }, // outro mês
  ];

  it("soma só os pendentes do mês corrente", () => {
    const r = proventosPendentesDoMes({ ativos: [], proventosManuais: manuais, hoje });
    expect(r).toEqual({ total: 200, qtd: 2 });
  });

  it("recebidos e ignorados saem da conta", () => {
    const r = proventosPendentesDoMes({
      ativos: [], proventosManuais: manuais, hoje,
      proventosRecebidos: { m2: { valor: 80 } },
      proventosIgnorados: { m1: true },
    });
    expect(r).toEqual({ total: 0, qtd: 0 });
  });
});

describe("montarResumoDia · chip de proventos", () => {
  it("aparece por último quando há proventos pendentes", () => {
    const avisos = montarResumoDia({ proventosMes: { total: 200, qtd: 2 }, fmt: (v) => `R$ ${v}`, hoje });
    expect(avisos.at(-1).texto).toBe("Proventos previstos: R$ 200 ainda este mês (2 pagamentos)");
    expect(avisos.at(-1).cor).toBe("green");
  });

  it("não aparece com total zero", () => {
    const avisos = montarResumoDia({ proventosMes: { total: 0, qtd: 0 }, hoje });
    expect(avisos).toHaveLength(0);
  });

  it("singular pra 1 pagamento", () => {
    const avisos = montarResumoDia({ proventosMes: { total: 50, qtd: 1 }, fmt: (v) => `R$ ${v}`, hoje });
    expect(avisos.at(-1).texto).toContain("(1 pagamento)");
  });
});
