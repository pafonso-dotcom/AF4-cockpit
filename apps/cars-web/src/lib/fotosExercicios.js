/**
 * Banco de fotos automático dos exercícios (pedido 2026-09-22).
 *
 * O catálogo aberto (free-exercise-db) tem imagem de execução pra quase tudo,
 * mas os nomes são em INGLÊS — e o banco do usuário é em português. Este
 * dicionário casa os nomes PT mais comuns de academia com termos de busca do
 * catálogo; `sugerirFotos` devolve a imagem certa pra cada exercício sem foto.
 */

const norm = (s = "") =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// Regras PT → termos de busca EN, da mais específica pra mais genérica.
// `chaves`: todas precisam aparecer no nome PT; `termos`: buscados no catálogo em ordem.
const REGRAS = [
  // Peito
  { chaves: ["supino", "inclinado"], termos: ["barbell incline bench press", "incline bench press"] },
  { chaves: ["supino", "declinado"], termos: ["decline barbell bench press", "decline bench press"] },
  { chaves: ["supino", "halter"], termos: ["dumbbell bench press"] },
  { chaves: ["supino"], termos: ["barbell bench press - medium grip", "barbell bench press"] },
  { chaves: ["crucifixo", "invertido"], termos: ["reverse machine flyes", "reverse flyes"] },
  { chaves: ["crucifixo", "maquina"], termos: ["butterfly", "machine fly"] },
  { chaves: ["crucifixo", "inclinado"], termos: ["incline dumbbell flyes"] },
  { chaves: ["crucifixo"], termos: ["dumbbell flyes", "butterfly"] },
  { chaves: ["voador"], termos: ["butterfly", "machine fly"] },
  { chaves: ["crossover"], termos: ["cable crossover"] },
  { chaves: ["flexao"], termos: ["pushups", "push-up"] },
  { chaves: ["mergulho"], termos: ["dips - triceps version", "dips"] },
  { chaves: ["paralela"], termos: ["dips - chest version", "dips"] },
  // Costas
  { chaves: ["barra", "fixa"], termos: ["pullups", "chin-up"] },
  { chaves: ["puxada"], termos: ["wide-grip lat pulldown", "lat pulldown"] },
  { chaves: ["pulldown"], termos: ["straight-arm pulldown", "lat pulldown"] },
  { chaves: ["remada", "curvada"], termos: ["bent over barbell row"] },
  { chaves: ["remada", "baixa"], termos: ["seated cable rows"] },
  { chaves: ["remada", "unilateral"], termos: ["one-arm dumbbell row"] },
  { chaves: ["remada", "alta"], termos: ["upright barbell row"] },
  { chaves: ["remada", "cavalinho"], termos: ["t-bar row"] },
  { chaves: ["remada"], termos: ["bent over barbell row", "seated cable rows"] },
  { chaves: ["levantamento", "terra"], termos: ["barbell deadlift"] },
  { chaves: ["encolhimento"], termos: ["barbell shrug", "dumbbell shrug"] },
  { chaves: ["hiperextensao"], termos: ["hyperextensions (back extensions)", "hyperextension"] },
  // Ombros
  { chaves: ["arnold"], termos: ["arnold dumbbell press"] },
  { chaves: ["desenvolvimento", "halter"], termos: ["dumbbell shoulder press"] },
  { chaves: ["desenvolvimento"], termos: ["barbell shoulder press", "standing military press"] },
  { chaves: ["militar"], termos: ["standing military press", "barbell shoulder press"] },
  { chaves: ["elevacao", "lateral"], termos: ["side lateral raise"] },
  { chaves: ["elevacao", "frontal"], termos: ["front dumbbell raise", "front two-dumbbell raise"] },
  // Bíceps
  { chaves: ["rosca", "inversa"], termos: ["reverse barbell curl"] },
  { chaves: ["rosca", "martelo"], termos: ["hammer curls"] },
  { chaves: ["rosca", "alternada"], termos: ["dumbbell alternate bicep curl"] },
  { chaves: ["rosca", "scott"], termos: ["preacher curl"] },
  { chaves: ["rosca", "concentrada"], termos: ["concentration curls"] },
  { chaves: ["rosca", "w"], termos: ["ez-bar curl", "barbell curl"] },
  { chaves: ["rosca"], termos: ["barbell curl"] },
  // Tríceps
  { chaves: ["triceps", "corda"], termos: ["triceps pushdown - rope attachment", "triceps pushdown"] },
  { chaves: ["triceps", "frances"], termos: ["standing dumbbell triceps extension", "triceps extension"] },
  { chaves: ["triceps", "testa"], termos: ["lying triceps press", "ez-bar skullcrusher"] },
  { chaves: ["triceps", "banco"], termos: ["bench dips"] },
  { chaves: ["triceps"], termos: ["triceps pushdown"] },
  // Pernas
  { chaves: ["agachamento", "smith"], termos: ["smith machine squat"] },
  { chaves: ["agachamento", "hack"], termos: ["hack squat"] },
  { chaves: ["agachamento", "sumo"], termos: ["sumo squat", "plie dumbbell squat"] },
  { chaves: ["agachamento", "bulgaro"], termos: ["one leg barbell squat", "split squat"] },
  { chaves: ["agachamento"], termos: ["barbell full squat", "barbell squat"] },
  { chaves: ["leg", "press"], termos: ["leg press"] },
  { chaves: ["stiff"], termos: ["stiff-legged barbell deadlift", "romanian deadlift"] },
  { chaves: ["avanco"], termos: ["barbell lunge", "dumbbell lunges"] },
  { chaves: ["passada"], termos: ["barbell lunge", "bodyweight walking lunge"] },
  { chaves: ["afundo"], termos: ["dumbbell lunges", "barbell lunge"] },
  { chaves: ["mesa", "flexora"], termos: ["lying leg curls"] },
  { chaves: ["cadeira", "flexora"], termos: ["seated leg curl"] },
  { chaves: ["cadeira", "extensora"], termos: ["leg extensions"] },
  { chaves: ["extensora"], termos: ["leg extensions"] },
  { chaves: ["flexora"], termos: ["lying leg curls", "seated leg curl"] },
  { chaves: ["adutora"], termos: ["thigh adductor"] },
  { chaves: ["abdutora"], termos: ["thigh abductor"] },
  { chaves: ["gluteo", "polia"], termos: ["glute kickback"] },
  { chaves: ["hip", "thrust"], termos: ["barbell glute bridge", "butt lift (bridge)"] },
  { chaves: ["elevacao", "pelvica"], termos: ["butt lift (bridge)", "barbell glute bridge"] },
  // Panturrilha (as "elevações" de panturrilha vêm antes das elevações de ombro
  // porque têm 2 chaves — regra: mais específica primeiro na lista)
  { chaves: ["panturrilha", "sentado"], termos: ["seated calf raise"] },
  { chaves: ["panturrilha", "leg press"], termos: ["calf press on the leg press machine"] },
  { chaves: ["panturrilha"], termos: ["standing calf raises"] },
  { chaves: ["gemeos"], termos: ["standing calf raises"] },
  // Abdômen
  { chaves: ["prancha"], termos: ["plank"] },
  { chaves: ["abdominal", "infra"], termos: ["hanging leg raise", "flat bench lying leg raise"] },
  { chaves: ["abdominal", "obliquo"], termos: ["oblique crunches"] },
  { chaves: ["abdominal"], termos: ["crunches"] },
  { chaves: ["elevacao", "perna"], termos: ["hanging leg raise", "flat bench lying leg raise"] },
];

