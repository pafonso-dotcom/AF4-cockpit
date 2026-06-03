/**
 * AF4 Cockpit Worker — wrapper de static assets.
 *
 * Roteamento:
 *  - /api/ping → health check (verifica se o Worker responde)
 *  - /api/recibo → extração de recibo por foto (Claude Vision; chave no Worker)
 *  - tudo o mais → static assets (SPA)
 *
 * Sync de dados entre dispositivos é feito via GitHub Gist (lib/gistSync.js
 * no cliente) — o Worker não precisa armazenar nada.
 *
 * O HTML é servido com Cache-Control: no-store pra que mudanças de deploy
 * cheguem ao usuário sem cache HTTP do navegador travar a versão antiga
 * (problema observado no iOS WebKit em *.workers.dev).
 */

import { handleRecibo } from "./recibo.js";

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

    // Extração de recibo por foto (Claude Vision — chave fica no Worker).
    if (url.pathname === "/api/recibo") {
      return handleRecibo(request, env);
    }

    // IA · Gemini (Análise de fatura, OCR, voz). Chave fica no Worker
    // (GEMINI_API_KEY como secret). O app envia o corpo do generateContent.
    if (url.pathname === "/api/gemini" && request.method === "POST") {
      if (!env.GEMINI_API_KEY) return json({ error: "Servidor sem GEMINI_API_KEY configurada." }, 500);
      try {
        const body = await request.text();
        const model = url.searchParams.get("model") || "gemini-2.5-flash";
        const g = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body }
        );
        return new Response(await g.text(), { status: g.status, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return json({ error: "Falha ao chamar o Gemini: " + (e.message || e) }, 502);
      }
    }

    // IA · Claude (Pergunte ao Claude). Chave fica no Worker (ANTHROPIC_API_KEY).
    if (url.pathname === "/api/ai-chat" && request.method === "POST") {
      if (!env.ANTHROPIC_API_KEY) return json({ error: "Servidor sem ANTHROPIC_API_KEY configurada." }, 500);
      try {
        const body = await request.text();
        const a = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body,
        });
        return new Response(await a.text(), { status: a.status, headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return json({ error: "Falha ao chamar o Claude: " + (e.message || e) }, 502);
      }
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
