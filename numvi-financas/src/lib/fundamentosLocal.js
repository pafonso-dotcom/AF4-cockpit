/* ============================================================
   FUNDAMENTOS (local) · base de curadoria pessoal + classificação

   Versão do AF4 finanças (app pessoal, 1 usuário). Diferente do Aureus:
   - NÃO usa servidor/admin nem service_role. Os fundamentos e a
     metodologia ficam no próprio navegador (localStorage), junto com o
     resto do estado pessoal.
   - "Analisar com IA" chama o Gemini DIRETO, com a chave que já está
     configurada em ⚙ Configurações (localStorage "af4:gemini-key").
   - Classifica os ativos (nota + selo + recomendação) com os mesmos
     critérios IdV do Aureus (criteriosIdV.js + scoreIdV.js).
   ============================================================ */
import { CRITERIOS_FII, CRITERIOS_ACOES, CRITERIOS_STOCK, CRITERIOS_REIT } from "./criteriosIdV.js";
import { calcularScoreIdV } from "./scoreIdV.js";
import { gerarJSONGemini } from "./gemini.js";

const CRIT_POR_CLASSE = { fii: CRITERIOS_FII, acao: CRITERIOS_ACOES, stock: CRITERIOS_STOCK, reit: CRITERIOS_REIT };

const KEY_FUND = "af4:fundamentos";
const KEY_MET = "af4:metodologia";

// Normaliza o tipo do ativo do app para a classe de critérios.
export function classeDoAtivo(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t === "fii") return "fii";
  if (t === "acao" || t === "acoes" || t === "ação") return "acao";
  if (t === "stock") return "stock";
  if (t === "reit") return "reit";
  return null; // cripto/tesouro/etc não têm classificação IdV
}

/* ---------- Persistência local ---------- */
function lerMapa(key) {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; }
  catch { return {}; }
}
function gravarMapa(key, mapa) {
  try { localStorage.setItem(key, JSON.stringify(mapa)); } catch {}
}

/** Carrega todos os fundamentos. Retorna mapa { TICKER: {ticker,classe,nome,dados,atualizado_em} }. */
export function carregarFundamentos() {
  const raw = lerMapa(KEY_FUND);
  const map = {};
  for (const k of Object.keys(raw)) map[String(k).toUpperCase()] = raw[k];
  return map;
}

/** Grava/atualiza um ativo na base pessoal. */
export function salvarFundamento({ ticker, classe, nome, dados }) {
  const tk = String(ticker || "").toUpperCase().trim();
  if (!tk) throw new Error("Informe o ticker.");
  const map = lerMapa(KEY_FUND);
  map[tk] = { ticker: tk, classe: classe || "fii", nome: nome || tk, dados: dados || {}, atualizado_em: new Date().toISOString() };
  gravarMapa(KEY_FUND, map);
  return map[tk];
}

/** Remove um ativo da base pessoal. */
export function removerFundamento(ticker) {
  const tk = String(ticker || "").toUpperCase().trim();
  const map = lerMapa(KEY_FUND);
  delete map[tk];
  gravarMapa(KEY_FUND, map);
}

/**
 * Classifica um ativo (nota + selo + recomendação) a partir dos fundamentos
 * curados. Retorna null se não houver registro/critérios pra ele.
 */
export function classificar(ativo, fundamentosMap) {
  const tk = String(ativo?.ticker || "").toUpperCase();
  const reg = fundamentosMap?.[tk];
  if (!reg) return null;
  const classe = classeDoAtivo(ativo.tipo) || reg.classe;
  const criterios = CRIT_POR_CLASSE[classe];
  if (!criterios) return null;

  const r = calcularScoreIdV(reg.dados || {}, criterios);
  // Recomendação simples a partir da nota (linguagem de ferramenta, não conselho).
  let recomendacao, recCor;
  if (r.score >= 70) { recomendacao = "Comprar"; recCor = "#1F7A3D"; }
  else if (r.score >= 40) { recomendacao = "Manter"; recCor = "#C99A2E"; }
  else { recomendacao = "Evitar"; recCor = "#B23B3B"; }
  return { ...r, recomendacao, recCor, classe, atualizado_em: reg.atualizado_em };
}

/* ---------- Metodologia (texto que guia a IA) ---------- */
export function carregarMetodologia(classe) {
  const map = lerMapa(KEY_MET);
  return map[classe] || "";
}
export function salvarMetodologia(classe, texto) {
  const map = lerMapa(KEY_MET);
  map[classe] = String(texto || "");
  gravarMapa(KEY_MET, map);
}

/* ---------- Análise com IA (Gemini, direto do navegador) ---------- */
/**
 * Pede ao Gemini pra preencher os indicadores de um ticker conforme os
 * critérios da classe + a metodologia salva, e grava na base pessoal.
 * Usa a chave do Gemini já configurada em ⚙ Configurações.
 */
export async function analisarComIA({ ticker, classe, nome, criterios }) {
  const tk = String(ticker || "").toUpperCase().trim();
  if (!tk) throw new Error("Informe o ticker antes de analisar.");
  const lista = Array.isArray(criterios) ? criterios : [];
  if (lista.length === 0) throw new Error("Sem critérios para esta classe.");

  const metodologia = carregarMetodologia(classe);

  const campos = lista.map(c => {
    const tipo = c.tipo === "opcao" ? `uma das opções [${(c.opcoes || []).join(", ")}]`
      : c.tipo === "numero" ? "número (só o valor)"
      : "texto curto";
    return `- "${c.id}" (${c.label}): ${tipo}`;
  }).join("\n");

  const prompt = `Você é um analista de investimentos. Avalie o ativo de ticker ${tk} (classe: ${classe}).
${metodologia ? `\nMETODOLOGIA E CRITÉRIOS DO ANALISTA (siga rigorosamente):\n${metodologia}\n` : ""}
Preencha os indicadores abaixo com os dados mais recentes e confiáveis que você conhece. Se não tiver certeza de um valor, faça a melhor estimativa fundamentada; se for impossível, deixe "".
Campos esperados (id: descrição):
${campos}

Responda APENAS um JSON válido no formato {"dados": { "<id>": <valor>, ... }, "resumo": "<1 frase>"}. Sem texto fora do JSON.`;

  const parsed = await gerarJSONGemini(prompt, { temperature: 0.2, maxOutputTokens: 2048 });
  const dados = parsed?.dados || parsed || {};
  const resumo = parsed?.resumo || "";

  // Grava na base pessoal já com o que a IA preencheu.
  salvarFundamento({ ticker: tk, classe, nome: nome || tk, dados });
  return { ok: true, ticker: tk, dados, resumo };
}
