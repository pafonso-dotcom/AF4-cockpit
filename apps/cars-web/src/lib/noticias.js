/**
 * Agente de Notícias (pedido 2026-10-02): você escolhe os temas/palavras-chave,
 * o app busca as novidades (via /api/noticias no Worker), ordena pelo que você
 * curte e mostra leitura rápida + leitura em voz alta das manchetes.
 */
const gn = (q) => `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:2d")}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;

export const TEMAS = [
  { id: "mercado",       icone: "📈", label: "Mercado",       feeds: ["https://www.infomoney.com.br/mercados/feed/", "https://www.moneytimes.com.br/feed/", gn("Ibovespa OR \"bolsa de valores\"")] },
  { id: "investimentos", icone: "💰", label: "Investimentos", feeds: [gn("investimentos OR dividendos OR \"renda fixa\" OR FIIs")] },
  { id: "economia",      icone: "🏦", label: "Economia",      feeds: ["https://g1.globo.com/rss/g1/economia/", gn("Selic OR inflação OR dólar")] },
  { id: "carros",        icone: "🚗", label: "Carros",        feeds: ["https://autoesporte.globo.com/rss/autoesporte/", "https://g1.globo.com/rss/g1/carros/"] },
  { id: "f1",            icone: "🏎️", label: "Fórmula 1",     feeds: ["https://ge.globo.com/rss/ge/motor/formula-1/", gn("\"Fórmula 1\"")] },
  { id: "viagens",       icone: "✈️", label: "Viagens",       feeds: ["https://g1.globo.com/rss/g1/turismo-e-viagem/", gn("turismo OR \"passagens aéreas\" OR viagem")] },
  { id: "tecnologia",    icone: "💻", label: "Tecnologia",    feeds: ["https://rss.tecmundo.com.br/feed", "https://g1.globo.com/rss/g1/tecnologia/"] },
  { id: "esportes",      icone: "⚽", label: "Esportes",      feeds: ["https://ge.globo.com/rss/ge/"] },
  { id: "politica",      icone: "🏛️", label: "Política",      feeds: ["https://g1.globo.com/rss/g1/politica/"] },
  { id: "mundo",         icone: "🌍", label: "Mundo",         feeds: ["https://g1.globo.com/rss/g1/mundo/"] },
];
export const TEMA_POR_ID = Object.fromEntries(TEMAS.map(t => [t.id, t]));

export const PREFS_PADRAO = { temas: ["mercado", "investimentos", "carros", "f1", "viagens", "tecnologia"], palavras: [], fontesBloq: [], gostos: {} };
const K_PREFS = "af4:noticias-prefs", K_VISTAS = "af4:noticias-vistas";
export function lerPrefs() { try { return { ...PREFS_PADRAO, ...JSON.parse(localStorage.getItem(K_PREFS) || "{}") }; } catch { return { ...PREFS_PADRAO }; } }
export function salvarPrefs(p) { try { localStorage.setItem(K_PREFS, JSON.stringify(p)); } catch {} }
export function lerVistas() { try { return new Set(JSON.parse(localStorage.getItem(K_VISTAS) || "[]")); } catch { return new Set(); } }
export function marcarVistas(links = []) {
  try {
    const v = [...lerVistas(), ...links];
    localStorage.setItem(K_VISTAS, JSON.stringify([...new Set(v)].slice(-600)));
  } catch {}
}

/** Lista de { feed, tema } a buscar pras preferências. */
export function feedsDasPrefs(prefs = PREFS_PADRAO) {
  const out = [];
  for (const id of prefs.temas || []) for (const f of TEMA_POR_ID[id]?.feeds || []) out.push({ feed: f, tema: id });
  for (const p of prefs.palavras || []) if (String(p).trim()) out.push({ feed: gn(`"${String(p).trim()}"`), tema: "palavra:" + String(p).trim() });
  return out;
}

const normTitulo = (t = "") => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim().slice(0, 70);

/**
 * Junta os resultados dos feeds: remove repetidas (mesmo título), tira fontes
 * bloqueadas e ordena por "relevância" = novidade + gosto pelo tema/fonte.
 */
export function montarBriefing(resultados = [], prefs = PREFS_PADRAO, agora = Date.now()) {
  const vistos = new Set();
  const bloq = new Set((prefs.fontesBloq || []).map(f => f.toLowerCase()));
  const gostos = prefs.gostos || {};
  const itens = [];
  for (const r of resultados) {
    for (const n of r.itens || []) {
      const k = normTitulo(n.titulo);
      if (!k || vistos.has(k)) continue;
      if (bloq.has(String(n.fonte || "").toLowerCase())) continue;
      vistos.add(k);
      const horas = n.data ? Math.max(0, (agora - new Date(n.data).getTime()) / 3600000) : 48;
      if (horas > 72) continue; // só novidade (até 3 dias)
      const gosto = (Number(gostos["tema:" + r.tema]) || 0) + (Number(gostos["fonte:" + n.fonte]) || 0);
      itens.push({ ...n, tema: r.tema, horas, score: gosto * 6 - horas });
    }
  }
  return itens.sort((a, b) => b.score - a.score);
}

/** 👍 / 👎 numa notícia: ajusta o peso do tema e da fonte (limitado a ±5). */
export function registrarGosto(prefs, noticia, delta) {
  const g = { ...(prefs.gostos || {}) };
  const lim = (v) => Math.max(-5, Math.min(5, v));
  if (noticia.tema) g["tema:" + noticia.tema] = lim((Number(g["tema:" + noticia.tema]) || 0) + delta);
  if (noticia.fonte) g["fonte:" + noticia.fonte] = lim((Number(g["fonte:" + noticia.fonte]) || 0) + delta);
  return { ...prefs, gostos: g };
}

export function haQuanto(horas) {
  if (horas == null) return "";
  if (horas < 1) return `há ${Math.max(1, Math.round(horas * 60))} min`;
  if (horas < 24) return `há ${Math.round(horas)}h`;
  const d = Math.round(horas / 24);
  return `há ${d} dia${d > 1 ? "s" : ""}`;
}

export const rotuloTema = (tema = "") => tema.startsWith("palavra:") ? `🔎 ${tema.slice(8)}` : `${TEMA_POR_ID[tema]?.icone || "📰"} ${TEMA_POR_ID[tema]?.label || tema}`;

// Busca no Worker com cache de 10 min na sessão (abrir o app = atualiza).
const K_CACHE = "af4:noticias-cache";
export async function buscarNoticias(prefs, { forcar = false } = {}) {
  const lista = feedsDasPrefs(prefs);
  const chave = JSON.stringify(lista.map(x => x.feed));
  if (!forcar) {
    try {
      const c = JSON.parse(sessionStorage.getItem(K_CACHE) || "null");
      if (c && c.chave === chave && Date.now() - c.ts < 10 * 60 * 1000) return { resultados: c.resultados, ts: c.ts };
    } catch {}
  }
  const qs = lista.map(x => "u=" + encodeURIComponent(x.feed)).join("&");
  const r = await fetch(`/api/noticias?${qs}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const temaDe = Object.fromEntries(lista.map(x => [x.feed, x.tema]));
  const resultados = (j.resultados || []).map(x => ({ ...x, tema: temaDe[x.feed] }));
  const ts = Date.now();
  try { sessionStorage.setItem(K_CACHE, JSON.stringify({ chave, ts, resultados })); } catch {}
  return { resultados, ts };
}
