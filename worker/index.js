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
    return json({ ok: true, kv: !!env.AF4_KV });
  }

  if (!env.AF4_KV) {
    return json({ error: "Sync indisponível: KV namespace não configurado no Worker." }, 503);
  }

  const token = extractToken(request);
  if (!token) {
    return json({ error: "Token inválido ou ausente." }, 401);
  }

  if (url.pathname === "/api/state" || url.pathname === "/api/keys") {
    const kvKey = `${url.pathname.slice(5)}:${token}`; // "state:xxx" ou "keys:xxx"

    if (request.method === "GET") {
      const data = await env.AF4_KV.get(kvKey, "json");
      return json({ data: data ?? null });
    }
    if (request.method === "PUT") {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: "Body inválido (esperado JSON)." }, 400); }
      // Defesa: limita tamanho a 24MB (KV value max is 25MB)
      const str = JSON.stringify(body);
      if (str.length > 24 * 1024 * 1024) {
        return json({ error: "Estado muito grande (>24MB)." }, 413);
      }
      await env.AF4_KV.put(kvKey, str);
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
      return handleApi(request, env, url);
    }

    // Tudo o resto → static assets
    return env.ASSETS.fetch(request);
  },
};
