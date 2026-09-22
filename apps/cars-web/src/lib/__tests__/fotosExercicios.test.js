import { describe, it, expect } from "vitest";
import { acharImagemCatalogo, sugerirFotos } from "../fotosExercicios.js";

const CATALOGO = [
  { nome: "Barbell Bench Press - Medium Grip", imagem: "u/bench.jpg" },
  { nome: "Barbell Incline Bench Press", imagem: "u/incline.jpg" },
  { nome: "Pullups", imagem: "u/pullups.jpg" },
  { nome: "Side Lateral Raise", imagem: "u/lateral.jpg" },
  { nome: "Standing Calf Raises", imagem: "u/calf-em-pe.jpg" },
  { nome: "Seated Calf Raise", imagem: "u/calf-sentado.jpg" },
  { nome: "Leg Extensions", imagem: "u/extensora.jpg" },
  { nome: "Triceps Pushdown - Rope Attachment", imagem: "u/corda.jpg" },
  { nome: "Butterfly", imagem: "u/pecdeck.jpg" },
];

describe("fotosExercicios — casamento PT → catálogo EN", () => {
  it("casa os nomes clássicos de ficha", () => {
    expect(acharImagemCatalogo("Supino reto com barra", CATALOGO)).toBe("u/bench.jpg");
    expect(acharImagemCatalogo("Supino Inclinado", CATALOGO)).toBe("u/incline.jpg");
    expect(acharImagemCatalogo("Barra fixa", CATALOGO)).toBe("u/pullups.jpg");
    expect(acharImagemCatalogo("Elevação lateral com halteres", CATALOGO)).toBe("u/lateral.jpg");
    expect(acharImagemCatalogo("Tríceps corda", CATALOGO)).toBe("u/corda.jpg");
    expect(acharImagemCatalogo("Cadeira extensora", CATALOGO)).toBe("u/extensora.jpg");
    expect(acharImagemCatalogo("Crucifixo na máquina", CATALOGO)).toBe("u/pecdeck.jpg");
  });

  it("panturrilha: 'em pé' e 'sentado' vão pra máquina certa", () => {
    expect(acharImagemCatalogo("Elevação em pé (panturrilha)", CATALOGO)).toBe("u/calf-em-pe.jpg");
    expect(acharImagemCatalogo("Elevação sentado (panturrilha)", CATALOGO)).toBe("u/calf-sentado.jpg");
    // sem "(panturrilha)" no nome, o grupo muscular desempata
    expect(acharImagemCatalogo("Elevação sentado", CATALOGO, "panturrilha")).toBe("u/calf-sentado.jpg");
  });

  it("sem correspondência retorna vazio; nome EN direto funciona", () => {
    expect(acharImagemCatalogo("Exercício maluco xyz", CATALOGO)).toBe("");
    expect(acharImagemCatalogo("Pullups", CATALOGO)).toBe("u/pullups.jpg");
  });

  it("sugerirFotos só sugere pra quem não tem imagem e achou par", () => {
    const db = [
      { id: "1", nome: "Supino reto com barra", imagem: "" },
      { id: "2", nome: "Barra fixa", imagem: "ja-tem.jpg" },
      { id: "3", nome: "Exercício maluco xyz" },
    ];
    const s = sugerirFotos(db, CATALOGO);
    expect(s).toEqual([{ id: "1", nome: "Supino reto com barra", imagem: "u/bench.jpg" }]);
  });
});
