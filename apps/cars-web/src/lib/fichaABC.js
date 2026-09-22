/**
 * Treino ABC — ficha do personal LIDA PELO CLAUDE em 2026-09-22, a partir dos
 * 3 PDFs do "Guia Flexível de Treinos" (divisão push/pull/legs) enviados pelo
 * usuário. Fica embutida pra virar template com 1 toque no modal "Ficha do
 * personal" (a leitura por IA no celular estava lenta).
 *
 * Formato = mesmo JSON que a IA devolve (PROMPT_FICHA em fichaTreino.js);
 * passa pelo montarImportacaoFicha normal, com revisão antes de salvar.
 */
export const FICHA_ABC = {
  titulo: "Treino ABC",
  lidaEm: "2026-09-22",
  dados: {
    fichas: [
      {
        nome: "Treino ABC · A (peito/ombro/tríceps)",
        exercicios: [
          { nome: "Supino reto com barra", grupoMuscular: "peito", series: 3, reps: 8, carga: 0, obs: "intervalo 1-2min" },
          { nome: "Supino inclinado", grupoMuscular: "peito", series: 3, reps: 8, carga: 0, obs: "intervalo 1-2min" },
          { nome: "Crucifixo na máquina", grupoMuscular: "peito", series: 3, reps: 12, carga: 0, obs: "12-15 reps · intervalo 1min" },
          { nome: "Desenvolvimento Arnold", grupoMuscular: "ombros", series: 3, reps: 8, carga: 0, obs: "intervalo 1-2min" },
          { nome: "Elevação lateral com halteres", grupoMuscular: "ombros", series: 3, reps: 10, carga: 0, obs: "intervalo 1min" },
          { nome: "Tríceps corda", grupoMuscular: "triceps", series: 3, reps: 10, carga: 0, obs: "intervalo 1min" },
          { nome: "Tríceps francês", grupoMuscular: "triceps", series: 3, reps: 12, carga: 0, obs: "intervalo 1-2min" },
        ],
      },
      {
        nome: "Treino ABC · B (costas/bíceps)",
        exercicios: [
          { nome: "Barra fixa", grupoMuscular: "costas", series: 3, reps: 6, carga: 0, obs: "6-8 reps · intervalo 1-2min" },
          { nome: "Remada curvada", grupoMuscular: "costas", series: 3, reps: 8, carga: 0, obs: "8-10 reps · intervalo 1-2min" },
          { nome: "Pulldown com corda", grupoMuscular: "costas", series: 3, reps: 10, carga: 0, obs: "10-12 reps · intervalo 1min" },
          { nome: "Encolhimento com barra", grupoMuscular: "costas", series: 3, reps: 8, carga: 0, obs: "trapézio · intervalo 1min" },
          { nome: "Crucifixo invertido no pec deck", grupoMuscular: "ombros", series: 3, reps: 10, carga: 0, obs: "posterior de ombro · intervalo 1min" },
          { nome: "Rosca direta com barra", grupoMuscular: "biceps", series: 4, reps: 10, carga: 0, obs: "intervalo 1min" },
          { nome: "Rosca inversa", grupoMuscular: "biceps", series: 3, reps: 12, carga: 0, obs: "intervalo 1-2min" },
        ],
      },
      {
        nome: "Treino ABC · C (pernas)",
        exercicios: [
          { nome: "Agachamento livre", grupoMuscular: "pernas", series: 3, reps: 6, carga: 0, obs: "6-8 reps · intervalo 1-2min" },
          { nome: "Leg press", grupoMuscular: "pernas", series: 3, reps: 8, carga: 0, obs: "8-10 reps · intervalo 1min" },
          { nome: "Stiff", grupoMuscular: "pernas", series: 3, reps: 10, carga: 0, obs: "posterior · 10-12 reps · intervalo 1min" },
          { nome: "Avanço (passada)", grupoMuscular: "pernas", series: 3, reps: 8, carga: 0, obs: "8+8 (cada perna) · intervalo 1min" },
          { nome: "Mesa flexora", grupoMuscular: "pernas", series: 3, reps: 10, carga: 0, obs: "posterior · 10-12 reps · intervalo 1min" },
          { nome: "Cadeira extensora", grupoMuscular: "pernas", series: 3, reps: 10, carga: 0, obs: "quadríceps · intervalo 1min" },
          { nome: "Elevação em pé (panturrilha)", grupoMuscular: "panturrilha", series: 3, reps: 12, carga: 0, obs: "12-15 reps · intervalo 1min" },
          { nome: "Elevação sentado (panturrilha)", grupoMuscular: "panturrilha", series: 3, reps: 12, carga: 0, obs: "12-15 reps · intervalo 1min" },
        ],
      },
    ],
  },
};
