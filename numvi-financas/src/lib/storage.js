/* ============================================================
   STORAGE · persistência

   App é sempre offline-first com localStorage.
   Sync na nuvem (Cloudflare KV) é MANUAL via botões em Configurações
   → Backup ("Enviar pra nuvem" / "Baixar da nuvem") — não é automático.
   Isso evita problemas de cache do navegador interceptando requests
   automáticas e oferece mais previsibilidade.

   Supabase é mantido como caminho legado mas só ativa se houver sessão.
   ============================================================ */

import {
  supabaseConfigured, getSession,
  fetchAurumState, saveAurumState as supabaseSaveState,
  fetchAurumKeys, saveAurumKeys as supabaseSaveKeys,
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
   loadAll / saveAll — estado completo do app (localStorage)
   ============================================================ */

// Chave de cache local POR USUÁRIO. Sem isso, ao trocar de conta no mesmo
// dispositivo o app herdava o cache do usuário anterior (vazamento de dados).
const keyState = (session) => session ? `${STORE_KEY}:${session.user.id}` : STORE_KEY;
const keyKeys  = (session) => session ? `${KEYS_KEY}:${session.user.id}` : KEYS_KEY;

export const loadAll = async () => {
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const k = keyState(session);
      const remote = await fetchAurumState();
      if (remote) {
        local.set(k, remote);
        return remote;
      }
      // Só o cache DESTE usuário (nunca o de outra conta).
      const cached = local.get(k);
      if (cached) {
        await supabaseSaveState(cached);
        return cached;
      }
      // Conta nova / sem dados na nuvem → começa LIMPO (não herda nada).
      return null;
    }
  }

  // Default: localStorage (modo local, sem login)
  return local.get(STORE_KEY);
};

let saveTimer = null;
let lastDataRef = null;
const REMOTE_DEBOUNCE_MS = 1500;

export const saveAll = async (data, opts = {}) => {
  lastDataRef = data;

  // Sem Supabase → cache local global (modo local).
  if (!supabaseConfigured) { local.set(STORE_KEY, data); return; }

  const session = await getSession();
  // Cache local POR USUÁRIO (evita vazar pro próximo login no mesmo device).
  local.set(keyState(session), data);
  if (!session) return;

  if (opts.immediate) {
    clearTimeout(saveTimer);
    saveTimer = null;
    try { await supabaseSaveState(data); } catch (e) { console.warn("[storage] save falhou:", e.message); }
    return;
  }

  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    supabaseSaveState(lastDataRef).catch(e => console.warn("[storage] save falhou:", e.message));
  }, REMOTE_DEBOUNCE_MS);
};

export const flushSave = async () => {
  if (!supabaseConfigured || !lastDataRef) return;
  const session = await getSession();
  if (!session) return;
  clearTimeout(saveTimer);
  saveTimer = null;
  try { await supabaseSaveState(lastDataRef); } catch {}
};

/* ============================================================
   loadKeys / saveKeys — API keys (Brapi, Anthropic, etc.)
   ============================================================ */

export const loadKeys = async () => {
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const k = keyKeys(session);
      const remote = await fetchAurumKeys();
      if (remote) {
        local.set(k, remote);
        return remote;
      }
      const cached = local.get(k);
      if (cached) { await supabaseSaveKeys(cached); return cached; }
      return null;
    }
  }
  return local.get(KEYS_KEY);
};

let keysTimer = null;
let lastKeysRef = null;

export const saveKeys = async (data) => {
  lastKeysRef = data;
  if (!supabaseConfigured) { local.set(KEYS_KEY, data); return; }
  const session = await getSession();
  local.set(keyKeys(session), data);
  if (!session) return;
  clearTimeout(keysTimer);
  keysTimer = setTimeout(() => {
    supabaseSaveKeys(lastKeysRef).catch(() => {});
  }, REMOTE_DEBOUNCE_MS);
};
