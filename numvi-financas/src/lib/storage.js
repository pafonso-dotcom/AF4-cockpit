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

// Chaves de cache PRÓPRIAS do comercial. Este domínio (numvi-financas) já foi
// usado como app pessoal e ficou cache pessoal ("financas:*") no localStorage.
// Com um prefixo distinto, o comercial NUNCA lê esse resíduo pessoal.
export const STORE_KEY  = "numvicom:dados:v1";
export const MARKET_KEY = "numvicom:mercado:v1";
export const KEYS_KEY   = "numvicom:apikeys:v1";

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

// Limpeza única (anti-vazamento): remove qualquer cache pessoal legado
// ("financas:*") deixado neste domínio quando ele servia o app pessoal — para
// nunca ser exibido nem copiado para um cliente do comercial.
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.startsWith("financas:")) localStorage.removeItem(k);
  }
} catch {}

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
      // Logado SEM dados na nuvem = conta LIMPA. NÃO adota o cache local (pode
      // ser dado antigo de outra tabela/variante) nem re-salva na nuvem — e
      // PURGA o cache pra não vazar dados em sessões seguintes.
      local.delete(k);
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
      local.delete(k);
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
