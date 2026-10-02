/**
 * /api/noticias — busca feeds RSS no servidor (o navegador não consegue por
 * CORS) e devolve JSON já normalizado. Só hosts da lista abaixo (evita virar
 * proxy aberto). Cache de 10 min na borda da Cloudflare.
 *   GET /api/noticias?u=<feed1>&u=<feed2>…
 */
import { parseRSS } from "../apps/cars-web/src/lib/rss.js";

const PERMITIDOS = new Set([
  "news.google.com", "g1.globo.com", "ge.globo.com", "autoesporte.globo.com",
  "www.infomoney.com.br", "www.moneytimes.com.br", "rss.tecmundo.com.br",
  "www.cnnbrasil.com.br", "feeds.folha.uol.com.br", "www.estadao.com.br",
]);

export async function handleNoticias(request) {
  const url = new URL(request.url);
  const feeds = url.searchParams.getAll("u").slice(0, 20);
  const resultados = await Promise.all(feeds.map(async (f) => {
    let host = "";
    try { host = new URL(f).hostname; } catch { return { feed: f, erro: "url inválida", itens: [] }; }
    if (!PERMITIDOS.has(host)) return { feed: f, erro: "fonte não permitida", itens: [] };
    try {
      const r = await fetch(f, {
        headers: { "User-Agent": "Mozilla/5.0 (AF4 Noticias)", "Accept": "application/rss+xml, application/xml, text/xml" },
        cf: { cacheTtl: 600, cacheEverything: true },
      });
      if (!r.ok) return { feed: f, erro: `HTTP ${r.status}`, itens: [] };
      const xml = await r.text();
      return { feed: f, itens: parseRSS(xml).slice(0, 30) };
    } catch (e) {
      return { feed: f, erro: String(e && e.message || e), itens: [] };
    }
  }));
  return new Response(JSON.stringify({ resultados }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
  });
}
