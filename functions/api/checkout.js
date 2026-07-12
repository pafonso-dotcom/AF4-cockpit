/**
 * Checkout · cria uma assinatura recorrente no Mercado Pago (preapproval).
 *
 * Fluxo: o cliente logado clica "Assinar" → este endpoint cria a preapproval
 * mensal no MP e devolve o `init_point` (URL de pagamento). O `external_reference`
 * é o user_id do Supabase — o webhook usa isso pra ativar a assinatura certa.
 *
 * Env (Cloudflare Pages → invest-app):
 *   MERCADOPAGO_ACCESS_TOKEN  (secreta) — token do Mercado Pago (Produção)
 *   PLANO_PRECO               — valor mensal em BRL (ex.: 29.90). Default 29.90.
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE — pra validar o usuário
 */
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Método não suportado." }, 405);

  const MP_TOKEN = env.MERCADOPAGO_ACCESS_TOKEN || "";
  const SUPABASE_URL = env.SUPABASE_URL || "";
  const SERVICE = env.SUPABASE_SERVICE_ROLE || "";
  const PRECO = Number(env.PLANO_PRECO || 29.90);
  if (!MP_TOKEN) return json({ error: "Pagamento indisponível: MERCADOPAGO_ACCESS_TOKEN não configurado no servidor." }, 503);
  if (!SUPABASE_URL || !SERVICE) return json({ error: "Servidor não configurado (Supabase)." }, 503);

  // Valida a sessão do cliente.
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Não autenticado." }, 401);
  const meRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SERVICE },
  });
  if (!meRes.ok) return json({ error: "Sessão inválida." }, 401);
  const me = await meRes.json();
  if (!me?.id || !me?.email) return json({ error: "Usuário sem e-mail válido." }, 400);

  const origin = new URL(request.url).origin;
  const body = {
    reason: "AF.invest Pro — assinatura mensal",
    external_reference: me.id,
    payer_email: me.email,
    back_url: origin,
    status: "pending",
    auto_recurring: {
      frequency: 1,
      frequency_type: "months",
      transaction_amount: PRECO,
      currency_id: "BRL",
    },
  };

  const r = await fetch("https://api.mercadopago.com/preapproval", {
    method: "POST",
    headers: { Authorization: `Bearer ${MP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.init_point) {
    return json({ error: `Mercado Pago falhou: ${data.message || data.error || r.status}` }, 502);
  }
  return json({ ok: true, init_point: data.init_point, id: data.id });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
