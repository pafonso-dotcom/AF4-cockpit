/**
 * Admin · análise de um ativo com IA (Gemini).
 * Lê a metodologia da classe + critérios, pede à IA os indicadores do ticker,
 * e grava em `fundamentos`. Só ADMIN_EMAIL. Usa GEMINI_KEY e SERVICE_ROLE.
 * POST body: { ticker, classe, criterios: [{id,label,tipo,opcoes?}], metodologia? }
 */
export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== "POST") return json({ error: "Método não suportado." }, 405);

  const SUPABASE_URL = env.SUPABASE_URL || "";
  const SERVICE = env.SUPABASE_SERVICE_ROLE || "";
  const ADMIN_EMAIL = (env.ADMIN_EMAIL || "").toLowerCase();
  const GEMINI_KEY = env.GEMINI_KEY || "";
  if (!SUPABASE_URL || !SERVICE) return json({ error: "Servidor não configurado (Supabase)." }, 503);
  if (!GEMINI_KEY) return json({ error: "IA indisponível: GEMINI_KEY não configurada no servidor." }, 503);

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
  const ticker = String(body.ticker || "").toUpperCase().trim();
  const classe = body.classe || "fii";
  const criterios = Array.isArray(body.criterios) ? body.criterios : [];
  if (!ticker || criterios.length === 0) return json({ error: "ticker e criterios são obrigatórios." }, 400);

  // Metodologia da classe (texto do admin), se houver.
  let metodologia = body.metodologia || "";
  if (!metodologia) {
    try {
      const m = await fetch(`${SUPABASE_URL}/rest/v1/metodologia?classe=eq.${classe}&select=texto`, {
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
      });
      const md = m.ok ? await m.json() : [];
      metodologia = md[0]?.texto || "";
    } catch { /* segue sem metodologia */ }
  }

  // Monta o prompt: pede um JSON com cada critério preenchido.
  const campos = criterios.map(c => {
    const tipo = c.tipo === "opcao" ? `uma das opções [${(c.opcoes || []).join(", ")}]`
      : c.tipo === "percent" ? "número (percentual, só o valor)"
      : c.tipo === "numero" ? "número"
      : "texto curto";
    return `- "${c.id}" (${c.label}): ${tipo}`;
  }).join("\n");

  const prompt = `Você é um analista de investimentos. Avalie o ativo brasileiro/internacional de ticker ${ticker} (classe: ${classe}).
${metodologia ? `\nMETODOLOGIA E CRITÉRIOS DO ANALISTA (siga rigorosamente):\n${metodologia}\n` : ""}
Preencha os indicadores abaixo com os dados mais recentes e confiáveis que você conhece. Se não tiver certeza de um valor, faça a melhor estimativa fundamentada; se for impossível, deixe "".
Campos esperados (id: descrição):
${campos}

Responda APENAS um JSON válido no formato {"dados": { "<id>": <valor>, ... }, "resumo": "<1 frase>"}. Sem texto fora do JSON.`;

  // Chama o Gemini (servidor).
  const MODEL = "gemini-2.0-flash";
  let dados = {}, resumo = "";
  try {
    const gr = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(GEMINI_KEY)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
      }),
    });
    if (!gr.ok) {
      const e = await gr.text().catch(() => "");
      return json({ error: `IA falhou (${gr.status}): ${e.slice(0, 160)}` }, 502);
    }
    const gj = await gr.json();
    const txt = gj.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const parsed = JSON.parse(txt);
    dados = parsed.dados || parsed || {};
    resumo = parsed.resumo || "";
  } catch (e) {
    return json({ error: `Falha ao interpretar a IA: ${String(e?.message || e)}` }, 502);
  }

  // Grava em fundamentos (upsert via service role).
  const row = { ticker, classe, nome: body.nome || ticker, dados, atualizado_em: new Date().toISOString() };
  const up = await fetch(`${SUPABASE_URL}/rest/v1/fundamentos?on_conflict=ticker`, {
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
  return json({ ok: true, ticker, dados, resumo });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
