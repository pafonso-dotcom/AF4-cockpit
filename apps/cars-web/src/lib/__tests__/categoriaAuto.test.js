import { describe, it, expect } from "vitest";
import { categoriaAuto } from "../autoCategorizar.js";

const cats = [
  { nome: "Alimentação", tipo: "despesa" },
  { nome: "Transporte", tipo: "despesa" },
  { nome: "Compra Internet", tipo: "despesa" },
  { nome: "Rendimentos", tipo: "receita" },
];

describe("categoriaAuto", () => {
  it("aprende com o histórico (descrição parecida, mesmo com códigos)", () => {
    const hist = [
      { tipo: "despesa", descricao: "IFD*Maestro Hamburgueria 123", categoria: "Alimentação" },
    ];
    expect(categoriaAuto({ descricao: "Maestro Hamburgueria" }, cats, hist)).toBe("Alimentação");
  });

  it("histórico vence a regra; o registro mais recente ensina", () => {
    const hist = [
      { tipo: "despesa", descricao: "AliExpress", categoria: "Compra Internet" },
      { tipo: "despesa", descricao: "AliExpress", categoria: "Transporte" }, // mais recente
    ];
    expect(categoriaAuto({ descricao: "AliExpress *991" }, cats, hist)).toBe("Transporte");
  });

  it("sem histórico cai nas regras por palavra-chave (só se a categoria existir)", () => {
    expect(categoriaAuto({ descricao: "POSTO SHELL BR 65" }, cats, [])).toBe("Transporte");
    expect(categoriaAuto({ descricao: "Netflix.com" }, cats, [])).toBeNull(); // "Assinaturas" não cadastrada
  });

  it("respeita o tipo e ignora histórico com categoria inválida/Outros", () => {
    const hist = [{ tipo: "despesa", descricao: "Mercadão Central", categoria: "Outros" }];
    expect(categoriaAuto({ descricao: "Mercadão Central" }, cats, hist)).toBe("Alimentação"); // regra "mercad"
    expect(categoriaAuto({ descricao: "HGLG11 · Rendimento", tipo: "receita" }, cats, [])).toBe("Rendimentos");
    expect(categoriaAuto({ descricao: "" }, cats, [])).toBeNull();
  });
});
