import { describe, it, expect } from "vitest";
import { aplicarAtualizacao, camposDoLido, ehRendaFixa } from "../atualizarSaldos.js";

describe("atualizar saldos da renda fixa", () => {
  it("saldo vira preço; aplicado = saldo − rendimento", () => {
    expect(camposDoLido({ tipo: "cdb", saldo: "6228.67", rendimento: "228.67", indexador: "cdi", taxa: "104,5", vencimento: "2028-06-26" }))
      .toMatchObject({ qtd: 1, preco: 6228.67, pm: 6000, rfIndexador: "cdi", rfTaxa: 104.5, vencimento: "2028-06-26" });
  });
  it("atualiza o existente e cria o novo", () => {
    const ativos = [{ id: "x", ticker: "CDB XP", tipo: "cdb", qtd: 1, pm: 30000, preco: 30500 }, { id: "y", ticker: "PETR4", tipo: "acao" }];
    const out = aplicarAtualizacao(ativos, [
      { alvo: ativos[0], lido: { tipo: "cdb", saldo: 32076.59, rendimento: 211.59, liquidez: "diaria" } },
      { ticker: "cdb picpay 26/06", lido: { nome: "CDB PICPAY JUN/2028", tipo: "cdb", saldo: 6228.67, rendimento: 228.67 } },
      { ignorar: true, lido: { nome: "nada", tipo: "cdb", saldo: 1 } },
    ], () => "n1");
    expect(out.find(a => a.id === "x")).toMatchObject({ preco: 32076.59, pm: 31865, liquidez: "diaria" });
    expect(out.find(a => a.id === "n1")).toMatchObject({ ticker: "CDB PICPAY 26/06", qtd: 1, preco: 6228.67, pm: 6000 });
    expect(out.find(a => a.id === "y")).toEqual({ id: "y", ticker: "PETR4", tipo: "acao" });
    expect(out).toHaveLength(3);
    expect(ehRendaFixa({ tipo: "cdb" }) && !ehRendaFixa({ tipo: "acao" })).toBe(true);
  });
});
