/**
 * Integração bancária PLUGGY (Meu Pluggy · Open Finance) — proxy server-side.
 *
 * O client_secret NUNCA vai pro front (PWA/Vite expõe o bundle): as chamadas
 * saem daqui, com as credenciais em secrets do Worker. PIN é OBRIGATÓRIO
 * (dados bancários — diferente do /api/recibo, sem PIN não abre).
 *
 * Secrets (wrangler secret put ...):
 *  - PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET : da aplicação em dashboard.pluggy.ai
 *  - PLUGGY_PIN                              : PIN que o app envia em x-pluggy-pin
 *
 * Rotas (ver worker/index.js):
 *  - POST /api/pluggy/conectar   {usuario, senha} → cria item conector 200
 *    (MeuPluggy). As credenciais só TRANSITAM (não são logadas nem salvas).
 *  - GET  /api/pluggy/item?itemId=&atualizar=0|1 → status do consentimento.
 *  - GET  /api/pluggy/contas?itemId=            → contas type BANK.
 *  - GET  /api/pluggy/transacoes?accountId=&from=&to= → transações (agrega páginas).
 *
 * Fonte OPCIONAL: o app funciona 100% sem isso (manual/CSV/OFX).
 */

const PLUGGY = "https://api.pluggy.ai";
const CONECTOR_MEU_PLUGGY = 200;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Cache do apiKey da Pluggy (~2h de validade) — variável de módulo.
let _auth = null; // { apiKey, expiraEm }