// "Elevação em pé/sentado" sem dizer músculo = panturrilha (uso comum em ficha).
const REGRAS_CONTEXTO_PANTURRILHA = [
  { chaves: ["elevacao", "sentado"], termos: ["seated calf raise"] },
  { chaves: ["elevacao", "em pe"], termos: ["standing calf raises"] },
];

// Acha a URL de imagem no catálogo pro nome PT dado. Retorna "" se não achar.
export function acharImagemCatalogo(nomePT, catalogo = [], grupoMuscular = "") {
  const n = norm(nomePT);
  if (!n || !catalogo.length) return "";
  const buscar = (termos) => {
    for (const t of termos) {
      const alvo = norm(t);
      const exato = catalogo.find(c => norm(c.nome) === alvo && c.imagem);
      if (exato) return exato.imagem;
      const parcial = catalogo.find(c => norm(c.nome).includes(alvo) && c.imagem);
      if (parcial) return parcial.imagem;
    }
    return "";
  };
  const grupo = norm(grupoMuscular);
  const regras = (grupo.includes("panturrilha") || grupo.includes("perna"))
    ? [...REGRAS_CONTEXTO_PANTURRILHA, ...REGRAS]
    : REGRAS;
  for (const r of regras) {
    if (r.chaves.every(c => n.includes(c))) {
      const img = buscar(r.termos);
      if (img) return img;
    }
  }
  // Último recurso: o nome já é (ou contém) o nome EN do catálogo.
  return buscar([nomePT]);
}

/**
 * Sugestões de foto pros exercícios SEM imagem.
 * Retorna [{ id, nome, imagem }] só dos que acharam correspondência.
 */
export function sugerirFotos(exerciciosDB = [], catalogo = []) {
  return (exerciciosDB || [])
    .filter(e => e && !e.imagem)
    .map(e => ({ id: e.id, nome: e.nome, imagem: acharImagemCatalogo(e.nome, catalogo, e.grupoMuscular) }))
    .filter(s => s.imagem);
}
