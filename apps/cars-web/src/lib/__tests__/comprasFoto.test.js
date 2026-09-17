import { describe, it, expect } from "vitest";
import { montarPromptComprasFoto, normalizarCompraFoto, marcarJaLancadas } from "../comprasFoto.js";

describe("montarPromptComprasFoto", () => {
  it("inclui a data de hoje e o dia da semana pra resolver datas relativas", () => {
    const p = montarPromptComprasFoto(new Date(2026, 8, 17)); // qui 17/09/2026
    expect(p).toContain("2026-09-17");
    expect(p).toContain("quinta-feira");
    expect(p).toContain('"compras"');
  });
});

describe("normalizarCompraFoto", () => {
  const hoje = "2026-09-17";

  it("aceita item válido e arredonda o valor", () => {
    expect(normalizarCompraFoto({ descricao: "AliExpress", valor: 326.054, data: "2026-09-12" }, hoje))
      .toEqual({ descricao: "AliExpress", valor: 326.05, data: "2026-09-12" });
  });

  it("rejeita valor ausente, zero ou negativo", () => {
    expect(normalizarCompraFoto({ descricao: "x" }, hoje)).toBeNull();
    expect(normalizarCompraFoto({ descricao: "x", valor: 0 }, hoje)).toBeNull();
    expect(normalizarCompraFoto({ descricao: "x", valor: -5 }, hoje)).toBeNull();
  });

  it("data inválida ou futura cai pra hoje; descrição vazia ganha padrão", () => {
    expect(normalizarCompraFoto({ valor: 10, data: "amanhã" }, hoje).data).toBe(hoje);
    expect(normalizarCompraFoto({ valor: 10, data: "2026-09-20" }, hoje).data).toBe(hoje);
    expect(normalizarCompraFoto({ valor: 10 }, hoje).descricao).toBe("Compra no cartão");
  });
});

describe("marcarJaLancadas", () => {
  const tx = (valor, data, cartaoId = "c1") => ({ tipo: "despesa", valor, data, cartaoId });

  it("marca compra com mesmo valor e data próxima (≤3 dias) no mesmo cartão", () => {
    const compras = [{ descricao: "Estação 78", valor: 180.4, data: "2026-09-11" }];
    const res = marcarJaLancadas(compras, [tx(180.4, "2026-09-12")], "c1");
    expect(res[0].jaLancada).toBe(true);
  });

  it("NÃO marca se o valor difere, a data está longe ou o cartão é outro", () => {
    const compras = [{ descricao: "x", valor: 100, data: "2026-09-11" }];
    expect(marcarJaLancadas(compras, [tx(100.5, "2026-09-11")], "c1")[0].jaLancada).toBe(false);
    expect(marcarJaLancadas(compras, [tx(100, "2026-09-01")], "c1")[0].jaLancada).toBe(false);
    expect(marcarJaLancadas(compras, [tx(100, "2026-09-11", "c2")], "c1")[0].jaLancada).toBe(false);
  });

  it("uma transação existente só casa com UMA compra da foto (duplicadas reais sobram)", () => {
    const compras = [
      { descricao: "AliExpress", valor: 326.05, data: "2026-09-12" },
      { descricao: "AliExpress", valor: 326.05, data: "2026-09-12" },
    ];
    const res = marcarJaLancadas(compras, [tx(326.05, "2026-09-12")], "c1");
    expect(res.filter(c => c.jaLancada).length).toBe(1);
    expect(res.filter(c => !c.jaLancada).length).toBe(1);
  });
});
