// Catálogo aberto de exercícios (free-exercise-db, domínio público / Unlicense).
// Carregado em tempo real no navegador do usuário (com cache em localStorage),
// porque o ambiente de build não tem acesso à internet aberta.
//
// Cada item do dataset:
//   { id, name, force, level, mechanic, equipment, primaryMuscles[],
//     secondaryMuscles[], instructions[], category, images[] }
// As imagens são caminhos relativos (ex.: "Bench_Press/0.jpg").

const CDN = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main";
const JSON_URL = `${CDN}/dist/exercises.json`;
const CACHE_KEY = "af4:ex-catalogo:v1";
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 dias

// Monta a URL pública da imagem de execução a partir do caminho do dataset.
export const imagemCatalogo = (img) => (img ? `${CDN}/exercises/${img}` : "");

// Tradução leve de grupos musculares pro PT (cai no original se não mapear).
const MUSC_PT = {
  abdominals: "Abdômen", abductors: "Abdutores", adductors: "Adutores",
  biceps: "Bíceps", calves: "Panturrilha", chest: "Peito", forearms: "Antebraço",
  glutes: "Glúteos", hamstrings: "Posterior de coxa", lats: "Dorsais",
  "lower back": "Lombar", "middle back": "Costas (meio)", neck: "Pescoço",
  quadriceps: "Quadríceps", shoulders: "Ombros", traps: "Trapézio", triceps: "Tríceps",
};
export const grupoPT = (m) => MUSC_PT[(m || "").toLowerCase()] || (m || "Outros");

const EQUIP_PT = {
  barbell: "Barra", dumbbell: "Halteres", cable: "Cabo/Polia", machine: "Máquina",
  "body only": "Peso corporal", kettlebells: "Kettlebell", bands: "Elástico",
  "medicine ball": "Bola medicinal", "exercise ball": "Bola suíça",
  "e-z curl bar": "Barra W", "foam roll": "Rolo", other: "Outro",
};
export const equipamentoPT = (e) => EQUIP_PT[(e || "").toLowerCase()] || (e || "—");

let _cache = null;

function mapear(e) {
  return {
    id: `cat-${e.id}`,
    nome: e.name,
    grupoMuscular: grupoPT(e.primaryMuscles?.[0]),
    grupoOriginal: e.primaryMuscles?.[0] || "",
    equipamento: e.equipment || "",
    nivel: e.level || "",
    modalidade: e.category === "cardio" ? "corrida" : "musculacao",
    imagem: imagemCatalogo(e.images?.[0]),
    instrucoes: e.instructions || [],
    isCatalogo: true,
  };
}

// Carrega o catálogo (cache em memória + localStorage). Lança erro se offline/bloqueado.
export async function carregarCatalogo() {
  if (_cache) return _cache;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o?.ts && Date.now() - o.ts < CACHE_TTL && Array.isArray(o.data) && o.data.length) {
        _cache = o.data;
        return _cache;
      }
    }
  } catch { /* cache inválido: segue pro fetch */ }

  const res = await fetch(JSON_URL);
  if (!res.ok) throw new Error(`Catálogo indisponível (HTTP ${res.status})`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Formato inesperado do catálogo");
  _cache = data.map(mapear).sort((a, b) => a.nome.localeCompare(b.nome));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: _cache })); } catch { /* localStorage cheio: ok, fica só em memória */ }
  return _cache;
}
