/**
 * Admin · grava a metodologia/critérios de uma classe (texto que guia a IA).
 * Só ADMIN_EMAIL; service role no servidor. POST body: { classe, texto }
 */
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Método não suportado." }, 405);

  const SUPABASE_URL = env.SUPABASE_URL || "";
  const SERVICE = env.SUPABASE_SERVICE_ROLE || "";
  const ADMIN_EMAIL = (env.ADMIN_EMAIL || "").toLowerCase();
  if (!SUPABASE_URL || !SERVICE) return json({ error: "Servidor não configurado." }, 503);

  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autenticado." }, 401);
  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SERVICE },
  });
  if (!meRes.ok) return json({ error: "Sessão inválida." }, 401);
  const me = await meRes.json();
  if (!ADMIN_EMAIL || (me.email || "").toLowerCase() !== ADMIN_EMAIL) {
    return json({ error: "Acesso restrito ao administrador." }, 403);
  }

  let body;
  try { body = await request.json(); } catch { return json({ error: "JSON inválido." }, 400); }
  const classe = String(body.classe || "").trim();
  if (!classe) return json({ error: "classe obrigatória." }, 400);
  const row = { classe, texto: String(body.texto || ""), atualizado_em: new Date().toISOString() };

  const up = await fetch(`${SUPABASE_URL}/rest/v1/metodologia?on_conflict=classe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(row),
  });
  if (!up.ok) {
    const err = await up.text().catch(() => "");
    return json({ error: `Falha ao gravar: ${err.slice(0, 160)}` }, 502);
  }
  return json({ ok: true, classe });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
