/**
 * Webhook do Mercado Pago · ativa/atualiza a assinatura do cliente.
 *
 * O MP chama esta URL quando uma assinatura (preapproval) muda de estado.
 * Buscamos a preapproval no MP pra saber o status + external_reference
 * (user_id do Supabase) e gravamos em `subscriptions` via service role.
 *
 * Configure no painel do Mercado Pago (Webhooks/Notificações) a URL:
 *   https://SEU-DOMINIO/api/mp-webhook   (evento: Assinaturas / preapproval)
 *
 * Env: MERCADOPAGO_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const MP_TOKEN = env.MERCADOPAGO_ACCESS_TOKEN || "";
  const SUPABASE_URL = env.SUPABASE_URL || "";
  const SERVICE = env.SUPABASE_SERVICE_ROLE || "";
  // Sempre respondemos 200 pro MP não ficar reenviando; erros a gente loga.
  if (!MP_TOKEN || !SUPABASE_URL || !SERVICE) return new Response("config-missing", { status: 200 });

  // O MP manda por query (?type=&data.id=) e/ou corpo JSON. Cobrimos os dois.
  const url = new URL(request.url);
  let type = url.searchParams.get("type") || url.searchParams.get("topic") || "";
  let id = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
  if (!id) {
    try {
      const b = await request.json();
      type = b.type || b.topic || type;
      id = (b.data && b.data.id) || b.id || id;
    } catch { /* corpo vazio/inesperado */ }
  }
  if (!id) return new Response("no-id", { status: 200 });
  // Só tratamos assinatura (preapproval). Outros eventos são ignorados.
  if (type && !/preapproval|subscription/i.test(type)) return new Response("ignored", { status: 200 });

  // Busca a preapproval no MP.
  const pr = await fetch(`https://api.mercadopago.com/preapproval/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${MP_TOKEN}` },
  });
  if (!pr.ok) return new Response("mp-fetch-fail", { status: 200 });
  const sub = await pr.json().catch(() => ({}));
  const userId = sub.external_reference;
  if (!userId) return new Response("no-ref", { status: 200 });

  // Mapeia o status do MP → status interno.
  const mp = String(sub.status || "").toLowerCase();
  const status = mp === "authorized" ? "active"
    : mp === "cancelled" ? "canceled"
    : mp === "paused" ? "past_due"
    : "inactive";
  // Assinatura ativa → acesso válido por ~31 dias (renova a cada webhook de cobrança).
  const validade = status === "active" ? new Date(Date.now() + 31 * 86400000).toISOString() : null;

  const row = {
    user_id: userId,
    status,
    plano: "mensal",
    gateway: "mercadopago",
    gateway_ref: String(id),
    validade,
    atualizado_em: new Date().toISOString(),
  };
  const up = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?on_conflict=user_id`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", apikey: SERVICE, Authorization: `Bearer ${SERVICE}`,
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(row),
  });
  if (!up.ok) return new Response("db-fail", { status: 200 });
  return new Response("ok", { status: 200 });
}
