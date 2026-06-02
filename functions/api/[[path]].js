/**
 * Proxy de APIs (Cloudflare Pages Function) — esconde as chaves no servidor.
 *
 * O frontend chama /api/<serviço>/... e este Worker injeta a chave guardada
 * nas variáveis de ambiente do Cloudflare (Settings → Environment variables):
 *   - BRAPI_TOKEN       → cotações de ações/FIIs BR (brapi.dev)
 *   - ALPHAVANTAGE_KEY  → ações dos EUA (alphavantage.co)
 *   - ANTHROPIC_KEY     → IA (Claude) — "Monte sua carteira", análises
 *
 * Whitelist por serviço (não é um proxy aberto).
 */
export async function onRequest(context) {
  const { request, env, params } = context;
  const seg = params.path || [];
  const service = seg[0];
  const rest = seg.slice(1).join("/");
  const qs = new URL(request.url).search; // "?...." ou ""

  try {
    if (service === "brapi") {
      const token = env.BRAPI_TOKEN || "";
      const sep = qs ? "&" : "?";
      const target = `https://brapi.dev/api/${rest}${qs}${token ? `${sep}token=${encodeURIComponent(token)}` : ""}`;
      return passthrough(await fetch(target, { headers: { Accept: "application/json" } }));
    }

    if (service === "alphavantage") {
      const key = env.ALPHAVANTAGE_KEY || "";
      const sep = qs ? "&" : "?";
      const target = `https://www.alphavantage.co/${rest || "query"}${qs}${key ? `${sep}apikey=${encodeURIComponent(key)}` : ""}`;
      return passthrough(await fetch(target));
    }

    if (service === "anthropic") {
      const key = env.ANTHROPIC_KEY || "";
      if (!key) return json({ error: "IA indisponível: ANTHROPIC_KEY não configurada no servidor." }, 503);
      const body = await request.text();
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
        },
        body,
      });
      return passthrough(r);
    }

    if (service === "gemini") {
      // /api/gemini/<model>:generateContent  → injeta a GEMINI_KEY do servidor.
      const key = env.GEMINI_KEY || "";
      if (!key) return json({ error: "IA indisponível: GEMINI_KEY não configurada no servidor." }, 503);
      const body = await request.text();
      const sep = qs ? "&" : "?";
      const target = `https://generativelanguage.googleapis.com/v1beta/models/${rest}${qs}${sep}key=${encodeURIComponent(key)}`;
      const r = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      return passthrough(r);
    }

    return json({ error: "Serviço não suportado." }, 404);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 502);
  }
}

function passthrough(r) {
  return new Response(r.body, {
    status: r.status,
    headers: { "Content-Type": r.headers.get("Content-Type") || "application/json" },
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
