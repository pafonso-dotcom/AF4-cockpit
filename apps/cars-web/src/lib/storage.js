/* ============================================================
   STORAGE · persistência
   - Se Supabase estiver configurado E user logado → usa Supabase
     (sync entre dispositivos).
   - Senão → localStorage do navegador (fallback offline).
   - Em ambos os casos, escreve em localStorage como cache local
     pra abrir rápido (offline-first).
   ============================================================ */

import {
  supabaseConfigured, getSession,
  fetchAurumState, saveAurumState as cloudSaveState,
  fetchAurumKeys, saveAurumKeys as cloudSaveKeys,
} from "./supabase.js";

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
  // Tenta Supabase primeiro se logado
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const remote = await fetchAurumState();
      if (remote) {
        // Atualiza cache local pra próxima abertura ser rápida
        local.set(STORE_KEY, remote);
        return remote;
      }
      // Sem dado remoto: tenta promover localStorage existente pro cloud
      const cached = local.get(STORE_KEY);
      if (cached) {
        await cloudSaveState(cached);
        return cached;
      }
      return null;
    }
  }
  // Fallback: localStorage puro
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

  if (!supabaseConfigured) return;
  const session = await getSession();
  if (!session) return;

  if (opts.immediate) {
    // Bypass do debounce — usado em ações destrutivas (Limpar Dados)
    // pra garantir que o cloud reflita antes do user recarregar.
    clearTimeout(saveTimer);
    saveTimer = null;
    await cloudSaveState(data);
    return;
  }

  // Cloud com debounce normal
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    cloudSaveState(lastDataRef);
  }, REMOTE_DEBOUNCE_MS);
};

// Força flush imediato do save pendente (chame antes de reload/navigate)
export const flushSave = async () => {
  if (!supabaseConfigured || !lastDataRef) return;
  const session = await getSession();
  if (!session) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  await cloudSaveState(lastDataRef);
};

/* ============================================================
   loadKeys / saveKeys — API keys (Brapi, Anthropic, etc.)
   ============================================================ */

export const loadKeys = async () => {
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const remote = await fetchAurumKeys();
      if (remote) {
        local.set(KEYS_KEY, remote);
        return remote;
      }
      const cached = local.get(KEYS_KEY);
      if (cached) { await cloudSaveKeys(cached); return cached; }
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
  if (supabaseConfigured) {
    const session = await getSession();
    if (!session) return;
    clearTimeout(keysTimer);
    keysTimer = setTimeout(() => {
      cloudSaveKeys(lastKeysRef);
    }, REMOTE_DEBOUNCE_MS);
  }
};
