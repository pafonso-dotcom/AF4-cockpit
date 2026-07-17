/**
 * Webhook da KIWIFY · ativa/atualiza a assinatura do cliente.
 *
 * A Kiwify chama esta URL quando um pedido/assinatura muda de estado (pago,
 * reembolso, chargeback, assinatura cancelada, etc.). Casamos o e-mail do
 * comprador com a conta do Supabase e gravamos em `subscriptions` via service
 * role.
 *
 * Configure na Kiwify (Apps/Webhooks) a URL:
 *   https://SEU-DOMINIO/api/kiwify-webhook
 *
 * A Kiwify assina o corpo com HMAC-SHA1 (token do webhook) e envia no
 * ?signature=... — validamos quando KIWIFY_TOKEN está setado.
 *
 * Env (Cloudflare Pages → invest-app):
 *   KIWIFY_TOKEN            (secreta) — token de assinatura do webhook Kiwify
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE
 */
export async function onRequest(context) {
  const { request, env } = context;
  const SUPABASE_URL = env.SUPABASE_URL || "";
  const SERVICE = env.SUPABASE_SERVICE_ROLE || "";
  const TOKEN = env.KIWIFY_TOKEN || "";
  // Respondemos sempre 200 pra Kiwify não reenviar em loop; erros a gente loga.
  if (!SUPABASE_URL || !SERVICE) return resp("config-missing");
  if (request.method !== "POST") return resp("method");

  const raw = await request.text();

  // Verificação de assinatura (HMAC-SHA1 hex do corpo cru com o token).
  if (TOKEN) {
    const url = new URL(request.url);
    const sig = url.searchParams.get("signature") || request.headers.get("x-kiwify-signature") || "";
    const esperado = await hmacSha1Hex(TOKEN, raw);
    if (!sig || sig.toLowerCase() !== esperado.toLowerCase()) return resp("bad-signature");
  }

  let body = {};
  try { body = JSON.parse(raw || "{}"); } catch { return resp("bad-json"); }

  // E-mail do comprador (a Kiwify varia a caixa/estrutura conforme o evento).
  const email = (
    body?.Customer?.email || body?.customer?.email ||
    body?.buyer?.email || body?.buyer_email || body?.email || ""
  ).toString().trim().toLowerCase();
  if (!email) return resp("no-email");

  // Status do pedido/assinatura → status interno.
  const rawStatus = String(
    body?.order_status || body?.subscription_status ||
    body?.Subscription?.status || body?.status || ""
  ).toLowerCase();
  const evento = String(body?.webhook_event_type || body?.event || "").toLowerCase();

  const ativo = /paid|approved|active|authorized|completed|paga|aprovad/.test(rawStatus)
    && !/refund|charged|cancel|expired|overdue/.test(rawStatus) && !/refus|declin/.test(rawStatus);
  const cancelado = /refund|charged|cancel|expired|overdue|reembols|estornad/.test(rawStatus + " " + evento);

  const status = ativo ? "active" : cancelado ? "canceled" : "inactive";

  // Validade: se a Kiwify mandar next_payment usamos; senão ~31 dias.
  const proxPag = body?.Subscription?.next_payment || body?.subscription?.next_payment || body?.next_payment;
  const validade = status === "active"
    ? (proxPag ? new Date(proxPag).toISOString() : new Date(Date.now() + 31 * 86400000).toISOString())
    : null;

  const gatewayRef = String(
    body?.Subscription?.id || body?.subscription_id || body?.order_id || body?.order_ref || body?.id || ""
  );

  // Resolve o user_id do Supabase pelo e-mail.
  const userId = await userIdByEmail(SUPABASE_URL, SERVICE, email);
  if (!userId) return resp("no-user"); // comprou antes de criar a conta com esse e-mail

  const row = {
    user_id: userId,
    status,
    plano: "mensal",
    gateway: "kiwify",
    gateway_ref: gatewayRef,
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
  if (!up.ok) return resp("db-fail");
  return resp("ok");
}

const resp = (msg) => new Response(msg, { status: 200 });

async function hmacSha1Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Procura o user_id por e-mail no GoTrue admin (páginas de 200; beta é pequeno).
async function userIdByEmail(SUPABASE_URL, SERVICE, email) {
  for (let page = 1; page <= 20; page++) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
    });
    if (!r.ok) return null;
    const data = await r.json().catch(() => ({}));
    const users = data.users || (Array.isArray(data) ? data : []);
    const hit = users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit.id;
    if (users.length < 200) break;
  }
  return null;
}
