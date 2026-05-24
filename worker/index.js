/**
 * AF4 Cockpit Worker — wrapper de static assets.
 *
 * Roteamento:
 *  - /api/ping → health check (verifica se o Worker responde)
 *  - tudo o mais → static assets (SPA)
 *
 * Sync de dados entre dispositivos é feito via GitHub Gist (lib/gistSync.js
 * no cliente) — o Worker não precisa armazenar nada.
 *
 * O HTML é servido com Cache-Control: no-store pra que mudanças de deploy
 * cheguem ao usuário sem cache HTTP do navegador travar a versão antiga
 * (problema observado no iOS WebKit em *.workers.dev).
 */

const VERSION = "2026-05-24-2";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/api/ping") {
      return json({ ok: true, version: VERSION });
    }

    // Endpoints /api/* antigos (state/keys) foram removidos — sync agora
    // é via GitHub Gist direto do cliente. Devolve 410 Gone pra qualquer
    // chamada residual.
    if (url.pathname.startsWith("/api/")) {
      return json({ error: "Endpoint descontinuado. Use sync via GitHub Gist." }, 410);
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
};
