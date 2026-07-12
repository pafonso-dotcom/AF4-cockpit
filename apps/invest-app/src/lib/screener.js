// Screener de mercado — universo completo da B3 com UMA requisição.
// A brapi `/api/quote/list` devolve todos os tickers (ações, FIIs, BDRs) com
// preço, variação, volume, market cap e setor num único request — cabe no
// plano free. Filtros/ordenação rodam client-side; o cache local (24h) evita
// bater na API a cada visita. Fundamentos profundos (DY/P-L) continuam sendo
// 1 req/ticker — por isso só via enriquecimento manual do top N.

const KEY_CACHE = "af4:screener-lista:v1";
const TTL_MS = 24 * 60 * 60 * 1000;

/** Normaliza a resposta da brapi pra um shape estável. Descarta itens sem preço. */
export function normalizarLista(raw) {
  const stocks = raw?.stocks;
  if (!Array.isArray(stocks)) return [];
  return stocks
    .filter((s) => s && s.stock && s.close != null && Number(s.close) > 0)
    .map((s) => ({
      ticker: String(s.stock).toUpperCase(),
      nome: s.name || "",
      preco: Number(s.close),
      variacaoPct: Number.isFinite(Number(s.change)) ? Number(s.change) : null,
      volume: Number(s.volume) || 0,
      marketCap: Number.isFinite(Number(s.market_cap)) ? Number(s.market_cap) : null,
      setor: s.sector || "",
      tipo: s.type || "stock", // stock | fund | bdr
      logo: s.logo || "",
    }));
}

/**
 * Filtra e ordena client-side.
 * filtros: { busca, tipo, setor, precoMin, precoMax, volumeMin, variacaoMin,
 *            variacaoMax, marketCapMin, ordenarPor, direcao }
 */
export function filtrarOrdenar(lista = [], filtros = {}) {
  const {
    busca = "", tipo = "todos", setor = "",
    precoMin = null, precoMax = null, volumeMin = null,
    variacaoMin = null, variacaoMax = null, marketCapMin = null,
    plMax = null, pvpMax = null, roeMin = null,
    ordenarPor = "volume", direcao = "desc",
  } = filtros;

  const q = busca.trim().toLowerCase();
  let out = lista.filter((x) => {
    if (tipo !== "todos" && x.tipo !== tipo) return false;
    if (setor && x.setor !== setor) return false;
    if (q && !x.ticker.toLowerCase().includes(q) && !x.nome.toLowerCase().includes(q)) return false;
    if (precoMin != null && x.preco < precoMin) return false;
    if (precoMax != null && x.preco > precoMax) return false;
    if (volumeMin != null && x.volume < volumeMin) return false;
    if (variacaoMin != null && (x.variacaoPct == null || x.variacaoPct < variacaoMin)) return false;
    if (variacaoMax != null && (x.variacaoPct == null || x.variacaoPct > variacaoMax)) return false;
    if (marketCapMin != null && (x.marketCap == null || x.marketCap < marketCapMin)) return false;
    if (plMax != null && !(x.pl != null && x.pl > 0 && x.pl <= plMax)) return false;
    if (pvpMax != null && !(x.pvp != null && x.pvp > 0 && x.pvp <= pvpMax)) return false;
    if (roeMin != null && !(x.roe != null && x.roe >= roeMin)) return false;
    return true;
  });

  const dir = direcao === "asc" ? 1 : -1;
  out.sort((a, b) => {
    const va = a[ordenarPor], vb = b[ordenarPor];
    if (typeof va === "string") return va.localeCompare(vb) * dir;
    return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir;
  });
  return out;
}

