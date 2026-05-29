/* ============================================================
   CLOUD STORE · persistência do estado de Investimentos por usuário

   Multi-tenant: cada cliente (linha em `invest_state` keyada por user_id,
   protegida por RLS) só lê/escreve os próprios dados.

   Estratégia offline-first:
   - Sempre grava no localStorage imediatamente (cache).
   - Se houver sessão Supabase, sincroniza na nuvem (debounce no save).
   - No load, tenta nuvem primeiro; cai pro cache local se offline.
   ============================================================ */

import { supabase, supabaseConfigured, getUser } from "./supabase.js";

const STORE_KEY = "invest:dados:v1";
const TABLE = "invest_state";

const local = {
  get() { try { const v = localStorage.getItem(STORE_KEY); return v != null ? JSON.parse(v) : null; } catch { return null; } },
  set(v) { try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch {} },
};

/* ---------- Load ---------- */
export async function loadInvestState() {
  if (supabaseConfigured) {
    const user = await getUser();
    if (user) {
      try {
        const { data, error } = await supabase
          .from(TABLE).select("data").eq("user_id", user.id).maybeSingle();
        if (error) throw error;
        if (data?.data) { local.set(data.data); return data.data; }
        // Primeiro acesso na nuvem: se houver cache local, sobe ele.
        const cached = local.get();
        if (cached) { await saveInvestState(cached, { immediate: true }); return cached; }
        return null;
      } catch (e) {
        console.warn("[cloudStore] load falhou, usando cache local:", e.message);
        return local.get();
      }
    }
  }
  return local.get();
}

/* ---------- Save (local imediato + nuvem com debounce) ---------- */
let timer = null;
const DEBOUNCE_MS = 1200;

export async function saveInvestState(data, opts = {}) {
  local.set(data); // sempre local primeiro
  if (!supabaseConfigured) return;

  const flush = async () => {
    const user = await getUser();
    if (!user) return;
    try {
      const { error } = await supabase
        .from(TABLE)
        .upsert({ user_id: user.id, data, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      if (error) throw error;
    } catch (e) {
      console.warn("[cloudStore] save falhou (mantido em cache local):", e.message);
    }
  };

  if (opts.immediate) { clearTimeout(timer); timer = null; return flush(); }
  clearTimeout(timer);
  timer = setTimeout(flush, DEBOUNCE_MS);
}
