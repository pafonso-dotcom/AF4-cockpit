/* ============================================================
   STORAGE · persistência (3 modos, ordem de preferência):
   1. Cloud KV (Cloudflare Worker + KV) — se token configurado em
      localStorage("af4:sync-token"). Sync entre dispositivos sem login.
   2. Supabase — se configurado E user logado (legado).
   3. localStorage — fallback offline.
   Em todos, escreve em localStorage como cache local pra abrir rápido.
   ============================================================ */

import {
  supabaseConfigured, getSession,
  fetchAurumState, saveAurumState as supabaseSaveState,
  fetchAurumKeys, saveAurumKeys as supabaseSaveKeys,
} from "./supabase.js";
import {
  syncEnabled,
  cloudFetchState, cloudSaveState,
  cloudFetchKeys, cloudSaveKeys,
} from "./cloudSync.js";

export const STORE_KEY  = "financas:dados:v1";
export const MARKET_KEY = "financas:mercado:v1";
export const KEYS_KEY   = "financas:apikeys:v1";

const local = {
  get(key) {
    try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : null; }
    catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  delete(key) {
    try { localStorage.removeItem(key); } catch {}
  },
};

/* ============================================================
   loadAll / saveAll — estado completo do app
   ============================================================ */

export const loadAll = async () => {
  // 1. Cloud KV (Cloudflare) — preferido se token configurado
  if (syncEnabled()) {
    try {
      const remote = await cloudFetchState();
      if (remote) {
        local.set(STORE_KEY, remote);
        return remote;
      }
      // Sem dado remoto: promove localStorage atual pro cloud (migração)
      const cached = local.get(STORE_KEY);
      if (cached) {
        try { await cloudSaveState(cached); } catch {}
        return cached;
      }
      return null;
    } catch (e) {
      console.warn("[storage] cloud KV indisponível, usando localStorage:", e.message);
      return local.get(STORE_KEY);
    }
  }

  // 2. Supabase (legado)
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const remote = await fetchAurumState();
      if (remote) {
        local.set(STORE_KEY, remote);
        return remote;
      }
      const cached = local.get(STORE_KEY);
      if (cached) {
        await supabaseSaveState(cached);
        return cached;
      }
      return null;
    }
  }

  // 3. Fallback: localStorage puro
  return local.get(STORE_KEY);
};

// Debounce de save remoto pra evitar hammering ao trocar de aba/edição rápida
let saveTimer = null;
let lastDataRef = null;
const REMOTE_DEBOUNCE_MS = 1500;

export const saveAll = async (data, opts = {}) => {
  // SEMPRE persiste local imediatamente (UI optimistic, offline-friendly)
  local.set(STORE_KEY, data);
  lastDataRef = data;

  // Escolhe destino de sync (cloud KV tem precedência sobre Supabase)
  const useCloud = syncEnabled();
  const useSupabase = !useCloud && supabaseConfigured && !!(await getSession());
  if (!useCloud && !useSupabase) return;

  const doSave = async (payload) => {
    if (useCloud) return cloudSaveState(payload);
    return supabaseSaveState(payload);
  };

  if (opts.immediate) {
    // Bypass do debounce — usado em ações destrutivas (Limpar Dados)
    clearTimeout(saveTimer);
    saveTimer = null;
    try { await doSave(data); } catch (e) { console.warn("[storage] save falhou:", e.message); }
    return;
  }

  // Sync com debounce normal
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    doSave(lastDataRef).catch(e => console.warn("[storage] save falhou:", e.message));
  }, REMOTE_DEBOUNCE_MS);
};

// Força flush imediato do save pendente (chame antes de reload/navigate)
export const flushSave = async () => {
  if (!lastDataRef) return;
  if (syncEnabled()) {
    clearTimeout(saveTimer); saveTimer = null;
    try { await cloudSaveState(lastDataRef); } catch {}
    return;
  }
  if (supabaseConfigured) {
    const session = await getSession();
    if (!session) return;
    clearTimeout(saveTimer); saveTimer = null;
    try { await supabaseSaveState(lastDataRef); } catch {}
  }
};

/* ============================================================
   loadKeys / saveKeys — API keys (Brapi, Anthropic, etc.)
   ============================================================ */

export const loadKeys = async () => {
  if (syncEnabled()) {
    try {
      const remote = await cloudFetchKeys();
      if (remote) { local.set(KEYS_KEY, remote); return remote; }
      const cached = local.get(KEYS_KEY);
      if (cached) { try { await cloudSaveKeys(cached); } catch {} return cached; }
      return null;
    } catch {
      return local.get(KEYS_KEY);
    }
  }
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const remote = await fetchAurumKeys();
      if (remote) {
        local.set(KEYS_KEY, remote);
        return remote;
      }
      const cached = local.get(KEYS_KEY);
      if (cached) { await supabaseSaveKeys(cached); return cached; }
      return null;
    }
  }
  return local.get(KEYS_KEY);
};

let keysTimer = null;
let lastKeysRef = null;

export const saveKeys = async (data) => {
  local.set(KEYS_KEY, data);
  lastKeysRef = data;
  const useCloud = syncEnabled();
  const useSupabase = !useCloud && supabaseConfigured && !!(await getSession());
  if (!useCloud && !useSupabase) return;

  clearTimeout(keysTimer);
  keysTimer = setTimeout(() => {
    const save = useCloud ? cloudSaveKeys : supabaseSaveKeys;
    save(lastKeysRef).catch(() => {});
  }, REMOTE_DEBOUNCE_MS);
};
