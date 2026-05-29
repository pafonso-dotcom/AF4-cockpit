/**
 * OCR de comprovantes via Gemini 2.5 Flash Vision.
 *
 * Recebe imagem → extrai { descricao, valor, data, categoria } → retorna sugestão
 * pra criar transação. Usa a chave do Gemini que já vive em localStorage
 * ("af4:gemini-key"), configurada em Configurações → APIs.
 */

import { gerarJSONGeminiComImagem, fileToBase64 } from "./gemini.js";

export { fileToBase64 };

/**
 * Envia imagem ao Gemini Vision pra extrair dados do comprovante.
 * Retorna objeto { descricao, valor, data, categoria, subcategoria, estabelecimento, tipo }
 */
export async function ocrComprovante({ file, categoriasDisponiveis = [] }) {
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

  return gerarJSONGeminiComImagem(prompt, base64, mediaType, { maxOutputTokens: 512 });
}
