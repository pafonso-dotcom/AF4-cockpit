/**
 * Endpoint /api/recibo — extração de recibo por foto via Claude Vision.
 *
 * A ANTHROPIC_API_KEY fica como SECRET do Worker (nunca no app). O endpoint é
 * público, então é protegido por um PIN (header `x-recibo-pin` == env.RECIBO_PIN)
 * pra ninguém gastar a API. Recebe a imagem em base64, chama Claude Vision com
 * tool/JSON schema (saída estruturada garantida) e devolve os campos do recibo.
 *
 * Request  (POST application/json):
 *   { imageBase64: "<sem prefixo data:>", mediaType: "image/jpeg", categorias?: string[] }
 * Headers: x-recibo-pin: <PIN>
 *
 * Response 200: { ok: true, recibo: { loja, cnpj, data, valor, tipo, categoriaSugerida,
 *                                      subcategoria, pagamento, itens[], confianca, alerta } }
 * Erros: 401 (PIN), 400 (payload), 413 (imagem grande), 422 (foto ruim), 502 (API), 500.
 */

const MODEL = "claude-haiku-4-5-20251001"; // barato/rápido, bom pra recibo
const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB já comprimido no cliente
const MEDIA_TYPES_OK = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const SYSTEM_PROMPT = `Você extrai dados de recibos, cupons fiscais e notas fiscais brasileiros.
Sempre responda em PT-BR usando a ferramenta extrair_recibo. Seja preciso:
- valor: o TOTAL final pago (não subtotais), número positivo sem R$/milhar.
- data: YYYY-MM-DD; se ilegível, deixe vazia.
- itens: itens de linha quando visíveis (descrição + valor), senão lista vazia.
- categoriaSugerida: escolha entre as categorias informadas; se nenhuma servir, "Outros".
- confianca: 0 a 100; se a foto estiver ruim/ilegível, baixa + preencha "alerta".`;

// Tool schema — força saída estruturada (sem parsing frágil de texto).
const TOOL = {
  name: "extrair_recibo",
  description: "Devolve os campos estruturados extraídos do recibo da imagem.",
  input_schema: {
    type: "object",
    properties: {
      loja: { type: "string", description: "Nome do estabelecimento (curto)" },
      cnpj: { type: "string", description: "CNPJ se visível, senão vazio" },
      data: { type: "string", description: "Data da compra YYYY-MM-DD ou vazio" },
      valor: { type: "number", description: "Valor total pago, positivo" },
      tipo: { type: "string", enum: ["despesa", "receita"] },
      categoriaSugerida: { type: "string" },
      subcategoria: { type: "string" },
      pagamento: { type: "string", description: "Forma de pagamento (PIX, crédito, débito, dinheiro) ou vazio" },
      itens: {
        type: "array",
        items: {
          type: "object",
          properties: { descricao: { type: "string" }, valor: { type: "number" } },
          required: ["descricao"],
        },
      },
      confianca: { type: "number", description: "0 a 100" },
      alerta: { type: "string", description: "Motivo se confiança baixa ou algo estranho; senão vazio" },
    },
    required: ["valor", "tipo", "categoriaSugerida", "confianca"],
  },
};

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

// Estima o tamanho em bytes de uma string base64 (4 chars ≈ 3 bytes).
function base64Bytes(b64) {
  const len = b64.length;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Trata o POST /api/recibo. Recebe (request, env). `env` deve ter:
 *   ANTHROPIC_API_KEY (secret) e, opcionalmente, RECIBO_PIN (secret).
 * `fetchImpl` é injetável pra testes.
 */
export async function handleRecibo(request, env, fetchImpl = fetch) {
  if (request.method !== "POST") return json({ error: "Use POST." }, 405);

  if (!env || !env.ANTHROPIC_API_KEY) {
    return json({ error: "Servidor sem ANTHROPIC_API_KEY configurada." }, 500);
  }

  // Proteção: se RECIBO_PIN estiver configurado, exige o header correto.
  if (env.RECIBO_PIN) {
    const pin = request.headers.get("x-recibo-pin") || "";
    if (pin !== env.RECIBO_PIN) return json({ error: "PIN inválido ou ausente." }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const { imageBase64, mediaType = "image/jpeg", categorias = [] } = payload || {};
  if (!imageBase64 || typeof imageBase64 !== "string") {
    return json({ error: "imageBase64 é obrigatório." }, 400);
  }
  if (!MEDIA_TYPES_OK.has(mediaType)) {
    return json({ error: `mediaType não suportado: ${mediaType}` }, 400);
  }
  if (base64Bytes(imageBase64) > MAX_IMAGE_BYTES) {
    return json({ error: "Imagem muito grande (máx 5 MB). Comprima antes de enviar." }, 413);
  }

  const catTxt = Array.isArray(categorias) && categorias.length
    ? `\nCategorias disponíveis: ${categorias.slice(0, 40).join(", ")}.`
    : "";

  let apiRes;
  try {
    apiRes = await fetchImpl(ANTHROPIC_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        // prompt caching no system: o bloco fixo é reusado entre chamadas.
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: [TOOL],
        tool_choice: { type: "tool", name: "extrair_recibo" },
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
              { type: "text", text: `Extraia os dados deste recibo.${catTxt}` },
            ],
          },
        ],
      }),
    });
  } catch (e) {
    return json({ error: "Falha ao contatar a API de visão." }, 502);
  }

  if (!apiRes.ok) {
    const txt = await apiRes.text().catch(() => "");
    return json({ error: `API de visão retornou ${apiRes.status}.`, detalhe: txt.slice(0, 200) }, 502);
  }

  let data;
  try {
    data = await apiRes.json();
  } catch {
    return json({ error: "Resposta da API ilegível." }, 502);
  }

  // Extrai o tool_use (saída estruturada).
  const toolUse = (data.content || []).find(c => c.type === "tool_use" && c.name === "extrair_recibo");
  if (!toolUse || !toolUse.input) {
    return json({ error: "Não consegui ler o recibo. Tente uma foto mais nítida." }, 422);
  }

  return json({ ok: true, recibo: normalizar(toolUse.input) });
}

// Normaliza/sanitiza a saída do modelo pra um formato estável pro cliente.
function normalizar(r) {
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const str = (v) => (typeof v === "string" ? v.trim() : "");
  return {
    loja: str(r.loja),
    cnpj: str(r.cnpj),
    data: /^\d{4}-\d{2}-\d{2}$/.test(str(r.data)) ? r.data : "",
    valor: Math.abs(num(r.valor)),
    tipo: r.tipo === "receita" ? "receita" : "despesa",
    categoriaSugerida: str(r.categoriaSugerida) || "Outros",
    subcategoria: str(r.subcategoria),
    pagamento: str(r.pagamento),
    itens: Array.isArray(r.itens)
      ? r.itens.filter(i => i && str(i.descricao)).map(i => ({ descricao: str(i.descricao), valor: Math.abs(num(i.valor)) }))
      : [],
    confianca: Math.max(0, Math.min(100, Math.round(num(r.confianca)))),
    alerta: str(r.alerta),
  };
}

export const _internal = { base64Bytes, normalizar, MODEL, MAX_IMAGE_BYTES };
