import { describe, it, expect } from "vitest";
import { valorCdbHoje, capitalizarCdbsMeta } from "../cdbMeta.js";

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
