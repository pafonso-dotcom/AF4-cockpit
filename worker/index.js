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

    // Índices da bolsa via Yahoo Finance (proxy server-side — sem CORS, sem
    // token). Devolve no formato compatível com brapi (results[]).
    if (url.pathname === "/api/indices") {
      const symbols = ["^BVSP", "^GSPC", "^IXIC"];
      const nomes = { "^BVSP": "IBOVESPA", "^GSPC": "S&P 500", "^IXIC": "NASDAQ" };
      try {
        const results = await Promise.all(symbols.map(async (sym) => {
          try {
            const r = await fetch(
              `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`,
              { headers: { "User-Agent": "Mozilla/5.0" } }
            );
            const j = await r.json();
            const meta = j?.chart?.result?.[0]?.meta || {};
            const price = meta.regularMarketPrice;
            const prev = meta.chartPreviousClose ?? meta.previousClose;
            const changePercent = (price != null && prev) ? ((price - prev) / prev) * 100 : 0;
            return {
              symbol: sym,
              shortName: nomes[sym] || sym,
              longName: nomes[sym] || sym,
              regularMarketPrice: price,
              regularMarketChangePercent: changePercent,
            };
          } catch { return null; }
        }));
        return json({ results: results.filter(x => x && x.regularMarketPrice != null) });
      } catch (e) {
        return json({ results: [], error: String(e && e.message || e) }, 502);
      }
    }

    // Consulta de placa via APIBrasil (proxy server-side — token fica no
    // Worker, sem CORS, sem expor credencial no front).
    // Secrets/vars do Worker:
    //  - APIBRASIL_BEARER       : token Bearer da conta APIBrasil (obrigatório)
    //  - APIBRASIL_DEVICE_TOKEN : DeviceToken (opcional; enviado só se definido)
    //  - PLACA_API_URL          : (opcional) override do endpoint; default abaixo.
    if (url.pathname === "/api/placa") {
      const placa = (url.searchParams.get("placa") || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!placa) return json({ ok: false, error: "Informe a placa." }, 400);
      if (!env.APIBRASIL_BEARER) {
        return json({ ok: false, error: "Consulta de placa não configurada no servidor (defina o secret APIBRASIL_BEARER no Worker)." }, 501);
      }
      const alvo = env.PLACA_API_URL || "https://gateway.apibrasil.io/api/v2/vehicles/dados";
      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Bearer ${env.APIBRASIL_BEARER}`,
      };
      if (env.APIBRASIL_DEVICE_TOKEN) headers["DeviceToken"] = env.APIBRASIL_DEVICE_TOKEN;
      try {
        const r = await fetch(alvo, {
          method: "POST",
          headers,
          body: JSON.stringify({ placa }),
        });
        const txt = await r.text();
        let data; try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
        return json({ ok: r.ok, status: r.status, data }, r.ok ? 200 : 502);
      } catch (e) {
        return json({ ok: false, error: String(e && e.message || e) }, 502);
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
