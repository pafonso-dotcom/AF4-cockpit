import { describe, it, expect } from "vitest";
import { grupoDoNome, sugerirAgrupamento, aplicarAgrupamento } from "../agruparCategorias.js";

const cat = (id, nome, extra = {}) => ({ id, nome, tipo: "despesa", ...extra });

describe("agruparCategorias — dicionário", () => {
  it("casa os nomes reais do print", () => {
    expect(grupoDoNome("IPTU")).toBe("Casa");
    expect(grupoDoNome("Tarifa pix")).toBe("Tarifas, Juros & Impostos");
    expect(grupoDoNome("TARIFA MANUTENCAO CONTA CORRENTE")).toBe("Tarifas, Juros & Impostos");
    expect(grupoDoNome("Mercado")).toBe("Alimentação");
    expect(grupoDoNome("Padaria")).toBe("Alimentação");
    expect(grupoDoNome("Internet / TV")).toBe("Assinaturas & Telecom");
    expect(grupoDoNome("IPVA")).toBe("Transporte");
    expect(grupoDoNome("Plano de Saúde")).toBe("Saúde");
    expect(grupoDoNome("Loterias e Apostas")).toBe("Lazer & Viagens");
    expect(grupoDoNome("Transf. Entre Bancos")).toBe("Movimentações");
    expect(grupoDoNome("Piscineiro / Jardineiro")).toBe("Casa");
    // "MercadoLivre" é Compras, NÃO Alimentação (ordem das regras)
    expect(grupoDoNome("MercadoLivre")).toBe("Compras");
    expect(grupoDoNome("Coisa Aleatória XYZ")).toBeNull();
  });
});

describe("sugerirAgrupamento", () => {
  it("agrupa raízes de despesa; pai homônimo vira paiExistente; quem já tem pai fica quieto", () => {
    const cats = [
      cat("1", "Mercado"), cat("2", "Padaria"), cat("3", "Restaurantes"),
      cat("4", "Transporte"), cat("5", "IPVA"), cat("6", "Combustível"),
      cat("7", "Já Agrupada", { parentId: "4" }),
      cat("8", "Salário", { tipo: "receita" }),
      cat("9", "Sem Padrão Nenhum"),
    ];
    const { grupos, soltas } = sugerirAgrupamento(cats);
    const ali = grupos.find(g => g.paiNome === "Alimentação");
    expect(ali.paiExistente).toBeNull();
    expect(ali.filhas.map(f => f.nome).sort()).toEqual(["Mercado", "Padaria", "Restaurantes"]);
    const tra = grupos.find(g => g.paiNome === "Transporte");
    expect(tra.paiExistente.id).toBe("4"); // "Transporte" é o próprio pai
    expect(tra.filhas.map(f => f.id).sort()).toEqual(["5", "6"]);
    expect(soltas.map(c => c.nome)).toEqual(["Sem Padrão Nenhum"]);
  });

  it("descarta grupo novo com 1 filha só; com pai existente, 1 filha basta", () => {
    const r1 = sugerirAgrupamento([cat("1", "Padaria")]);
    expect(r1.grupos).toEqual([]);
    expect(r1.soltas.map(c => c.nome)).toEqual(["Padaria"]);
    const r2 = sugerirAgrupamento([cat("1", "Alimentação"), cat("2", "Padaria")]);
    expect(r2.grupos.length).toBe(1);
    expect(r2.grupos[0].paiExistente.id).toBe("1");
  });
});

describe("aplicarAgrupamento", () => {
  it("cria pai que falta, seta parentId nas filhas e não toca no resto", () => {
    const cats = [cat("1", "Mercado", { cor: "#abc" }), cat("2", "Padaria"), cat("3", "Lazer")];
    const { grupos } = sugerirAgrupamento(cats);
    let n = 0;
    const r = aplicarAgrupamento(grupos, cats, () => `novo-${++n}`);
    expect(r.paisCriados).toBe(1);
    expect(r.filhasAgrupadas).toBe(2);
    const pai = r.categorias.find(c => c.nome === "Alimentação");
    expect(pai.id).toBe("novo-1");
    expect(pai.cor).toBe("#abc"); // herda da 1ª filha
    expect(r.categorias.find(c => c.id === "1").parentId).toBe("novo-1");
    expect(r.categorias.find(c => c.id === "2").parentId).toBe("novo-1");
    expect(r.categorias.find(c => c.id === "3").parentId).toBeUndefined();
  });

  it("com pai existente, usa o id dele (não cria novo)", () => {
    const cats = [cat("t", "Transporte"), cat("i", "IPVA")];
    const { grupos } = sugerirAgrupamento(cats);
    const r = aplicarAgrupamento(grupos, cats, () => "NUNCA");
    expect(r.paisCriados).toBe(0);
    expect(r.categorias.find(c => c.id === "i").parentId).toBe("t");
  });
});
