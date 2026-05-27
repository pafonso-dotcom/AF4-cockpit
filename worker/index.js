/**
 * AF4 Cockpit Worker — wrapper de static assets.
 *
 * Roteamento:
 *  - /api/ping                      → health check
 *  - /api/lotofacil/latest          → último concurso da Lotofácil (Caixa, com CORS)
 *  - /api/lotofacil/{numero}        → concurso específico
 *  - tudo o mais                    → static assets (SPA)
 *
 * Cron (configurado no wrangler do LOTOAI):
 *  - Aquece o cache de /api/lotofacil/latest logo após os horários de
 *    sorteio (seg/ter/qua/qui/sex/sáb 20:30 BRT = 23:30 UTC) para que o
 *    primeiro usuário a abrir o app não pague o roundtrip à Caixa.
 *
 * Sync de dados entre dispositivos é feito via GitHub Gist (lib/gistSync.js
 * no cliente) — o Worker não precisa armazenar nada.
 */

const VERSION = "2026-05-27-1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

/** Proxy para Lotofácil da Caixa, com CORS + cache na edge */
async function lotofacilProxy(ctx, path) {
  const upstream = path === "latest"
    ? "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/"
    : `https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/${path}`;

  const cache = caches.default;
  const cacheKey = new Request(upstream, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { ...Object.fromEntries(cached.headers), ...CORS },
    });
  }

  let upstreamRes;
  try {
    upstreamRes = await fetch(upstream, {
      headers: { "Accept": "application/json", "User-Agent": "LOTOAI-worker/1.0" },
      cf: { cacheTtl: 600, cacheEverything: true },
    });
  } catch (e) {
    return json({ error: "upstream unreachable", detail: String(e) }, 502, CORS);
  }
  if (!upstreamRes.ok) {
    return json({ error: "upstream failed", status: upstreamRes.status }, 502, CORS);
  }

  const data = await upstreamRes.json();
  const ttl = path === "latest" ? 600 : 86400;
  const normalized = {
    numero: data.numero,
    data: data.dataApuracao,
    dezenas: (data.listaDezenas || []).map(Number).sort((a, b) => a - b),
    acumulado: !!data.acumulado,
    premiacoes: data.listaRateioPremio || null,
  };
  const res = new Response(JSON.stringify(normalized), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${ttl}`,
      ...CORS,
    },
  });
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: CORS });
    }

    // Health check
    if (url.pathname === "/api/ping") {
      return json({ ok: true, version: VERSION }, 200, CORS);
    }

    // LOTOAI · proxy da Caixa para Lotofácil
    const lf = url.pathname.match(/^\/api\/lotofacil\/(latest|\d+)\/?$/);
    if (lf) return lotofacilProxy(ctx, lf[1]);

    // Endpoints /api/* antigos (state/keys) foram removidos — sync agora
    // é via GitHub Gist direto do cliente. Devolve 410 Gone pra qualquer
    // chamada residual.
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Endpoint descontinuado. Use sync via GitHub Gist." }, 410, CORS);
    }

    // Static assets — força no-cache no HTML
    const res = await env.ASSETS.fetch(request);
    const isHtml = (res.headers.get("content-type") || "").includes("text/html");
    if (isHtml) {
      const headers = new Headers(res.headers);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      headers.set("Pragma", "no-cache");
      return new Response(res.body, { status: res.status, headers });
    }
    return res;
  },

  /**
   * Cron trigger — invalida e re-aquece o cache de /api/lotofacil/latest.
   * Configurado no wrangler.lotoai.jsonc (apenas no worker do LOTOAI;
   * o af4cockpit não tem triggers e este handler é no-op pra ele).
   */
  async scheduled(event, env, ctx) {
    try {
      // Limpa a entrada antiga e força um fetch novo da Caixa
      const cacheKey = new Request(
        "https://servicebus2.caixa.gov.br/portaldeloterias/api/lotofacil/",
        { method: "GET" }
      );
      await caches.default.delete(cacheKey);
      const res = await lotofacilProxy(ctx, "latest");
      console.log(`[cron ${event.cron}] aqueceu latest → HTTP ${res.status}`);
    } catch (e) {
      console.warn(`[cron ${event?.cron}] falhou: ${e.message || e}`);
    }
  },
};
