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

// FUSÃO POR COLEÇÃO — o antídoto do "last-write-wins engolir o outro aparelho".
// O blob mais novo (vencedor) dá a forma final, mas itens que SÓ existem no
// blob mais velho (perdedor) são reincorporados:
//  - arrays de objetos com `id`: união por id (item com mesmo id fica na
//    versão do vencedor; item criado só no perdedor volta pro fim da lista);
//  - arrays sem id: vencedor vazio + perdedor cheio → fica o perdedor
//    (mesma proteção do preservarNaoVazio);
//  - `proventosRecebidos` (objeto chaveado): união de chaves, vencedor manda;
//  - escalares/objetos: vencedor.
// Trade-off consciente: item DELETADO num aparelho pode "voltar" se o outro
// ainda o tinha — preferível a perder lançamentos novos. A tela Contas detecta
// dessincronia de saldo e o Reconciliar corrige.
export function fundirEstados(vencedor, perdedor) {
  if (!vencedor || typeof vencedor !== "object") return vencedor;
  if (!perdedor || typeof perdedor !== "object") return vencedor;
  const out = { ...vencedor };
  const chaves = new Set([...Object.keys(vencedor), ...Object.keys(perdedor)]);
  for (const k of chaves) {
    if (k.startsWith("_")) continue;
    const a = vencedor[k];
    const b = perdedor[k];
    if (Array.isArray(b)) {
      if (!Array.isArray(a) || a.length === 0) {
        if (b.length > 0 && (!Array.isArray(a) || a.length === 0)) out[k] = b; // proteção "vazio não apaga cheio"
        continue;
      }
      if (b.length === 0) continue;
      const comId = (x) => x && typeof x === "object" && x.id != null;
      if (a.every(comId) && b.every(comId)) {
        const ids = new Set(a.map((x) => x.id));
        const extras = b.filter((x) => !ids.has(x.id));
        if (extras.length) out[k] = [...a, ...extras];
      }
      // arrays sem id e ambos cheios: fica o vencedor (sem como casar itens)
    } else if (k === "proventosRecebidos" && a && b && typeof a === "object" && typeof b === "object") {
      out[k] = { ...b, ...a };
    } else if (a === undefined && b !== undefined) {
      out[k] = b; // chave que só o perdedor tem (coleção nova de app antigo/novo)
    }
  }
  return out;
}

// Decide entre o estado da NUVEM e o LOCAL usando o carimbo `_savedAt`,
// e FUNDE o perdedor no vencedor (fundirEstados) — assim uma edição feita
// no iPhone de manhã e outra no PC à tarde não se engolem mais: o blob mais
// novo dá a forma final e os itens criados no outro aparelho são mantidos.
export function mesclarEstado(remote, localCache) {
  const rt = Number(remote && remote._savedAt) || 0;
  const lt = Number(localCache && localCache._savedAt) || 0;
  if (localCache && lt > rt) {
    return { estado: fundirEstados(localCache, remote), localVenceu: true };
  }
  return { estado: fundirEstados(preservarNaoVazio(remote, localCache), localCache), localVenceu: false };
}

export const loadAll = async () => {
  // Supabase (legado) — só se logado
  if (supabaseConfigured) {
    const session = await getSession();
    if (session) {
      const remote = await fetchAurumState();
      if (remote) {
        // Última escrita vence pelo carimbo _savedAt (+ proteção de coleção
        // cheia local vs. vazia remota). Se o local é mais novo, reenvia p/ nuvem.
        const { estado, localVenceu } = mesclarEstado(remote, local.get(STORE_KEY));
        local.set(STORE_KEY, estado);
        if (localVenceu) {
          supabaseSaveState(estado).catch(e => console.warn("[storage] reenvio falhou:", e.message));
        }
        return estado;
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
  // Carimbo de última escrita — usado no load pra não deixar a nuvem antiga
  // reverter uma edição local ainda não sincronizada.
  const carimbado = { ...data, _savedAt: Date.now() };
  // SEMPRE persiste local imediatamente
  local.set(STORE_KEY, carimbado);
  lastDataRef = carimbado;
  data = carimbado;

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
