/* ============================================================
   FUNDAMENTOS · base central de curadoria + classificação automática

   - Lê a tabela `fundamentos` (Supabase) — mesma classificação pra todos.
   - Aplica os critérios IdV (criteriosIdV.js) + score (scoreIdV.js) sem o
     usuário preencher nada: a nota e o selo saem automáticos por ticker.
   - Escrita é feita só pelo admin via endpoint protegido /api/admin/fundamentos.
   ============================================================ */
import { supabase, supabaseConfigured, getSession } from "./supabase.js";
import { CRITERIOS_FII, CRITERIOS_ACOES, CRITERIOS_STOCK, CRITERIOS_REIT } from "./criteriosIdV.js";
import { calcularScoreIdV } from "./scoreIdV.js";

const CRIT_POR_CLASSE = { fii: CRITERIOS_FII, acao: CRITERIOS_ACOES, stock: CRITERIOS_STOCK, reit: CRITERIOS_REIT };

// Normaliza o tipo do ativo do app para a classe de critérios.
export function classeDoAtivo(tipo) {
  const t = String(tipo || "").toLowerCase();
  if (t === "fii") return "fii";
  if (t === "acao" || t === "acoes" || t === "ação") return "acao";
  if (t === "stock") return "stock";
  if (t === "reit") return "reit";
  return null; // cripto/tesouro/etc não têm classificação IdV
}

let _cache = null;
let _cacheAt = 0;

/** Carrega todos os fundamentos (cacheado por 5 min). Retorna mapa { TICKER: {classe,nome,dados} }. */
export async function carregarFundamentos(force = false) {
  if (!supabaseConfigured) return {};
  if (!force && _cache && Date.now() - _cacheAt < 5 * 60_000) return _cache;
  try {
    const { data, error } = await supabase.from("fundamentos").select("*");
    if (error) throw error;
    const map = {};
    for (const r of (data || [])) map[String(r.ticker).toUpperCase()] = r;
    _cache = map; _cacheAt = Date.now();
    return map;
  } catch (e) {
    console.warn("[fundamentos] leitura falhou:", e.message);
    return _cache || {};
  }
}

/**
 * Classifica um ativo (nota + selo + comprar/manter) a partir dos fundamentos
 * curados. Retorna null se não houver dados/critérios pra ele.
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

/* ---------- Admin: gravar fundamentos (via endpoint protegido) ---------- */
export async function salvarFundamento({ ticker, classe, nome, dados }) {
  const s = await getSession();
  const token = s?.access_token;
  if (!token) throw new Error("Sessão não encontrada.");
  const r = await fetch("/api/admin/fundamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ticker, classe, nome, dados }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `Erro ${r.status}`);
  _cache = null; // invalida cache
  return out;
}

/* ---------- Análise com IA (admin) ---------- */
// Pede à IA (servidor) pra preencher os indicadores de um ticker conforme os
// critérios da classe + a metodologia cadastrada, e grava em fundamentos.
export async function analisarComIA({ ticker, classe, nome, criterios }) {
  const s = await getSession();
  const token = s?.access_token;
  if (!token) throw new Error("Sessão não encontrada.");
  const r = await fetch("/api/admin/analisar", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ticker, classe, nome, criterios }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `Erro ${r.status}`);
  _cache = null;
  return out;
}

/* ---------- Metodologia (admin) ---------- */
export async function carregarMetodologia(classe) {
  if (!supabaseConfigured) return "";
  try {
    const { data, error } = await supabase.from("metodologia").select("texto").eq("classe", classe).maybeSingle();
    if (error) throw error;
    return data?.texto || "";
  } catch { return ""; }
}

export async function salvarMetodologia(classe, texto) {
  const s = await getSession();
  const token = s?.access_token;
  if (!token) throw new Error("Sessão não encontrada.");
  const r = await fetch("/api/admin/metodologia", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ classe, texto }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || `Erro ${r.status}`);
  return out;
}
