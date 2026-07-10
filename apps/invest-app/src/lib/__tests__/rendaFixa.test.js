import { describe, it, expect } from "vitest";
import {
  ehRendaFixa, temTaxaRF, rotuloTaxaRF, taxaMensalRF, valorBaseRF,
  rendimentoMesRF, resumoRendaFixa,
} from "../rendaFixa.js";

// CDI ~10,5% a.a. → ~0,8355% a.m. Uso um cdiMes fixo pra testes determinísticos.
const CDI_MES = 0.8355;
const SELIC_MES = 0.8355;
const IPCA_MES = 0.4;
const TAXAS = { cdiMes: CDI_MES, selicMes: SELIC_MES, ipcaMes: IPCA_MES };

describe("rendaFixa", () => {
  it("reconhece tipos de renda fixa", () => {
    expect(ehRendaFixa({ tipo: "cdb" })).toBe(true);
    expect(ehRendaFixa({ tipo: "tesouro" })).toBe(true);
    expect(ehRendaFixa({ tipo: "acao" })).toBe(false);
  });

  it("temTaxaRF exige indexador + taxa numérica", () => {
    expect(temTaxaRF({ tipo: "cdb", rfIndexador: "cdi", rfTaxa: 104.5 })).toBe(true);
    expect(temTaxaRF({ tipo: "cdb", rfIndexador: "cdi" })).toBe(false);
    expect(temTaxaRF({ tipo: "acao", rfIndexador: "cdi", rfTaxa: 100 })).toBe(false);
  });

  it("rótulos formatados", () => {
    expect(rotuloTaxaRF({ rfIndexador: "cdi", rfTaxa: 104.5 })).toBe("104,5% CDI");
    expect(rotuloTaxaRF({ rfIndexador: "selic", rfTaxa: 0.07 })).toBe("Selic + 0,07%");
    expect(rotuloTaxaRF({ rfIndexador: "ipca", rfTaxa: 5.5 })).toBe("IPCA + 5,5%");
    expect(rotuloTaxaRF({ rfIndexador: "pre", rfTaxa: 11 })).toBe("Pré 11%");
  });

  it("CDI: taxa mensal = cdiMes × %", () => {
    const tm = taxaMensalRF({ rfIndexador: "cdi", rfTaxa: 104.5 }, TAXAS);
    expect(tm).toBeCloseTo(CDI_MES * 1.045, 6);
  });

  it("Selic: soma o spread anual convertido pra mensal", () => {
    const tm = taxaMensalRF({ rfIndexador: "selic", rfTaxa: 0.07 }, TAXAS);
    const spreadMes = (Math.pow(1 + 0.07 / 100, 1 / 12) - 1) * 100;
    expect(tm).toBeCloseTo(SELIC_MES + spreadMes, 6);
  });

  it("Prefixado: só a taxa anual convertida pra mensal", () => {
    const tm = taxaMensalRF({ rfIndexador: "pre", rfTaxa: 12 }, TAXAS);
    expect(tm).toBeCloseTo((Math.pow(1.12, 1 / 12) - 1) * 100, 6);
  });

  it("rendimento do mês = valor de mercado × taxa mensal", () => {
    // 60.000 investido (qtd 1 × preço 60000) no CDI 104,5%.
    const ativo = { tipo: "cdb", rfIndexador: "cdi", rfTaxa: 104.5, qtd: 1, preco: 60000, pm: 60000 };
    expect(valorBaseRF(ativo)).toBe(60000);
    const esperado = 60000 * (CDI_MES * 1.045) / 100;
    expect(rendimentoMesRF(ativo, TAXAS)).toBeCloseTo(esperado, 4);
    // ~R$ 524/mês
    expect(rendimentoMesRF(ativo, TAXAS)).toBeGreaterThan(500);
    expect(rendimentoMesRF(ativo, TAXAS)).toBeLessThan(540);
  });

  it("aceita taxa com vírgula (pt-BR)", () => {
    const ativo = { tipo: "cdb", rfIndexador: "cdi", rfTaxa: "104,5", qtd: 1, preco: 60000 };
    expect(temTaxaRF(ativo)).toBe(true);
    expect(rotuloTaxaRF(ativo)).toBe("104,5% CDI");
    expect(taxaMensalRF(ativo, TAXAS)).toBeCloseTo(CDI_MES * 1.045, 6);
  });

  it("resumo inclui todos os RF (sem taxa entram com temTaxa=false) e só soma os com taxa", () => {
    const ativos = [
      { id: "a", tipo: "cdb", rfIndexador: "cdi", rfTaxa: 104.5, qtd: 1, preco: 60000 },
      { id: "b", tipo: "tesouro", rfIndexador: "selic", rfTaxa: 0.07, qtd: 1, preco: 20000 },
      { id: "c", tipo: "acao", qtd: 100, preco: 30 },          // não é RF → fora
      { id: "d", tipo: "cdb", qtd: 1, preco: 1000 },           // RF sem taxa → entra com temTaxa=false
    ];
    const r = resumoRendaFixa(ativos, TAXAS);
    expect(r.itens).toHaveLength(3);                            // a, b, d (não a "c")
    expect(r.itens.find(i => i.id === "d").temTaxa).toBe(false);
    expect(r.totalBase).toBe(80000);                           // só a+b
    expect(r.totalMes).toBeCloseTo(
      rendimentoMesRF(ativos[0], TAXAS) + rendimentoMesRF(ativos[1], TAXAS), 4);
    // ordenado por rendimento desc → CDB configurado (maior) primeiro
    expect(r.itens[0].id).toBe("a");
  });
});
