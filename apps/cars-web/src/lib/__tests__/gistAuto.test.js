import { describe, it, expect, beforeEach, vi } from "vitest";

// Shim de localStorage em memória (testes rodam em ambiente node)
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};
globalThis.window = globalThis.window || { dispatchEvent: () => {} };

const {
  gistAutoAtivo, setGistAutoAtivo, gistAutoUltimo, gistBackupAutomatico,
  setGistToken,
} = await import("../gistSync.js");

describe("backup automático via Gist", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("vem ligado por padrão e o interruptor desliga/religa", () => {
    expect(gistAutoAtivo()).toBe(true);
    setGistAutoAtivo(false);
    expect(gistAutoAtivo()).toBe(false);
    setGistAutoAtivo(true);
    expect(gistAutoAtivo()).toBe(true);
  });

  it("não envia sem token configurado", async () => {
    const r = await gistBackupAutomatico({ contas: [] });
    expect(r).toEqual({ feito: false, motivo: "sem-token" });
  });

  it("não envia com o interruptor desligado", async () => {
    setGistToken("ghp_teste");
    setGistAutoAtivo(false);
    const r = await gistBackupAutomatico({ contas: [] });
    expect(r).toEqual({ feito: false, motivo: "desligado" });
  });

  it("envia 1x e não repete no mesmo dia", async () => {
    setGistToken("ghp_teste");
    localStorage.setItem("af4:gist-id", "gist123");
    // mocka a API do GitHub: validação do gist cacheado + PATCH
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ description: "NUMVI · Dados (gerado automaticamente — não apagar)", id: "gist123" }),
    });
    const r1 = await gistBackupAutomatico({ contas: [{ id: 1 }] });
    expect(r1.feito).toBe(true);
    expect(gistAutoUltimo()).toBeTruthy();
    const chamadasAposPrimeiro = fetchMock.mock.calls.length;

    const r2 = await gistBackupAutomatico({ contas: [{ id: 1 }] });
    expect(r2).toEqual({ feito: false, motivo: "ja-enviado-hoje" });
    expect(fetchMock.mock.calls.length).toBe(chamadasAposPrimeiro); // nenhuma chamada nova
  });

  it("erro de rede não estoura — retorna feito: false", async () => {
    setGistToken("ghp_teste");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"));
    const r = await gistBackupAutomatico({ contas: [] });
    expect(r.feito).toBe(false);
    expect(r.motivo).toBe("erro");
    expect(gistAutoUltimo()).toBeNull(); // não marca o dia se falhou
  });
});
