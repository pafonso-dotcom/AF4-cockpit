// Ambiente node: shim de localStorage pros imports (gistSync lê no módulo).
if (typeof globalThis.localStorage === "undefined") {
  const mem = {};
  globalThis.localStorage = {
    getItem: (k) => (k in mem ? mem[k] : null),
    setItem: (k, v) => { mem[k] = String(v); },
    removeItem: (k) => { delete mem[k]; },
  };
}

import { describe, it, expect } from "vitest";
import { contasCambioDefasado } from "../cambio.js";
import { backupNuvemAtraso } from "../gistSync.js";
import { montarResumoDia } from "../resumoDia.js";

const hoje = new Date("2026-09-21T12:00:00");

describe("contasCambioDefasado", () => {
  it("flagra sem cotação e cotação ao vivo parada há 3+ dias", () => {
    const contas = [
      { nome: "BRL", saldo: 100 },                                                        // real: fora
      { nome: "USD ok", moeda: "USD", cotacao: 5.4, cotacaoAtualizadaEm: "2026-09-20T10:00:00" }, // 1d: ok
      { nome: "USD velha", moeda: "USD", cotacao: 5.4, cotacaoAtualizadaEm: "2026-09-15T10:00:00" }, // 6d: flagra
      { nome: "EUR sem", moeda: "EUR", cotacao: 0 },                                      // sem cotação: flagra
      { nome: "USD manual", moeda: "USD", cotacao: 5.0 },                                 // manual (sem timestamp): respeita
    ];
    const r = contasCambioDefasado(contas, hoje);
    expect(r.map(c => c.nome)).toEqual(["USD velha", "EUR sem"]);
  });
});

describe("backupNuvemAtraso", () => {
  it("sem token configurado → null (nada a alertar)", () => {
    expect(backupNuvemAtraso(hoje)).toBeNull();
  });
});

describe("montarResumoDia · chips de backup e câmbio", () => {
  it("backup atrasado gera aviso com os dias", () => {
    const avisos = montarResumoDia({ backupAtraso: { dias: 5 }, hoje });
    expect(avisos.some(a => a.texto.includes("há 5 dias sem enviar"))).toBe(true);
  });
  it("backup que nunca enviou tem texto próprio", () => {
    const avisos = montarResumoDia({ backupAtraso: { dias: null }, hoje });
    expect(avisos.some(a => a.texto.includes("nunca enviou"))).toBe(true);
  });
  it("câmbio defasado gera aviso; zero não gera", () => {
    expect(montarResumoDia({ cambioDefasado: 2, hoje }).some(a => a.texto.includes("Câmbio de 2 contas"))).toBe(true);
    expect(montarResumoDia({ cambioDefasado: 0, hoje })).toHaveLength(0);
  });
});
