/**
 * Admin · concede/estende o período de teste de um cliente.
 * Só o ADMIN_EMAIL pode usar; service role no servidor (upsert em subscriptions).
 * POST body: { user_id, dias }  → trial_ate = (maior entre hoje e trial atual) + dias
 * Se dias <= 0, encerra o teste (trial_ate = agora).
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
  const dias = Number(body.dias);
  if (!userId) return json({ error: "user_id obrigatório." }, 400);
  if (!Number.isFinite(dias)) return json({ error: "dias inválido." }, 400);

  // Lê a assinatura atual (se houver) pra estender a partir do trial vigente.
  const cur = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&select=trial_ate`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  const curData = cur.ok ? await cur.json() : [];
  const agora = Date.now();
  const base = curData[0]?.trial_ate ? Math.max(agora, new Date(curData[0].trial_ate).getTime()) : agora;
  const novoTrial = dias <= 0 ? new Date(agora).toISOString() : new Date(base + dias * 86400000).toISOString();
  const status = dias <= 0 ? "inactive" : "trialing";

  const up = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE,
      Authorization: `Bearer ${SERVICE}`,
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({ user_id: userId, status, trial_ate: novoTrial, atualizado_em: new Date().toISOString() }),
  });
  if (!up.ok) {
    const err = await up.text().catch(() => "");
    return json({ error: `Falha ao gravar: ${err.slice(0, 200)}` }, 502);
  }
  return json({ ok: true, trial_ate: novoTrial, status });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
