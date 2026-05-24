/**
 * Cliente de sync via Cloudflare KV.
 *
 * Token fica em localStorage("af4:sync-token") — você usa o mesmo token em
 * cada dispositivo pra ver os mesmos dados. Sem email, sem senha, sem confirmação.
 *
 * Endpoints (mesma origem do app):
 *   GET  /api/state  → { data: stateObject | null }
 *   PUT  /api/state  → body = stateObject
 *   GET  /api/keys   → { data: keysObject | null }
 *   PUT  /api/keys   → body = keysObject
 *   GET  /api/ping   → { ok: true, kv: bool }
 */

const TOKEN_KEY = "af4:sync-token";

export function getSyncToken() {
  try {
    return (localStorage.getItem(TOKEN_KEY) || "").trim();
  } catch { return ""; }
}

export function setSyncToken(token) {
  try {
    if (token && token.trim()) {
      localStorage.setItem(TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    window.dispatchEvent(new CustomEvent("af4:sync-token-changed"));
  } catch {}
}

export function clearSyncToken() {
  setSyncToken("");
}

/** Indica se sync está configurado (token presente). */
export function syncEnabled() {
  return !!getSyncToken();
}

/** Gera um token UUID v4 (não salva — chame setSyncToken pra persistir). */
export function gerarToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback pra browsers sem crypto.randomUUID
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & 15) >> (c / 4)).toString(16)
  );
}

async function api(method, path, body) {
  const token = getSyncToken();
  if (!token) throw new Error("Sync não configurado (sem token).");

  // Cache-bust: query string única + no-store impede CDN/SW de devolver
  // resposta stale.
  const sep = path.includes("?") ? "&" : "?";
  const url = `${path}${sep}_=${Date.now()}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        "Authorization": `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error(`Falha de rede: ${e?.message || e || "(unknown)"}`);
  }

  if (!res.ok) {
    let detail = "";
    let raw = "";
    try { raw = await res.text(); } catch {}
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        detail = parsed?.error || parsed?.stack || raw.slice(0, 200);
      } catch {
        detail = raw.slice(0, 200);
      }
    }
    throw new Error(`Sync ${res.status}: ${detail || res.statusText || `(corpo vazio, ${raw.length} bytes)`}`);
  }
  return res.json();
}

export async function pingSync() {
  try {
    const r = await fetch(`/api/ping?_=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return { ok: false, erro: `HTTP ${r.status}` };
    const data = await r.json();
    return { ok: true, kv: !!data.kv };
  } catch (e) {
    return { ok: false, erro: e?.message || String(e) };
  }
}

export async function testarToken() {
  if (!getSyncToken()) return { ok: false, erro: "Token não configurado." };
  try {
    await api("GET", "/api/state");
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

export async function cloudFetchState() {
  const { data } = await api("GET", "/api/state");
  return data;
}

export async function cloudSaveState(state) {
  return api("PUT", "/api/state", state);
}

export async function cloudFetchKeys() {
  const { data } = await api("GET", "/api/keys");
  return data;
}

export async function cloudSaveKeys(keys) {
  return api("PUT", "/api/keys", keys);
}
