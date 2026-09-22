import { describe, it, expect } from "vitest";
import { normNomeExercicio, casarExercicio, montarImportacaoFicha } from "../fichaTreino.js";

const DB = [
  { id: "supino-reto", nome: "Supino Reto com Barra", modalidade: "musculacao", grupoMuscular: "peito" },
  { id: "agachamento", nome: "Agachamento Livre", modalidade: "musculacao", grupoMuscular: "pernas" },
];

describe("fichaTreino — casamento de exercícios", () => {
  it("normaliza acentos, caixa e pontuação", () => {
    expect(normNomeExercicio("  Rosca Direta (Barra W)! ")).toBe("rosca direta barra w");
  });

  it("casa por nome exato normalizado e por 'contém'", () => {
    expect(casarExercicio("supino reto com barra", DB)?.id).toBe("supino-reto");
    expect(casarExercicio("Agachamento", DB)?.id).toBe("agachamento");
    expect(casarExercicio("Remada curvada", DB)).toBeNull();
  });
});

describe("montarImportacaoFicha — JSON da IA vira templates", () => {
  const parsed = {
    fichas: [{
      nome: "Ficha A — Peito",
      exercicios: [
        { nome: "Supino reto com barra", grupoMuscular: "peito", series: 4, reps: 12, carga: 20, obs: "" },
        { nome: "Crucifixo inclinado", grupoMuscular: "peito", series: "3", reps: "12", carga: null, obs: "12-15 reps" },
      ],
    }, {
      // sem nome → vira "Ficha B" (2ª da lista)
      exercicios: [{ nome: "Crucifixo inclinado", grupoMuscular: "peito", series: 3, reps: 10 }],
    }],
  };

  it("casa com o banco, cria os que faltam e numeriza series/reps/carga", () => {
    const { templates, novosExercicios } = montarImportacaoFicha(parsed, DB, { agora: "2026-09-22T00:00:00Z" });
    expect(templates.length).toBe(2);
    expect(templates[0].nome).toBe("Ficha A — Peito");
    expect(templates[1].nome).toBe("Ficha B");
    expect(templates[0].exercicios[0]).toMatchObject({ exercicioId: "supino-reto", series: 4, reps: 12, carga: 20, ordem: 0 });
    expect(templates[0].exercicios[1]).toMatchObject({ series: 3, reps: 12, carga: 0, obs: "12-15 reps", ordem: 1 });
    // Crucifixo não existia → criado UMA vez e reusado na Ficha B
    expect(novosExercicios.length).toBe(1);
    expect(novosExercicios[0].nome).toBe("Crucifixo inclinado");
    expect(templates[1].exercicios[0].exercicioId).toBe(novosExercicios[0].id);
    expect(templates[0].modalidade).toBe("musculacao");
    expect(templates[0].importadoDe).toBe("ficha");
  });

  it("ficha vazia/asneira da IA não quebra", () => {
    expect(montarImportacaoFicha(null, DB).templates).toEqual([]);
    expect(montarImportacaoFicha({ fichas: [{ nome: "X", exercicios: [] }] }, DB).templates).toEqual([]);
  });
});
