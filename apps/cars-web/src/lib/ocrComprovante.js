/**
 * OCR de comprovantes via Claude Vision API.
 *
 * Recebe imagem → extrai { descricao, valor, data, categoria } → retorna sugestão
 * pra criar transação.
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5";

/**
 * Converte arquivo em base64 (sem o prefixo data:image/...;base64,).
 */
export async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      // dataURL formato: "data:image/png;base64,XXXX"
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Envia imagem ao Claude Vision pra extrair dados do comprovante.
 * Retorna objeto { descricao, valor, data, categoria, subcategoria, estabelecimento }
 */
export async function ocrComprovante({ apiKey, file, categoriasDisponiveis = [] }) {
  if (!apiKey) throw new Error("Configure a chave Anthropic em Configurações → API Keys.");
  if (!file) throw new Error("Nenhuma imagem fornecida.");

  const base64 = await fileToBase64(file);
  const mediaType = file.type || "image/jpeg";

  const categoriasTexto = categoriasDisponiveis.length > 0
    ? `\nCategorias disponíveis: ${categoriasDisponiveis.join(", ")}.`
    : "";

  const prompt = `Esta é a foto de um comprovante de pagamento, cupom fiscal ou nota fiscal. Extraia os seguintes dados em JSON:

{
  "descricao": "Nome do estabelecimento ou descrição curta (ex: 'Posto Shell', 'Mercado Pão de Açúcar')",
  "valor": número decimal (sem R$ nem aspas, ex: 150.68),
  "data": "YYYY-MM-DD" (se não for legível, use null),
  "categoria": "Uma das categorias disponíveis que melhor se encaixa",
  "subcategoria": "Subcategoria se aplicável (ex: 'Combustível' para posto), ou null",
  "estabelecimento": "Nome completo se diferente da descrição, ou null",
  "tipo": "despesa" (geralmente comprovantes são despesa)
}

Regras:
- Se não conseguir ler algum campo, use null
- Para valor: extraia apenas o valor total/final, não subtotais
- Para data: formato ISO YYYY-MM-DD
- Para categoria: escolha entre as disponíveis (ou "Outros" se nenhuma se encaixa)${categoriasTexto}

Retorne SOMENTE o JSON, sem markdown, sem explicações, sem texto antes ou depois.`;

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
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude Vision retornou ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = (data.content || [])
    .filter(c => c.type === "text")
    .map(c => c.text)
    .join("\n")
    .trim();

  // Limpa caso venha em markdown code block
  const jsonStr = text.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");

  try {
    const parsed = JSON.parse(jsonStr);
    return parsed;
  } catch (err) {
    throw new Error(`Resposta inválida do Claude: ${text.slice(0, 100)}`);
  }
}
