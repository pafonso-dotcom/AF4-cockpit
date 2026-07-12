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

// Proteção contra sumiço de dados: NUNCA deixar uma coleção VAZIA vinda da
// nuvem apagar uma coleção CHEIA que já existe no aparelho. Ex.: se um estado
// com `cheques: []` (de outro aparelho, ou salvo antes dos dados carregarem)
// for pra nuvem, o carregamento seguinte não deve zerar os cheques locais.
// Regra: array cheio local vence array vazio/ausente remoto; no resto, remoto
// vence (é a fonte mais recente). Escalares e objetos seguem o remoto.
export function preservarNaoVazio(remote, localCache) {
  if (!remote || typeof remote !== "object") return remote;
  const base = localCache && typeof localCache === "object" ? localCache : {};
  const out = { ...base, ...remote }; // por padrão o remoto vence
  for (const k of Object.keys(base)) {
    const l = base[k];
    const r = remote[k];
    const localCheio = Array.isArray(l) && l.length > 0;
    const remotoVazio = r == null || (Array.isArray(r) && r.length === 0);
    if (localCheio && remotoVazio) out[k] = l; // preserva o local cheio
  }
  return out;
}

export const loadAll = async () => {
  // Supabase (legado) — só se logado
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const remote = await fetchAurumState();
      if (remote) {
        // Merge de segurança: coleção cheia local não é apagada por vazia remota.
        const merged = preservarNaoVazio(remote, local.get(STORE_KEY));
        local.set(STORE_KEY, merged);
        return merged;
      }
      const cached = local.get(STORE_KEY);
      if (cached) {
        await supabaseSaveState(cached);
        return cached;
      }
      return null;
    }
  }

  // Default: localStorage
  return local.get(STORE_KEY);
};

let saveTimer = null;
let lastDataRef = null;
const REMOTE_DEBOUNCE_MS = 1500;

export const saveAll = async (data, opts = {}) => {
  // SEMPRE persiste local imediatamente
  local.set(STORE_KEY, data);
  lastDataRef = data;

  // Sync no Supabase legado (se logado) — debounce
  if (!supabaseConfigured) return;
  const session = await getSession();
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
  if (!supabaseConfigured) return;
  const session = await getSession();
  if (!session) return;
  clearTimeout(keysTimer);
  keysTimer = setTimeout(() => {
    supabaseSaveKeys(lastKeysRef).catch(() => {});
  }, REMOTE_DEBOUNCE_MS);
};
