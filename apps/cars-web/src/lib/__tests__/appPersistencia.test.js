import { describe, it, expect, vi } from "vitest";
import { aplicarDadosCarregados, aplicarSeeds } from "../appPersistencia.js";

// Cria um objeto de setters espião. Cada setX guarda o último valor aplicado
// (resolvendo updaters funcionais como o React faria).
function makeS() {
  const store = {};
  const S = new Proxy({}, {
    get(_t, prop) {
      if (!store[prop]) {
        const fn = vi.fn((v) => { fn.value = typeof v === "function" ? v(fn.value) : v; });
        store[prop] = fn;
      }
      return store[prop];
    },
  });
  return { S, store };
}

describe("aplicarDadosCarregados", () => {
  it("aplica valores salvos e defaults", () => {
    const { S, store } = makeS();
    const data = {
      contas: [{ id: 1, nome: "Banco" }],
      transacoes: [{ id: "t1", valor: 10 }],
      cartoes: [{ id: "c1", nome: "Visa" }],
      parcelamentos: [{ id: "p1", cartaoNome: "Visa" }],
      modeloAtivoId: "carteira-x",
      themeId: "gold",
    };
    aplicarDadosCarregados(data, S);

    expect(store.setContas.value).toEqual([{ id: 1, nome: "Banco" }]);
    // Defaults aplicados nas transações
    expect(store.setTransacoes.value[0]).toMatchObject({
      id: "t1", valor: 10, compensado: true, obs: "", fixa: false, vencimento: null,
    });
    // Migração parcelamento: cartaoNome → cartaoId
    expect(store.setParcelamentos.value[0]).toMatchObject({ id: "p1", cartaoId: "c1" });
    // Chaves ausentes viram vazio
    expect(store.setNotas.value).toEqual([]);
    expect(store.setProventosRecebidos.value).toEqual({});
    expect(store.setCarteiraProventos.value).toEqual({ saldo: 0, historico: [] });
    expect(store.setModeloAtivoId.value).toBe("carteira-x");
    expect(store.setThemeId.value).toBe("gold");
  });

  it("não troca o tema quando o themeId salvo é inválido", () => {
    const { S, store } = makeS();
    aplicarDadosCarregados({ themeId: "inexistente" }, S);
    expect(store.setThemeId).toBeUndefined(); // setThemeId nunca foi chamado
  });
});

describe("aplicarSeeds", () => {
  it("popula seeds e zera as coleções novas", () => {
    const { S, store } = makeS();
    aplicarSeeds(S);
    expect(Array.isArray(store.setContas.value)).toBe(true);
    expect(store.setFixas.value).toEqual([]);
    expect(store.setCaixaNegocio.value).toEqual({ saldo: 0, historico: [] });
    expect(store.setProventosManuais.value).toEqual([]);
    expect(store.setTradeOnboardingVisto.value).toBe(false);
  });
});
