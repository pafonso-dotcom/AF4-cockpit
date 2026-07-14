import { describe, it, expect } from "vitest";
import { sugerirCategorias, precisaCategoria } from "../autoCategorizar.js";

const CAT = [
  { nome: "Taxas Bancos", tipo: "despesa" },
  { nome: "Alimentação", tipo: "despesa" },
  { nome: "Investimento", tipo: "despesa" },
  { nome: "Moradia", tipo: "despesa" },
];
const tx = (id, descricao, categoria, valor = 10, tipo = "despesa") => ({ id, descricao, categoria, valor, tipo });

describe("precisaCategoria", () => {
  const nomes = new Set(CAT.map((c) => c.nome));
  it("Outros, vazia e órfã precisam; válida não", () => {
    expect(precisaCategoria(tx(1, "x", "Outros"), nomes)).toBe(true);
    expect(precisaCategoria(tx(2, "x", ""), nomes)).toBe(true);
    expect(precisaCategoria(tx(3, "x", "CategoriaInexistente"), nomes)).toBe(true);
    expect(precisaCategoria(tx(4, "x", "Moradia"), nomes)).toBe(false);
  });
});

describe("sugerirCategorias", () => {
  it("sugere pela descrição só pras que precisam, agrupando", () => {
    const t = [
      tx(1, "Tarifa pix", "Outros"),
      tx(2, "MERCADINHO SONODA ITAPETININGA", "Outros"),
      tx(3, "Debito Aut. Titulo Capitalizacao ICI", "Outros"),
      tx(4, "PAULO FRALETTI OZI", "Outros"),      // sem regra
      tx(5, "Aluguel do mês", "Moradia"),         // já válida → ignora
    ];
    const r = sugerirCategorias(t, CAT);
    const mapa = Object.fromEntries(r.sugestoes.map((s) => [s.id, s.sugerida]));
    expect(mapa[1]).toBe("Taxas Bancos");
    expect(mapa[2]).toBe("Alimentação");
    expect(mapa[3]).toBe("Investimento");
    expect(mapa[4]).toBeUndefined();     // sem sugestão
    expect(mapa[5]).toBeUndefined();     // já categorizada
    expect(r.semSugestao).toBe(1);
    expect(r.porCategoria["Taxas Bancos"]).toHaveLength(1);
  });

  it("não sugere categoria que não existe no cadastro", () => {
    const semAlim = CAT.filter((c) => c.nome !== "Alimentação");
    const r = sugerirCategorias([tx(1, "MERCADINHO SONODA", "Outros")], semAlim);
    expect(r.sugestoes).toHaveLength(0);
    expect(r.semSugestao).toBe(1);
  });

  it("não mexe em quem já está na categoria certa", () => {
    const r = sugerirCategorias([tx(1, "Tarifa pix", "Taxas Bancos")], CAT);
    expect(r.sugestoes).toHaveLength(0);
  });
});

describe("regras de extrato bancário (transferências, proventos, energia)", () => {
  const CAD = [
    { nome: "Taxas Bancos", tipo: "despesa" },
    { nome: "Transferência", tipo: "despesa" },
    { nome: "Rendimentos", tipo: "receita" },
    { nome: "Energia", tipo: "despesa" },
    { nome: "Investimento", tipo: "despesa" },
  ];
  const mapaDe = (r) => Object.fromEntries(r.sugestoes.map((s) => [s.id, s.sugerida]));

  it("transferências viram Transferência (saem do gasto)", () => {
    const t = [
      tx(1, "Transferência de SANTANDER", "Outros", 5000),
      tx(2, "Transferência para XP - Banco", "Outros", 3000),
      tx(3, "Transferência enviada para conta investimento", "Outros", 2000),
    ];
    const r = sugerirCategorias(t, CAD);
    const m = mapaDe(r);
    expect(m[1]).toBe("Transferência");
    expect(m[2]).toBe("Transferência");
    expect(m[3]).toBe("Transferência");
  });

  it("proventos (receita) viram Rendimentos", () => {
    const t = [
      tx(1, "RECR11 · Rendimento", "Outros", 60, "receita"),
      tx(2, "REND PAGO APLIC AUT MAIS", "Outros", 12, "receita"),
    ];
    const m = mapaDe(sugerirCategorias(t, CAD));
    expect(m[1]).toBe("Rendimentos");
    expect(m[2]).toBe("Rendimentos");
  });

  it("IRRF/CBLC (DESPESA com a palavra 'rendimento') vai pra Taxas, não Rendimentos", () => {
    const t = [tx(1, "DEBITO CBLC IRRF S/ RENDIMENTO DE BTC B3SA", "Outros", 0.03, "despesa")];
    const m = mapaDe(sugerirCategorias(t, CAD));
    expect(m[1]).toBe("Taxas Bancos");
  });

  it("conta de energia (CERIPA) vai pra Energia", () => {
    const t = [tx(1, "INT/CERIPA 19416590", "Outros", 180)];
    const m = mapaDe(sugerirCategorias(t, CAD));
    expect(m[1]).toBe("Energia");
  });
});