async function apiKeyPluggy(env, fetchImpl) {
  if (_auth && Date.now() < _auth.expiraEm - 60_000) return _auth.apiKey;
  const r = await fetchImpl(`${PLUGGY}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: env.PLUGGY_CLIENT_ID, clientSecret: env.PLUGGY_CLIENT_SECRET }),
  });
  if (!r.ok) throw new Error(`Pluggy auth falhou (HTTP ${r.status}) — confira PLUGGY_CLIENT_ID/SECRET.`);
  const data = await r.json();
  if (!data.apiKey) throw new Error("Pluggy auth sem apiKey na resposta.");
  _auth = { apiKey: data.apiKey, expiraEm: Date.now() + 110 * 60 * 1000 };
  return _auth.apiKey;
}

async function pluggyGet(caminho, env, fetchImpl) {
  const apiKey = await apiKeyPluggy(env, fetchImpl);
  const r = await fetchImpl(`${PLUGGY}${caminho}`, { headers: { "X-API-KEY": apiKey } });
  const data = await r.json().catch(() => null);
  if (r.status === 403 || r.status === 401) { _auth = null; }
  if (!r.ok) throw new Error(data?.message || `Pluggy HTTP ${r.status}`);
  return data;
}

// Reseta o cache de auth (usado pelos testes).
export function _resetAuthPluggy() { _auth = null; }

export async function handlePluggy(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  const rota = url.pathname.replace("/api/pluggy/", "");

  // Configuração do servidor
  if (!env.PLUGGY_CLIENT_ID || !env.PLUGGY_CLIENT_SECRET || !env.PLUGGY_PIN) {
    return json({ ok: false, error: "Integração Pluggy não configurada no servidor — defina os secrets PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_PIN no Worker (wrangler secret put)." }, 501);
  }
  // PIN OBRIGATÓRIO (dados bancários)
  const pin = request.headers.get("x-pluggy-pin") || "";
  if (pin !== env.PLUGGY_PIN) {
    return json({ ok: false, error: "PIN inválido ou ausente." }, 401);
  }

  try {
    // ---- conectar: cria o item do conector MeuPluggy (200) ----
    if (rota === "conectar") {
      if (request.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
      const { usuario, senha } = await request.json().catch(() => ({}));
      if (!usuario || !senha) return json({ ok: false, error: "Informe usuário e senha do Meu Pluggy." }, 400);
      const apiKey = await apiKeyPluggy(env, fetchImpl);
      const r = await fetchImpl(`${PLUGGY}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify({
          connectorId: CONECTOR_MEU_PLUGGY,
          parameters: { user: usuario, password: senha },
        }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok) {
        return json({ ok: false, error: data?.message || `Falha ao conectar (HTTP ${r.status}). Confira usuário/senha do Meu Pluggy.` }, 502);
      }
      return json({ ok: true, itemId: data.id, status: data.status });
    }

    // ---- item: status do consentimento (e refresh opcional) ----
    if (rota === "item") {
      const itemId = url.searchParams.get("itemId");
      if (!itemId) return json({ ok: false, error: "Informe itemId." }, 400);
      if (url.searchParams.get("atualizar") === "1") {
        const apiKey = await apiKeyPluggy(env, fetchImpl);
        await fetchImpl(`${PLUGGY}/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
          body: JSON.stringify({}),
        }).catch(() => {});
      }
      const item = await pluggyGet(`/items/${itemId}`, env, fetchImpl);
      return json({ ok: true, itemId: item.id, status: item.status, executionStatus: item.executionStatus, atualizadoEm: item.updatedAt });
    }

    // ---- contas: BANK (conta corrente) e CREDIT (cartão de crédito) ----
    if (rota === "contas") {
      const itemId = url.searchParams.get("itemId");
      if (!itemId) return json({ ok: false, error: "Informe itemId." }, 400);
      const data = await pluggyGet(`/accounts?itemId=${encodeURIComponent(itemId)}`, env, fetchImpl);
      const contas = (data.results || [])
        .filter(a => a.type === "BANK" || a.type === "CREDIT")
        .map(a => ({
          id: a.id,
          nome: [a.name, a.marketingName].filter(Boolean)[0] || "Conta",
          banco: a.institution?.name || "", // (owner era o NOME DA PESSOA — poluía a lista)
          numero: a.number || "",
          saldo: Number(a.balance) || 0,
          moeda: a.currencyCode || "BRL",
          tipoConta: a.type === "CREDIT" ? "cartao" : "banco",
        }));
      return json({ ok: true, contas });
    }

    // ---- transacoes: GET /v2/transactions com paginação por CURSOR ----
    // (o /transactions v1 foi descontinuado pela Pluggy — respondia
    // "This endpoint is deprecated"). No v2: dateFrom/dateTo, página fixa
    // de 500, e a resposta traz `next` — a query string PRONTA da próxima
    // página (colar como vem; re-encodar quebra o cursor base64).
    if (rota === "transacoes") {
      const accountId = url.searchParams.get("accountId");
      if (!accountId) return json({ ok: false, error: "Informe accountId." }, 400);
      const from = url.searchParams.get("from") || "";
      const to = url.searchParams.get("to") || "";
      let caminho = `/v2/transactions?accountId=${encodeURIComponent(accountId)}${from ? `&dateFrom=${from}` : ""}${to ? `&dateTo=${to}` : ""}`;
      let total = [], paginas = 0;
      while (caminho && paginas < 5) { // teto: 5 páginas x 500 = 2.500 por sync
        const data = await pluggyGet(caminho, env, fetchImpl);
        total = total.concat(data.results || []);
        paginas++;
        const next = data.next || null;
        caminho = !next ? null
          : next.startsWith("http") ? next.replace(PLUGGY, "")
          : next.startsWith("?") ? `/v2/transactions${next}`
          : next;
      }
      const transacoes = total.map(t => ({
        pluggyId: t.id,
        data: (t.date || "").slice(0, 10),
        descricao: t.description || t.descriptionRaw || "Transação",
        valor: Math.abs(Number(t.amount) || 0),
        tipo: t.type === "CREDIT" ? "receita"
          : t.type === "DEBIT" ? "despesa"
          : (Number(t.amount) || 0) < 0 ? "despesa" : "receita",
        categoriaPluggy: t.category || "",
      })).filter(t => t.data && t.valor > 0);
      return json({ ok: true, transacoes, truncado: Boolean(caminho) });
    }

    return json({ ok: false, error: "Rota Pluggy desconhecida." }, 404);
  } catch (e) {
    return json({ ok: false, error: String(e && e.message || e) }, 502);
  }
}
