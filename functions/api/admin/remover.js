/**
 * Admin · remove um cliente (apaga a conta e os dados).
 * Só o ADMIN_EMAIL pode usar; service role no servidor.
 * POST body: { user_id }
 *  → apaga invest_state + subscriptions do usuário e a conta no Auth.
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

  // Valida o chamador como admin.
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
  const userId = String(body.user_id || "").trim();
  if (!userId) return json({ error: "user_id obrigatório." }, 400);
  // Trava de segurança: o admin não pode apagar a própria conta por aqui.
  if (userId === me.id) return json({ error: "Não é possível remover a própria conta de admin." }, 400);

  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` };

  // Apaga os dados do usuário (ignora falhas individuais — o importante é a conta).
  await fetch(`${SUPABASE_URL}/rest/v1/invest_state?user_id=eq.${userId}`, { method: "DELETE", headers: h }).catch(() => {});
  await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}`, { method: "DELETE", headers: h }).catch(() => {});

  // Apaga a conta no Auth.
  const del = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: h });
  if (!del.ok) {
    const err = await del.text().catch(() => "");
    return json({ error: `Falha ao remover a conta: ${err.slice(0, 200)}` }, 502);
  }
  return json({ ok: true });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
