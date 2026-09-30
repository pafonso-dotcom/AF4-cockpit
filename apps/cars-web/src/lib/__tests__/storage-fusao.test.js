import { describe, it, expect } from "vitest";
import { fundirEstados, mesclarEstado } from "../storage.js";

describe("fundirEstados — união por id entre dois aparelhos", () => {
  it("mantém a versão do vencedor e reincorpora itens criados só no perdedor", () => {
    const vencedor = { transacoes: [{ id: "a", valor: 10, categoria: "Nova" }, { id: "c", valor: 3 }] };
    const perdedor = { transacoes: [{ id: "a", valor: 10, categoria: "Velha" }, { id: "b", valor: 99 }] };
    const out = fundirEstados(vencedor, perdedor);
    expect(out.transacoes.map(t => t.id)).toEqual(["a", "c", "b"]);
    expect(out.transacoes.find(t => t.id === "a").categoria).toBe("Nova"); // vencedor manda no empate
  });

  it("vencedor com array vazio não apaga coleção cheia do perdedor", () => {
    const out = fundirEstados({ cheques: [] }, { cheques: [{ id: "x" }] });
    expect(out.cheques.length).toBe(1);
  });

  it("proventosRecebidos (objeto chaveado) faz união de chaves com vencedor mandando", () => {
    const out = fundirEstados(
      { proventosRecebidos: { "A-2026-01-01-Div": { valor: 10 } } },
      { proventosRecebidos: { "A-2026-01-01-Div": { valor: 99 }, "B-2026-02-01-Rend": { valor: 5 } } },
    );
    expect(out.proventosRecebidos["A-2026-01-01-Div"].valor).toBe(10);
    expect(out.proventosRecebidos["B-2026-02-01-Rend"].valor).toBe(5);
  });

  it("chave que só existe no perdedor entra no resultado; escalares ficam do vencedor", () => {
    const out = fundirEstados({ themeId: "dark" }, { themeId: "light", orcamentosFuturos: [{ id: "o1" }] });
    expect(out.themeId).toBe("dark");
    expect(out.orcamentosFuturos.length).toBe(1);
  });
});

describe("mesclarEstado — iPhone de manhã × PC à tarde não se engolem", () => {
  it("local mais novo vence a forma, mas transação criada só na nuvem sobrevive", () => {
    const remote = { _savedAt: 100, transacoes: [{ id: "manha", valor: 50 }] };
    const local = { _savedAt: 200, transacoes: [{ id: "tarde", valor: 80 }] };
    const { estado, localVenceu } = mesclarEstado(remote, local);
    expect(localVenceu).toBe(true);
    expect(estado.transacoes.map(t => t.id).sort()).toEqual(["manha", "tarde"]);
  });

  it("nuvem mais nova vence a forma, mas lançamento local não sincronizado sobrevive", () => {
    const remote = { _savedAt: 300, transacoes: [{ id: "pc", valor: 1 }], contas: [{ id: "c1", saldo: 10 }] };
    const local = { _savedAt: 100, transacoes: [{ id: "cel", valor: 2 }] };
    const { estado, localVenceu } = mesclarEstado(remote, local);
    expect(localVenceu).toBe(false);
    expect(estado.transacoes.map(t => t.id).sort()).toEqual(["cel", "pc"]);
    expect(estado.contas[0].saldo).toBe(10);
  });
});

describe("fixa excluída não ressuscita (bug 2026-09-30)", () => {
  it("lápides de fixas/fixaOcorrencias filtram o que a nuvem ainda tem", async () => {
    const { fundirEstados } = await import("../storage.js");
    const agora = Date.now();
    const local = {
      _savedAt: agora,
      fixas: [],
      fixaOcorrencias: [{ id: "occ-a-2026-10", fixaId: "a", mes: "2026-10" }],
      tumbas: {
        fixas: { "a": agora },
        fixaOcorrencias: { "occ-a-2026-09": agora },
      },
    };
    const nuvem = {
      _savedAt: agora - 60_000,
      fixas: [{ id: "a", nome: "UNIMED" }],
      fixaOcorrencias: [
        { id: "occ-a-2026-09", fixaId: "a", mes: "2026-09" },
        { id: "occ-a-2026-10", fixaId: "a", mes: "2026-10" },
      ],
    };
    const r = fundirEstados(local, nuvem);
    expect(r.fixas).toEqual([]);                                // UNIMED não volta
    expect(r.fixaOcorrencias.map(o => o.id)).toEqual(["occ-a-2026-10"]); // set/26 morta, out/26 fica
  });
});
