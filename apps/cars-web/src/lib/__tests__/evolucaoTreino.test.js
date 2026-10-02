import { describe, it, expect } from "vitest";
import { resumoSessao, semanas, progressaoExercicio, seriesPorGrupo, analisarEvolucao } from "../evolucaoTreino.js";

const db = [{ id: "sup", nome: "Supino", grupoMuscular: "Peito" }, { id: "agc", nome: "Agachamento", grupoMuscular: "Pernas" }];
const sess = (data, carga, feita = true) => ({ data, modalidade: "musculacao", exerciciosFeitos: [
  { exercicioId: "sup", series: [{ reps: 10, carga, feita }, { reps: 10, carga, feita: false }] },
] });
const hoje = new Date(2026, 9, 2); // 02/10/2026 (sexta)

describe("evolução do treino", () => {
  it("volume conta só séries feitas (ou todas se nenhuma marcada)", () => {
    expect(resumoSessao(sess("2026-10-01", 50)).volume).toBe(500);
    expect(resumoSessao(sess("2026-10-01", 50, false)).volume).toBe(1000);
  });
  it("semanas e progressão", () => {
    const t = [sess("2026-09-15", 40), sess("2026-09-22", 45), sess("2026-09-29", 50)];
    const w = semanas(t, 4, hoje);
    expect(w.map(x => x.treinos)).toEqual([0, 1, 1, 1]);
    const p = progressaoExercicio(t, "sup");
    expect(p.map(x => x.carga)).toEqual([40, 45, 50]);
    expect(p[2].e1rm).toBe(67);
    expect(seriesPorGrupo(t, db, 30, hoje)).toEqual([{ grupo: "Peito", series: 3 }]);
  });
  it("análise aponta recorde e sequência", () => {
    const t = [sess("2026-09-15", 40), sess("2026-09-22", 45), sess("2026-09-29", 50)];
    const a = analisarEvolucao(t, db, hoje);
    expect(a.sequencia).toBe(3);
    expect(a.frases.some(f => f.txt.includes("Recorde") && f.txt.includes("Supino"))).toBe(true);
  });
});
