/**
 * Painel gerencial (admin) — endpoint protegido.
 * Só o e-mail definido em ADMIN_EMAIL consegue acessar. Usa a SERVICE ROLE do
 * Supabase (server-side) pra listar usuários e assinaturas — nunca exposto ao
 * navegador.
 *
 * Variáveis de ambiente (Cloudflare Pages → Settings → Environment variables):
 *   SUPABASE_URL            (ex.: https://xxxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE   (Project Settings → API → service_role secret)
 *   ADMIN_EMAIL             (seu e-mail de administrador)
 */
export async function onRequest(context) {
  const { request, env } = context;
  const SUPABASE_URL = env.SUPABASE_URL || "";
  const SERVICE = env.SUPABASE_SERVICE_ROLE || "";
  const ADMIN_EMAIL = (env.ADMIN_EMAIL || "").toLowerCase();

  if (!SUPABASE_URL || !SERVICE) {
    return json({ error: "Painel não configurado no servidor (faltam SUPABASE_URL / SUPABASE_SERVICE_ROLE)." }, 503);
  }

  // 1) Identifica e valida o chamador pelo token da sessão.
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

  // 2) Lista usuários (admin API) + assinaturas (service role ignora RLS).
  const [usersRes, subsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=1000`, {
      headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
    }),
    fetch(`${SUPABASE_URL}/rest/v1/subscriptions?select=*`, {
      headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
    }),
  ]);

  const usersData = usersRes.ok ? await usersRes.json() : {};
  const users = usersData.users || (Array.isArray(usersData) ? usersData : []);
  const subs = subsRes.ok ? await subsRes.json() : [];
  const subByUser = {};
  for (const s of subs) subByUser[s.user_id] = s;

  const usuarios = users.map(u => ({
    id: u.id,
    email: u.email,
    criado: u.created_at,
    ultimoLogin: u.last_sign_in_at || null,
    confirmado: !!u.email_confirmed_at || !!u.confirmed_at,
    status: subByUser[u.id]?.status || "—",
    validade: subByUser[u.id]?.validade || null,
  })).sort((a, b) => (b.criado || "").localeCompare(a.criado || ""));

  const ativos = subs.filter(s => ["active", "trialing"].includes(s.status)).length;

  return json({
    totais: {
      clientes: usuarios.length,
      assinantesAtivos: ativos,
      assinaturas: subs.length,
    },
    usuarios,
  });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