/** Setores únicos presentes na lista (pra popular o filtro). */
export function setoresDaLista(lista = []) {
  return [...new Set(lista.map((x) => x.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Indicadores fundamentalistas de um result da brapi (fundamental/modules).
 * ROE normalizado pra % (Yahoo às vezes manda fração 0.271, às vezes 27.1).
 */
export function indicadoresDoResultado(r) {
  const out = { pl: null, pvp: null, roe: null, evEbitda: null };
  if (!r || typeof r !== "object") return out;
  const ks = r.defaultKeyStatistics || {};
  const fin = r.financialData || {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
  out.pl = num(r.priceEarnings) ?? num(ks.trailingPE) ?? num(ks.forwardPE);
  out.pvp = num(ks.priceToBook);
  const roeRaw = num(fin.returnOnEquity);
  out.roe = roeRaw == null ? null : Math.round((Math.abs(roeRaw) < 1 ? roeRaw * 100 : roeRaw) * 10) / 10;
  out.evEbitda = num(ks.enterpriseToEbitda);
  return out;
}

/** Divide uma lista em lotes de N (a brapi paga aceita 20 tickers/req). */
export function lotes(arr = [], n = 20) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/* ---------- Cache local da lista ---------- */
export function lerCacheLista() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY_CACHE) || "null");
    if (c && Array.isArray(c.lista)) return c;
  } catch {}
  return null;
}
export function cacheValido(cache) {
  return !!(cache && Date.now() - cache.fetchedAt < TTL_MS);
}
export function gravarCacheLista(lista) {
  const c = { fetchedAt: Date.now(), lista };
  try { localStorage.setItem(KEY_CACHE, JSON.stringify(c)); } catch {}
  return c;
}

/* ---------- Prompts pra camada de IA ---------- */

/** Traduz uma pergunta em linguagem natural pra um objeto de filtros. */
export function montarPromptFiltros(pergunta, setores = []) {
  return `Você converte perguntas de um investidor brasileiro em filtros de um screener de ações/FIIs/BDRs da B3.

Filtros disponíveis (JSON): {
  "busca": "<texto no ticker/nome, ou vazio>",
  "tipo": "<todos|stock|fund|bdr>"  // fund = FII
  "setor": "<um destes ou vazio: ${setores.join("; ")}>",
  "precoMin": <número ou null>, "precoMax": <número ou null>,
  "volumeMin": <número ou null>,
  "variacaoMin": <% ou null>, "variacaoMax": <% ou null>,
  "marketCapMin": <número ou null>,
  "plMax": <número ou null>,   // P/L máximo (ex.: "P/L abaixo de 10" → 10)
  "pvpMax": <número ou null>,  // P/VP máximo (ex.: "P/VP menor que 1" → 1)
  "roeMin": <% ou null>,       // ROE mínimo (ex.: "ROE acima de 15%" → 15)
  "ordenarPor": "<volume|preco|variacaoPct|dy|pl|pvp|roe|marketCap|ticker>",  // dy/pl/pvp/roe só têm valor pra papéis já enriquecidos
  "direcao": "<asc|desc>"
}

Pergunta: "${pergunta}"

Responda APENAS o JSON dos filtros, sem texto fora dele. Campos não mencionados ficam com o valor neutro (busca "", tipo "todos", setor "", números null).`;
}

/** Análise da shortlist filtrada — parecer curto por papel. */
export function montarPromptShortlist(lista, pergunta = "") {
  const compacta = lista.slice(0, 15).map((x) => ({
    ticker: x.ticker, nome: x.nome, tipo: x.tipo, setor: x.setor,
    preco: x.preco, variacaoPct: x.variacaoPct, volume: x.volume, marketCap: x.marketCap,
    ...(x.dy != null ? { dyPct: Math.round(x.dy * 10) / 10 } : {}),
    ...(x.pl != null ? { pl: x.pl } : {}),
    ...(x.pvp != null ? { pvp: x.pvp } : {}),
    ...(x.roe != null ? { roePct: x.roe } : {}),
  }));
  return `Você é um analista de investimentos brasileiro, direto e cético. Abaixo, uma shortlist de papéis da B3 filtrada pelo investidor${pergunta ? ` (critério dele: "${pergunta}")` : ""}.

PAPÉIS (dados reais de mercado):
${JSON.stringify(compacta, null, 1)}

Pra cada papel, dê um parecer de UMA frase (o que é, ponto forte ou alerta — cite números dos dados quando relevante) e uma nota 0-10 de "merece pesquisa mais profunda". Não invente fundamentos que não estão nos dados; se faltar informação, diga o que checar.

Responda APENAS JSON válido:
{ "analises": [{ "ticker": "<>", "nota": <0-10>, "parecer": "<1 frase>" }, ...], "resumo": "<2 frases sobre o conjunto>" }
Ferramenta educacional, não recomendação formal.`;
}
