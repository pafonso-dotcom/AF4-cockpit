import { describe, it, expect } from "vitest";
import { aplicarCompraNaProjecao } from "../simuladorCompra.js";

// Projeção fake no formato de getProjecaoSaldo: saldo 1.000, líquido +500/mês.
const proj = {
  saldoInicial: 1000,
  meses: [
    { mesISO: "2026-09", label: "Set", liquido: 500, saldoFim: 1500 },
    { mesISO: "2026-10", label: "Out", liquido: 500, saldoFim: 2000 },
    { mesISO: "2026-11", label: "Nov", liquido: 500, saldoFim: 2500 },
    { mesISO: "2026-12", label: "Dez", liquido: 500, saldoFim: 3000 },
    { mesISO: "2027-01", label: "Jan", liquido: 500, saldoFim: 3500 },
  ],
};

describe("aplicarCompraNaProjecao — compra hipotética sem tocar nos dados", () => {
  it("4x a partir do mês atual: parcela em 4 meses e saldo recalculado", () => {
    const r = aplicarCompraNaProjecao(proj, { valorTotal: 2000, parcelas: 4, mesInicioISO: "2026-09" });
    expect(r.valorParcela).toBe(500);
    expect(r.meses.map(m => m.parcela)).toEqual([500, 500, 500, 500, 0]);
    // líquido 500 − parcela 500 = 0 nos 4 primeiros meses
    expect(r.meses.map(m => m.saldoFimCom)).toEqual([1000, 1000, 1000, 1000, 1500]);
    expect(r.mesesNegativos).toBe(0);
    expect(r.piorSaldo).toBe(1000);
  });

  it("início em mês futuro desloca a janela", () => {
    const r = aplicarCompraNaProjecao(proj, { valorTotal: 600, parcelas: 2, mesInicioISO: "2026-11" });
    expect(r.meses.map(m => m.parcela)).toEqual([0, 0, 300, 300, 0]);
    expect(r.meses[1].saldoFimCom).toBe(2000); // igual ao sem-compra até começar
  });

  it("à vista (1x) desconta tudo num mês só", () => {
    const r = aplicarCompraNaProjecao(proj, { valorTotal: 1800, parcelas: 1, mesInicioISO: "2026-09" });
    expect(r.meses[0].parcela).toBe(1800);
    expect(r.meses[0].saldoFimCom).toBe(1000 + 500 - 1800); // −300
    expect(r.mesesNegativos).toBe(1);
    expect(r.piorSaldo).toBe(-300);
    expect(r.piorMesLabel).toBe("Set");
  });
});
