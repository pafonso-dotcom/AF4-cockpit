/**
 * Importação de ficha de treino (PDF/foto do personal) — lógica pura.
 *
 * A IA lê o arquivo e devolve JSON com as fichas (A/B/C...); aqui a gente
 * casa cada exercício com o banco local (exerciciosDB) por nome — o que não
 * existir vira exercício novo — e monta os templates no formato do módulo
 * Treino ({ exercicioId, series, reps, carga, ordem }).
 */
import { uid } from "./format.js";

// Prompt enviado junto com o(s) arquivo(s) da ficha.
export const PROMPT_FICHA = `Você está lendo a FICHA DE TREINO de musculação montada por um personal trainer (foto ou PDF, pode ter mais de uma página e mais de uma ficha: A, B, C...).

Extraia TODAS as fichas/divisões encontradas. Retorne APENAS JSON válido neste formato:
{
  "fichas": [
    {
      "nome": "Ficha A — Peito e Tríceps",
      "exercicios": [
        { "nome": "Supino reto com barra", "grupoMuscular": "peito", "series": 4, "reps": 12, "carga": 20, "obs": "" }
      ]
    }
  ]
}

Regras:
- "series" e "reps" são NÚMEROS. Se a ficha disser "3x12-15", use series=3 e reps=12 e anote o intervalo em "obs" (ex.: "12-15 reps").
- "carga" em kg quando estiver escrita; senão 0.
- "grupoMuscular" em minúsculas (peito, costas, pernas, ombros, biceps, triceps, abdomen, gluteos, panturrilha, outros).
- "obs" guarda técnicas/observações (drop-set, rest-pause, cadência, descanso...). Vazio se não houver.
- Preserve a ordem dos exercícios como está na ficha.
- Se não houver nome de ficha, use "Ficha A", "Ficha B"... na ordem.`;

// Normaliza nome pra casar com o banco: minúsculas, sem acento, espaços únicos.
export function normNomeExercicio(s = "") {
  return String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

// Acha o exercício no banco local: match exato normalizado, senão um contém o outro.
export function casarExercicio(nome, exerciciosDB = []) {
  const alvo = normNomeExercicio(nome);
  if (!alvo) return null;
  const exato = exerciciosDB.find(e => normNomeExercicio(e.nome) === alvo);
  if (exato) return exato;
  return exerciciosDB.find(e => {
    const n = normNomeExercicio(e.nome);
    return n.length > 3 && alvo.length > 3 && (n.includes(alvo) || alvo.includes(n));
  }) || null;
}

/**
 * Converte o JSON da IA em templates prontos + exercícios novos a criar.
 * Retorna { templates, novosExercicios }. Não muta nada.
 */
export function montarImportacaoFicha(parsed, exerciciosDB = [], { agora = new Date().toISOString() } = {}) {
  const fichas = Array.isArray(parsed?.fichas) ? parsed.fichas : [];
  const novos = [];
  // banco "virtual" = banco real + novos já criados nesta importação
  const acharOuCriar = (nome, grupo) => {
    const doBanco = casarExercicio(nome, exerciciosDB) || casarExercicio(nome, novos);
    if (doBanco) return doBanco;
    const novo = {
      id: uid(),
      nome: String(nome || "").trim() || "Exercício",
      modalidade: "musculacao",
      grupoMuscular: String(grupo || "outros").toLowerCase() || "outros",
      origem: "ficha-importada",
    };
    novos.push(novo);
    return novo;
  };

  const templates = fichas
    .filter(f => Array.isArray(f?.exercicios) && f.exercicios.length > 0)
    .map((f, fi) => ({
      id: uid(),
      nome: String(f.nome || "").trim() || `Ficha ${String.fromCharCode(65 + fi)}`,
      modalidade: "musculacao",
      importadoDe: "ficha",
      createdAt: agora,
      exercicios: f.exercicios.map((ex, i) => {
        const base = acharOuCriar(ex.nome, ex.grupoMuscular);
        return {
          exercicioId: base.id,
          series: Math.max(1, Math.round(Number(ex.series) || 3)),
          reps: Math.max(1, Math.round(Number(ex.reps) || 12)),
          carga: Math.max(0, Number(ex.carga) || 0),
          obs: String(ex.obs || "").trim(),
          ordem: i,
        };
      }),
    }));

  return { templates, novosExercicios: novos };
}
