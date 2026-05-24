/**
 * AF4 Cockpit Worker — sync de dados via Cloudflare KV.
 *
 * Roteamento:
 *  - /api/state  GET/PUT  — estado completo do app (contas, transações, etc)
 *  - /api/keys   GET/PUT  — chaves de API (Brapi, Gemini, etc)
 *  - /api/ping   GET      — health check
 *  - tudo o mais → static assets (SPA)
 *
 * Auth: Bearer token no header `Authorization`.
 *  - Cliente gera UUID na primeira vez e guarda em localStorage.
 *  - Mesmo token em outro dispositivo → vê os mesmos dados.
 *  - KV não tem ACL nativo, então o token É a chave de acesso. Quem tem o
 *    token tem acesso total. Trate-o como uma senha.
 *
 * Setup uma vez no Cloudflare Dashboard:
 *  1. Workers & Pages → KV → "Create a namespace" → nome `af4-state`
 *  2. Workers & Pages → af4cockpit → Settings → Variables and Secrets
 *     → KV namespace bindings → "Add binding"
 *     → variable name: `AF4_KV`, KV namespace: `af4-state`
 *  3. Pronto. Sem KV, o endpoint /api/* devolve 503.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function extractToken(request) {
  const h = request.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1].trim();
  // 16 chars min, alphanum + hífen
  if (!/^[A-Za-z0-9-]{16,128}$/.test(token)) return null;
  return token;
}

async function handleApi(request, env, url) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (url.pathname === "/api/ping") {
    return json({ ok: true, kv: !!env.AF4_KV, version: "2026-05-24-1" });
  }

  if (!env.AF4_KV) {
    return json({ error: "Sync indisponível: KV namespace não configurado no Worker." }, 503);
  }

  const token = extractToken(request);
  if (!token) {
    return json({ error: "Token inválido ou ausente." }, 401);
  }

  if (url.pathname === "/api/state" || url.pathname === "/api/keys") {
    const kind = url.pathname === "/api/state" ? "state" : "keys";
    const kvKey = `${kind}:${token}`;

    if (request.method === "GET") {
      // Lê como string e parseia aqui (evita crash silencioso se valor antigo não for JSON)
      let raw;
      try {
        raw = await env.AF4_KV.get(kvKey);
      } catch (e) {
        return json({ error: `KV.get falhou: ${e?.message || e}` }, 500);
      }
      if (raw == null) return json({ data: null });
      try {
        return json({ data: JSON.parse(raw) });
      } catch (e) {
        return json({ error: `Valor no KV não é JSON válido (${raw.length} bytes): ${e?.message || e}` }, 500);
      }
    }
    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); }
      catch (e) { return json({ error: `Body inválido (esperado JSON): ${e?.message || e}` }, 400); }
      let str;
      try { str = JSON.stringify(body); }
      catch (e) { return json({ error: `Não foi possível serializar o body: ${e?.message || e}` }, 400); }
      // Defesa: limita tamanho a 24MB (KV value max is 25MB)
      if (str.length > 24 * 1024 * 1024) {
        return json({ error: "Estado muito grande (>24MB)." }, 413);
      }
      try {
        await env.AF4_KV.put(kvKey, str);
      } catch (e) {
        return json({ error: `KV.put falhou: ${e?.message || e}` }, 500);
      }
      return json({ ok: true, bytes: str.length });
    }
    return json({ error: "Método não suportado." }, 405);
  }

  return json({ error: "Endpoint não encontrado." }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      try {
        return await handleApi(request, env, url);
      } catch (e) {
        console.error("[worker]", e?.stack || e?.message || e);
        return new Response(JSON.stringify({
          error: `Worker crash: ${e?.message || String(e)}`,
          stack: (e?.stack || "").split("\n").slice(0, 4).join(" | "),
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      }
    }

    // Static assets — mas força no-cache na HTML pra evitar JS antigo cacheado
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
