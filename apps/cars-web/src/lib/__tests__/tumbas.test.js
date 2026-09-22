import { describe, it, expect } from "vitest";
import { podarTumbas, comTumbas, unirTumbas, idsRemovidos, TUMBAS_MAX_DIAS } from "../tumbas.js";
import { fundirEstados, mesclarEstado } from "../storage.js";

const DIA = 24 * 60 * 60 * 1000;

describe("tumbas — registro de itens apagados", () => {
  it("comTumbas registra ids com carimbo e preserva os anteriores", () => {
    const t1 = comTumbas({}, "transacoes", ["a"], 1000);
    const t2 = comTumbas(t1, "transacoes", ["b"], 2000);
    expect(t2.transacoes).toEqual({ a: 1000, b: 2000 });
  });

  it("podarTumbas remove lápides com mais de 180 dias", () => {
    const agora = Date.now();
    const velha = agora - (TUMBAS_MAX_DIAS + 1) * DIA;
    const t = podarTumbas({ transacoes: { a: velha, b: agora } }, agora);
    expect(t.transacoes).toEqual({ b: agora });
  });

  it("unirTumbas une coleções dos dois lados (carimbo mais novo vence)", () => {
    const agora = Date.now();
    const out = unirTumbas(
      { transacoes: { a: agora - 10 } },
      { transacoes: { a: agora, b: agora }, fixas: { f1: agora } },
      agora,
    );
    expect(out.transacoes.a).toBe(agora);
    expect(out.transacoes.b).toBe(agora);
    expect(out.fixas.f1).toBe(agora);
  });

  it("idsRemovidos detecta o que sumiu da lista", () => {
    const prev = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(idsRemovidos(prev, [{ id: "a" }, { id: "c" }])).toEqual(["b"]);
    expect(idsRemovidos(prev, prev)).toEqual([]);
    expect(idsRemovidos([], [])).toEqual([]);
  });
});

describe("fusão respeita lápides — o bug do 'lançamento que volta'", () => {
  it("item apagado no vencedor NÃO volta do perdedor (caso relatado)", () => {
    const agora = Date.now();
    const vencedor = {
      transacoes: [{ id: "outra", valor: 10 }],
      tumbas: { transacoes: { acerto68k: agora } },
    };
    const perdedor = { transacoes: [{ id: "outra", valor: 10 }, { id: "acerto68k", valor: 68000 }] };
    const out = fundirEstados(vencedor, perdedor);
    expect(out.transacoes.map(t => t.id)).toEqual(["outra"]);
  });

  it("lápide vinda do PERDEDOR também mata o item no vencedor", () => {
    const agora = Date.now();
    const vencedor = { transacoes: [{ id: "morto", valor: 1 }, { id: "vivo", valor: 2 }] };
    const perdedor = { transacoes: [], tumbas: { transacoes: { morto: agora } } };
    const out = fundirEstados(vencedor, perdedor);
    expect(out.transacoes.map(t => t.id)).toEqual(["vivo"]);
    expect(out.tumbas.transacoes.morto).toBe(agora);
  });

  it("proteção 'vazio não apaga cheio' não ressuscita item com lápide", () => {
    const agora = Date.now();
    const out = fundirEstados(
      { transacoes: [], tumbas: { transacoes: { morto: agora } } },
      { transacoes: [{ id: "morto" }, { id: "vivo" }] },
    );
    expect(out.transacoes.map(t => t.id)).toEqual(["vivo"]);
  });

  it("mesclarEstado ponta a ponta: deletar no aparelho novo vence a nuvem velha", () => {
    const agora = Date.now();
    const remote = { _savedAt: 100, transacoes: [{ id: "morto", valor: 68000 }, { id: "vivo", valor: 1 }] };
    const local = {
      _savedAt: 200,
      transacoes: [{ id: "vivo", valor: 1 }],
      tumbas: { transacoes: { morto: agora } },
    };
    const { estado } = mesclarEstado(remote, local);
    expect(estado.transacoes.map(t => t.id)).toEqual(["vivo"]);
  });

  it("sem lápide, o comportamento antigo continua (união preserva tudo)", () => {
    const out = fundirEstados(
      { transacoes: [{ id: "a" }] },
      { transacoes: [{ id: "a" }, { id: "b" }] },
    );
    expect(out.transacoes.map(t => t.id)).toEqual(["a", "b"]);
  });
});
