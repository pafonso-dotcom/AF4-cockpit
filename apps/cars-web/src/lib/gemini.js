// Cliente Gemini 2.5 Flash (camada gratuita)
// Docs: https://ai.google.dev/api/rest

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = "gemini-2.5-flash";

const KEY_LS = "af4:gemini-key";

function getKey(opts = {}) {
  return opts.apiKey || localStorage.getItem(KEY_LS);
}

/**
 * Traduz status HTTP do Gemini em mensagem útil pro usuário final.
 */
function erroAmigavel(status, body = "") {
  if (status === 503) return new Error("IA temporariamente sobrecarregada. Aguarde 2-3 minutos e tente novamente.");
  if (status === 429) return new Error("Limite de uso do Gemini atingido (1.500/dia grátis). Aguarde alguns minutos.");
  if (status === 401 || status === 403) return new Error("Chave do Gemini inválida. Verifique em ⚙ Configurações → Inteligência Artificial.");
  if (status === 400 && /has no pages|no pages/i.test(body)) {
    return new Error("O Gemini não conseguiu ler esse PDF (provavelmente protegido, escaneado sem OCR, ou corrompido). Tente: (1) abrir o PDF e re-salvar, (2) mandar print/imagem JPG/PNG, ou (3) colar o texto da fatura.");
  }
  if (status === 400 && /invalid.*image|unsupported|image format/i.test(body)) {
    return new Error("Formato de imagem não suportado pelo Gemini. Use JPG ou PNG.");
  }
  // Default
  return new Error(`Erro Gemini ${status}: tente novamente (${(body || "").slice(0, 120)})`);
}

/**
 * Tenta reparar JSON malformado típico do Gemini.
 * - Remove markdown fences (```json ... ```)
 * - Remove vírgulas trailing antes de } ou ]
 * - Conta chaves abertas e fecha as faltantes
 * - Tenta extrair o primeiro objeto JSON entre { ... } como último recurso
 * Devolve o objeto parseado ou null se nada funcionar.
 */
function parseJSONTolerante(texto) {
  if (!texto || typeof texto !== "string") return null;

  // 1. Limpa fences markdown
  let limpo = texto
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  // 2. Tenta direto
  try { return JSON.parse(limpo); } catch (_) {}

  // 3. Remove vírgulas trailing
  limpo = limpo.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(limpo); } catch (_) {}

  // 4. Fecha chaves/colchetes faltantes
  const abreChaves  = (limpo.match(/{/g) || []).length;
  const fechaChaves = (limpo.match(/}/g) || []).length;
  const abreCol     = (limpo.match(/\[/g) || []).length;
  const fechaCol    = (limpo.match(/]/g) || []).length;

  let tentativa = limpo;
  for (let i = 0; i < (abreCol - fechaCol); i++)    tentativa += "]";
  for (let i = 0; i < (abreChaves - fechaChaves); i++) tentativa += "}";

  try { return JSON.parse(tentativa); } catch (_) {}

  // 5. Último recurso: extrai o primeiro objeto entre { ... }
  const matchObj = limpo.match(/\{[\s\S]*\}/);
  if (matchObj) {
    try { return JSON.parse(matchObj[0]); } catch (_) {}
  }

  return null;
}

/**
 * fetch com retry exponencial pra erros transitórios do Gemini (429, 500, 502, 503, 504).
 * Backoff: 2s, 5s, 10s. Erros permanentes (400, 401, etc.) lançam imediatamente.
 */
export async function fetchComRetry(url, opts, maxTentativas = 3) {
  let ultimoErro = null;
  const ESPERAS = [2000, 5000, 10000];

  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    try {
      const res = await fetch(url, opts);

      if (res.ok) return res;

      // Transitório: retry
      if ([429, 500, 502, 503, 504].includes(res.status)) {
        const body = await res.text();
        ultimoErro = erroAmigavel(res.status, body);

        if (tentativa < maxTentativas) {
          const espera = ESPERAS[tentativa - 1] || 10000;
          console.warn(`[gemini] ${res.status} · backoff ${espera / 1000}s antes de tentar de novo (${tentativa}/${maxTentativas})`);
          await new Promise(r => setTimeout(r, espera));
          continue;
        }
        // Esgotou tentativas: relança
        throw ultimoErro;
      }

      // Permanente: lança imediatamente (sem retry)
      const body = await res.text();
      throw erroAmigavel(res.status, body);
    } catch (e) {
      // Erro de rede: retry se transitório. As mensagens variam por navegador —
      // "Load failed" no Safari/iOS, "Failed to fetch" no Chrome, "NetworkError" no Firefox.
      const msg = e.message || "";
      const ehRede = /failed to fetch|load failed|networkerror|network error|network request failed|timeout|aborted/i.test(msg);
      if (tentativa < maxTentativas && ehRede) {
        ultimoErro = e;
        const espera = ESPERAS[tentativa - 1] || 10000;
        console.warn(`[gemini] erro de rede · backoff ${espera / 1000}s (${tentativa}/${maxTentativas}):`, msg);
        await new Promise(r => setTimeout(r, espera));
        continue;
      }
      if (ehRede) {
        throw new Error("Não foi possível conectar ao serviço de IA. Verifique sua conexão com a internet e tente de novo — ou use a opção 'Colar texto' para enviar a fatura.");
      }
      throw e;
    }
  }

  throw ultimoErro || new Error("Falha em todas as tentativas");
}

export async function gerarTextoGemini(prompt, opts = {}) {
  const key = getKey(opts);
  if (!key) throw new Error("Chave do Gemini não configurada");

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.2,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
      responseMimeType: opts.responseMimeType || "text/plain",
    },
  };

  const res = await fetchComRetry(
    `${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

export async function gerarJSONGemini(prompt, opts = {}) {
  const texto = await gerarTextoGemini(prompt, {
    ...opts,
    responseMimeType: "application/json",
  });
  const parsed = parseJSONTolerante(texto);
  if (parsed) return parsed;

  console.error("[gemini] Resposta não é JSON válido:", (texto || "").slice(0, 500));
  throw new Error("Gemini retornou resposta inválida. Tente de novo ou cole o texto.");
}

export async function gerarJSONGeminiComPDF(prompt, pdfBase64, opts = {}) {
  const key = getKey(opts);
  if (!key) throw new Error("Chave do Gemini não configurada");

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
      ],
    }],
    generationConfig: {
      temperature: opts.temperature ?? 0.1,
      maxOutputTokens: opts.maxOutputTokens ?? 8192,
      responseMimeType: "application/json",
    },
  };

  const res = await fetchComRetry(
    `${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const data = await res.json();
  const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!texto) throw new Error("Gemini retornou resposta vazia. Tente colar o texto da fatura.");

  const parsed = parseJSONTolerante(texto);
  if (parsed) return parsed;

  console.error("[gemini] JSON malformado · primeiros 500 chars:", texto.slice(0, 500));
  throw new Error("O Gemini retornou um formato que não consegui entender. Tente: (1) Analisar de novo (geralmente funciona na segunda), ou (2) colar o texto da fatura no botão 'COLAR TEXTO'.");
}

// Anonimiza CPF e cartão antes de mandar pra IA
export function anonimizar(texto) {
  if (typeof texto !== "string") return texto;
  return texto
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "###.###.###-##")
    .replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "####-####-####-####");
}

export async function pingGemini(apiKey) {
  try {
    const r = await gerarTextoGemini("Responda apenas: ok", { apiKey, maxOutputTokens: 10 });
    return { ok: true, resposta: r.trim() };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

// Helper: File → base64 (sem o prefixo data:...)
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
