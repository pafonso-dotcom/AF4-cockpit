/* ============================================================
   SUPABASE · client para o LOTOAI APP PRO
   Env vars (Vite injeta no build):
     VITE_SUPABASE_URL
     VITE_SUPABASE_ANON_KEY
   Sem credenciais → modo local (mock no localStorage).
   ============================================================ */

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = !!(URL && KEY);

export const supabase = supabaseConfigured
  ? createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (!supabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[LOTOAI] Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Rodando em modo local."
  );
}

/* ---------------- Concursos ---------------- */

/**
 * Carrega concursos da Lotofácil. Tenta Supabase, cai para localStorage,
 * e por último devolve um histórico mock pequeno para o app abrir.
 */
export async function listarConcursos({ limite = 200 } = {}) {
  if (supabase) {
    const { data, error } = await supabase
      .from("lf_concursos")
      .select("numero, data, dezenas")
      .order("numero", { ascending: true })
      .limit(limite);
    if (!error && data?.length) return data;
  }
  const local = lerLocal();
  if (local.length) return local;
  // Histórico oficial empacotado · 3197 concursos (set/2003 → set/2024)
  try {
    const res = await fetch("./concursos.json");
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    }
  } catch {}
  return MOCK_CONCURSOS;
}

export function salvarConcursoLocal(c) {
  const lista = lerLocal();
  const idx = lista.findIndex(x => x.numero === c.numero);
  if (idx >= 0) lista[idx] = c;
  else lista.push(c);
  lista.sort((a, b) => a.numero - b.numero);
  localStorage.setItem("lotoai:concursos", JSON.stringify(lista));
}

/**
 * Merge incremental: pega o histórico atual + novos concursos,
 * deduplica por numero, salva ordenado em localStorage e (se configurado)
 * faz upsert no Supabase. Retorna a nova lista completa.
 */
export async function mergeConcursos(atual, novos) {
  if (!novos?.length) return atual;
  const mapa = new Map(atual.map(c => [c.numero, c]));
  for (const c of novos) mapa.set(c.numero, c);
  const final = [...mapa.values()].sort((a, b) => a.numero - b.numero);

  localStorage.setItem("lotoai:concursos", JSON.stringify(final));

  if (supabase) {
    try {
      await supabase.from("lf_concursos").upsert(
        novos.map(c => ({ numero: c.numero, data: c.data, dezenas: c.dezenas })),
        { onConflict: "numero" }
      );
    } catch (e) {
      console.warn("[LOTOAI] upsert Supabase falhou — usando só local:", e.message);
    }
  }
  return final;
}

function lerLocal() {
  try { return JSON.parse(localStorage.getItem("lotoai:concursos") || "[]"); }
  catch { return []; }
}

/* ---------------- Jogos do usuário ---------------- */

export async function salvarJogos(jogos, meta = {}) {
  const payload = jogos.map(dezenas => ({
    id: cryptoId(),
    dezenas,
    ...meta,
    created_at: new Date().toISOString(),
  }));
  if (supabase) {
    const { error } = await supabase.from("lf_jogos").insert(payload);
    if (!error) return { ok: true, remote: true };
  }
  const prev = JSON.parse(localStorage.getItem("lotoai:jogos") || "[]");
  localStorage.setItem("lotoai:jogos", JSON.stringify([...prev, ...payload]));
  return { ok: true, remote: false };
}

export async function listarJogos({ limite = 200 } = {}) {
  if (supabase) {
    const { data, error } = await supabase
      .from("lf_jogos")
      .select("id, dezenas, estrategia, concurso_alvo, created_at")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (!error && data) return data;
  }
  const local = JSON.parse(localStorage.getItem("lotoai:jogos") || "[]");
  return [...local].reverse().slice(0, limite);
}

export async function removerJogo(id) {
  if (supabase) {
    const { error } = await supabase.from("lf_jogos").delete().eq("id", id);
    if (!error) return { ok: true, remote: true };
  }
  const prev = JSON.parse(localStorage.getItem("lotoai:jogos") || "[]");
  localStorage.setItem("lotoai:jogos", JSON.stringify(prev.filter(j => j.id !== id)));
  return { ok: true, remote: false };
}

function cryptoId() {
  try { return crypto.randomUUID(); }
  catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

/* ---------------- Mock seed (offline / primeiro boot) ---------------- */

const MOCK_CONCURSOS = [
  { numero: 3000, data: "2025-01-08", dezenas: [1, 3, 4, 5, 7, 8, 10, 12, 14, 15, 17, 19, 20, 23, 25] },
  { numero: 3001, data: "2025-01-10", dezenas: [2, 3, 5, 6, 7, 9, 11, 13, 14, 16, 18, 20, 21, 24, 25] },
  { numero: 3002, data: "2025-01-13", dezenas: [1, 2, 4, 6, 8, 9, 10, 13, 15, 16, 19, 21, 22, 23, 24] },
  { numero: 3003, data: "2025-01-15", dezenas: [1, 3, 5, 7, 8, 11, 12, 13, 14, 17, 18, 20, 22, 24, 25] },
  { numero: 3004, data: "2025-01-17", dezenas: [2, 4, 6, 7, 9, 10, 11, 14, 15, 16, 18, 19, 21, 23, 25] },
  { numero: 3005, data: "2025-01-20", dezenas: [1, 2, 3, 5, 8, 10, 12, 13, 15, 17, 18, 20, 22, 23, 24] },
];
