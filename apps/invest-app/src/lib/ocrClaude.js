/**
 * OCR de comprovantes via Claude Vision.
 * Recebe imagem → manda pra API com prompt estruturado → recebe JSON com:
 *   { valor, data, estabelecimento, categoria, tipo, confianca }
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

const PROMPT_SISTEMA = `Você é um extrator de dados de comprovantes financeiros brasileiros.

Receberá uma imagem (nota fiscal, cupom, recibo, comprovante PIX, fatura, etc) e deve
extrair os campos abaixo, sempre em PT-BR.

Retorne APENAS um JSON válido neste formato, sem markdown ou explicação:

{
  "valor": <número decimal, sem R$, sem milhar, sempre positivo>,
  "data": "<YYYY-MM-DD>",
  "estabelecimento": "<nome resumido, máx 60 chars>",
  "categoria_sugerida": "<uma das: Alimentação, Transporte, Moradia, Saúde, Lazer, Educação, Salário, Loja AF4, Outros>",
  "subcategoria_sugerida": "<opcional: Combustível, Energia, Streaming, etc>",
  "tipo": "<receita|despesa>",
  "descricao": "<descrição curta, máx 80 chars, ex: 'Mercado Pão de Açúcar — compra mensal'>",
  "confianca": <0 a 100, sua confiança na extração>,
  "alerta": "<opcional: motivo se confiança < 70 ou se algo está estranho>"
}

Regras:
- Se a imagem for ilegível, retorne {"erro": "motivo curto"}
- Para PIX/TED recebido: tipo = "receita"
- Para compras, abastecimentos, mensalidades: tipo = "despesa"
- Use categoria mais provável; se incerto, "Outros"
- Data atual se não conseguir ler.
`;

/**
 * Converte File/Blob para base64 (sem o prefixo data:)
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("Falha ao ler imagem"));
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function detectMediaType(file) {
  if (file.type) return file.type;
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".gif")) return "image/gif";
  if (name.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

/**
 * Manda imagem pro Claude Vision e retorna dados extraídos.
 * Lança erro se a chave estiver faltando ou a API falhar.
 */
export async function extrairComprovante(file, apiKey) {
  if (!apiKey) throw new Error("Configure a chave Anthropic em Configurações → API Keys.");
  if (!file) throw new Error("Selecione uma imagem.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Imagem muito grande (máx 5 MB).");

  const base64 = await fileToBase64(file);
  const mediaType = detectMediaType(file);

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      system: PROMPT_SISTEMA,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: "Extraia os dados deste comprovante.",
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API retornou ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("\n")
    .trim();

  // Remove markdown fence se vier
  const clean = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch {
    throw new Error("Resposta do Claude não foi JSON válido. Tente uma imagem mais nítida.");
  }

  if (parsed.erro) throw new Error(parsed.erro);
  return parsed;
}
