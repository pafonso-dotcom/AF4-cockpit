import { describe, it, expect } from "vitest";
import { preservarNaoVazio } from "../storage.js";

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
