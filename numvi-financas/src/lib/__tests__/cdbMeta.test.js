import { describe, it, expect } from "vitest";
import { valorCdbHoje, capitalizarCdbsMeta, autoAplicarCofrinhos } from "../cdbMeta.js";

const CDI = 10; // 10% a.a. — facilita conferir as contas

describe("valorCdbHoje", () => {
  it("no dia da aplicação, valor = base (sem rendimento ainda)", () => {
    const ativo = { _baseValor: 1000, _aplicadoEm: "2026-01-01" };
    expect(valorCdbHoje(ativo, "2026-01-01", CDI)).toBeCloseTo(1000, 2);
  });

  it("após 1 ano a 10% a.a., rende ~10%", () => {
    const ativo = { _baseValor: 1000, _aplicadoEm: "2026-01-01" };
    expect(valorCdbHoje(ativo, "2027-01-01", CDI)).toBeCloseTo(1100, 0);
  });

  it("usa pm como base quando _baseValor não existe (compat)", () => {
    const ativo = { pm: 500, _aplicadoEm: "2026-01-01" };
    expect(valorCdbHoje(ativo, "2026-01-01", CDI)).toBeCloseTo(500, 2);
  });

  it("nunca rende pra trás (data futura como base → 0 dias)", () => {
    const ativo = { _baseValor: 1000, _aplicadoEm: "2026-06-01" };
    expect(valorCdbHoje(ativo, "2026-01-01", CDI)).toBeCloseTo(1000, 2);
  });
});

describe("capitalizarCdbsMeta", () => {
  it("ignora ativos que não são CDB de meta", () => {
    const ativos = [{ id: "a", ticker: "PETR4", preco: 30 }];
    const { ativos: nova, mudou } = capitalizarCdbsMeta(ativos, "2027-01-01", CDI);
    expect(mudou).toBe(false);
    expect(nova[0].preco).toBe(30);
  });

  it("atualiza o preço do CDB de meta capitalizando a CDI", () => {
    const ativos = [{ id: "c", _cdbMeta: true, _baseValor: 1000, _aplicadoEm: "2026-01-01", preco: 1000 }];
    const { ativos: nova, mudou } = capitalizarCdbsMeta(ativos, "2027-01-01", CDI);
    expect(mudou).toBe(true);
    expect(nova[0].preco).toBeCloseTo(1100, 0);
    expect(nova[0]._capituladoEm).toBe("2027-01-01");
  });

  it("reaplicação preserva o rendimento já acumulado", () => {
    // CDB com base 1000 aplicado há 1 ano → vale ~1100 (rendeu ~100).
    // Reaplica +500 hoje: nova base = 1100 + 500 = 1600, a partir de hoje.
    // No mesmo dia, o valor tem que ser 1600 (não pode cair pra 1500 = só o custo).
    const hoje = "2027-01-01";
    const reaplicado = {
      id: "c", _cdbMeta: true,
      _baseValor: 1600, _aplicadoEm: hoje, _capituladoEm: hoje, preco: 1600,
      pm: 1500, // custo = 1000 + 500
    };
    const { ativos: nova } = capitalizarCdbsMeta([reaplicado], hoje, CDI);
    expect(nova[0].preco).toBeCloseTo(1600, 2); // rendimento dos 100 preservado
    expect(nova[0].preco).toBeGreaterThan(nova[0].pm); // valor > custo
  });
});

describe("autoAplicarCofrinhos", () => {
  const meta = { id: "m1", nome: "Viagem", autoCdb: true };
  const cofre = { id: "cof", nome: "🐷 Viagem", _cofreMetaId: "m1", saldo: 500, tipo: "poupanca" };

  it("não faz nada se a meta não tem autoCdb", () => {
    const r = autoAplicarCofrinhos({ metas: [{ ...meta, autoCdb: false }], contas: [cofre] });
    expect(r.mudou).toBe(false);
  });

  it("aplica o saldo do cofrinho no CDB e esvazia o cofrinho", () => {
    const r = autoAplicarCofrinhos({ metas: [meta], contas: [cofre], ativos: [], transacoes: [] });
    expect(r.mudou).toBe(true);
    const cofreDepois = r.contas.find(c => c.id === "cof");
    expect(cofreDepois.saldo).toBeCloseTo(0, 2);
    const cdb = r.ativos.find(a => a._cdbMeta && a._metaId === "m1");
    expect(cdb).toBeTruthy();
    expect(cdb.preco).toBeCloseTo(500, 2);
    expect(r.transacoes.length).toBe(1);
  });

  it("é idempotente: rodar de novo com cofrinho vazio não muda nada", () => {
    const r1 = autoAplicarCofrinhos({ metas: [meta], contas: [cofre], ativos: [], transacoes: [] });
    const r2 = autoAplicarCofrinhos({ metas: [meta], contas: r1.contas, ativos: r1.ativos, transacoes: r1.transacoes });
    expect(r2.mudou).toBe(false);
  });

  it("incrementa o CDB existente em vez de duplicar", () => {
    const cdbExistente = { id: "cdb1", _cdbMeta: true, _metaId: "m1", qtd: 1, pm: 1000, preco: 1000, _baseValor: 1000 };
    const r = autoAplicarCofrinhos({ metas: [meta], contas: [cofre], ativos: [cdbExistente], transacoes: [] });
    const cdbs = r.ativos.filter(a => a._cdbMeta && a._metaId === "m1");
    expect(cdbs.length).toBe(1);
    expect(cdbs[0].preco).toBeCloseTo(1500, 2); // 1000 + 500
    expect(cdbs[0].pm).toBeCloseTo(1500, 2);
  });
});
