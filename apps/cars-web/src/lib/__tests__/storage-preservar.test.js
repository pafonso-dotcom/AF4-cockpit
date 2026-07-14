import { describe, it, expect } from "vitest";
import { preservarNaoVazio, mesclarEstado } from "../storage.js";

describe("preservarNaoVazio — não deixa nuvem vazia apagar dado local cheio", () => {
  it("array vazio remoto NÃO apaga array cheio local", () => {
    const remote = { cheques: [], contas: [{ id: "c1" }] };
    const local = { cheques: [{ id: "ch1" }, { id: "ch2" }], contas: [{ id: "c1" }] };
    const out = preservarNaoVazio(remote, local);
    expect(out.cheques).toHaveLength(2);      // preservou os locais
    expect(out.contas).toHaveLength(1);
  });

  it("chave ausente no remoto NÃO apaga o local cheio", () => {
    const remote = { contas: [{ id: "c1" }] };  // sem `cheques`
    const local = { cheques: [{ id: "ch1" }], contas: [{ id: "c1" }] };
    const out = preservarNaoVazio(remote, local);
    expect(out.cheques).toHaveLength(1);
  });

  it("array cheio remoto VENCE o local (fonte mais recente)", () => {
    const remote = { cheques: [{ id: "novo1" }, { id: "novo2" }, { id: "novo3" }] };
    const local = { cheques: [{ id: "velho1" }] };
    const out = preservarNaoVazio(remote, local);
    expect(out.cheques.map(c => c.id)).toEqual(["novo1", "novo2", "novo3"]);
  });

  it("ambos vazios → fica vazio (sem inventar dado)", () => {
    const out = preservarNaoVazio({ cheques: [] }, { cheques: [] });
    expect(out.cheques).toEqual([]);
  });

  it("escalares e chaves só do remoto passam normalmente", () => {
    const remote = { themeId: "nevoa", ativos: [{ id: "a1" }] };
    const local = { themeId: "aurora" };
    const out = preservarNaoVazio(remote, local);
    expect(out.themeId).toBe("nevoa");
    expect(out.ativos).toHaveLength(1);
  });

  it("sem cache local, devolve o remoto como veio", () => {
    const remote = { cheques: [], contas: [{ id: "c1" }] };
    const out = preservarNaoVazio(remote, null);
    expect(out.cheques).toEqual([]);
    expect(out.contas).toHaveLength(1);
  });
});

describe("mesclarEstado — última escrita vence pelo _savedAt", () => {
  it("local mais NOVO que a nuvem vence (edição não sincronizada não some)", () => {
    const remote = { _savedAt: 100, transacoes: [{ id: "t1", categoria: "Moradia" }] };
    const local = { _savedAt: 200, transacoes: [{ id: "t1", categoria: "Alimentação" }] };
    const { estado, localVenceu } = mesclarEstado(remote, local);
    expect(localVenceu).toBe(true);
    expect(estado.transacoes[0].categoria).toBe("Alimentação");
  });

  it("nuvem mais NOVA vence (sincroniza de outro aparelho)", () => {
    const remote = { _savedAt: 300, transacoes: [{ id: "t1", categoria: "Lazer" }] };
    const local = { _savedAt: 200, transacoes: [{ id: "t1", categoria: "Alimentação" }] };
    const { estado, localVenceu } = mesclarEstado(remote, local);
    expect(localVenceu).toBe(false);
    expect(estado.transacoes[0].categoria).toBe("Lazer");
  });

  it("sem carimbos → comportamento antigo (remoto vence + preservarNaoVazio)", () => {
    const remote = { transacoes: [{ id: "t1", categoria: "Lazer" }], cheques: [] };
    const local = { transacoes: [{ id: "t1", categoria: "Alimentação" }], cheques: [{ id: "ch1" }] };
    const { estado, localVenceu } = mesclarEstado(remote, local);
    expect(localVenceu).toBe(false);
    expect(estado.transacoes[0].categoria).toBe("Lazer"); // remoto vence
    expect(estado.cheques).toHaveLength(1);               // mas não apaga cheio local
  });

  it("local mais novo ainda respeita proteção: mantém tudo do local", () => {
    const remote = { _savedAt: 100, transacoes: [], cheques: [{ id: "r" }] };
    const local = { _savedAt: 200, transacoes: [{ id: "t1" }], cheques: [{ id: "l" }] };
    const { estado } = mesclarEstado(remote, local);
    expect(estado.transacoes).toHaveLength(1);
    expect(estado.cheques[0].id).toBe("l");
  });
});
