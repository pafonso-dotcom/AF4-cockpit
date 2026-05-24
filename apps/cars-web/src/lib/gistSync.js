/**
 * Sync via GitHub Gist privado.
 *
 * Token (Personal Access Token com scope `gist`) fica em localStorage.
 * Cada dispositivo com o mesmo token vê os mesmos dados.
 *
 * Como funciona:
 *  - Na primeira vez: app procura um gist privado com a descrição abaixo;
 *    se não existir, cria um.
 *  - Save: PATCH no gist com o JSON do estado.
 *  - Load: GET no gist (usa raw_url se truncado).
 *
 * Vantagens vs Cloudflare KV:
 *  - api.github.com é domínio "neutro", iOS WebKit não tem regras anti-tracking
 *    como em *.workers.dev.
 *  - Token é PAT do GitHub (scope `gist`), revogável a qualquer momento.
 *  - Versionamento gratuito: histórico de cada edição fica no GitHub.
 */

const TOKEN_KEY       = "af4:gist-token";
const GIST_ID_KEY     = "af4:gist-id";        // cache do ID do gist
const GIST_DESCRIPTION = "AF4 Cockpit · Dados (gerado automaticamente — não apagar)";
const STATE_FILENAME  = "af4-cockpit-state.json";
const KEYS_FILENAME   = "af4-cockpit-keys.json";

export function getGistToken() {
  try { return (localStorage.getItem(TOKEN_KEY) || "").trim(); }
  catch { return ""; }
}

export function setGistToken(token) {
  try {
    if (token && token.trim()) {
      localStorage.setItem(TOKEN_KEY, token.trim());
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(GIST_ID_KEY);
    }
    window.dispatchEvent(new CustomEvent("af4:gist-token-changed"));
  } catch {}
}

export function gistEnabled() {
  return !!getGistToken();
}

function getCachedGistId() {
  try { return localStorage.getItem(GIST_ID_KEY) || null; }
  catch { return null; }
}

function setCachedGistId(id) {
  try {
    if (id) localStorage.setItem(GIST_ID_KEY, id);
    else localStorage.removeItem(GIST_ID_KEY);
  } catch {}
}

async function api(method, path, body, opts = {}) {
  const token = opts.token || getGistToken();
  if (!token) throw new Error("Token GitHub não configurado.");

  const url = path.startsWith("http") ? path : `https://api.github.com${path}`;

  let res;
  try {
    res = await fetch(url, {
      method,
      cache: "no-store",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
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
        detail = parsed?.message || raw.slice(0, 200);
      } catch {
        detail = raw.slice(0, 200);
      }
    }
    // Erros comuns traduzidos
    if (res.status === 401) detail = "Token inválido ou revogado. Gere um novo no GitHub.";
    if (res.status === 403 && /rate limit/i.test(detail)) detail = "Limite de uso do GitHub atingido (5000/h). Aguarde.";
    if (res.status === 404 && method !== "GET") detail = "Gist não encontrado. Foi apagado manualmente?";
    throw new Error(`GitHub ${res.status}: ${detail || res.statusText || "(sem detalhe)"}`);
  }
  return res.json();
}

/** Descobre (ou cria) o gist privado do AF4. Cacheia o ID. */
async function findOrCreateGist(token) {
  // Tenta cache primeiro
  const cached = getCachedGistId();
  if (cached) {
    try {
      // Valida que ainda existe e é nosso
      const g = await api("GET", `/gists/${cached}`, null, { token });
      if (g?.description === GIST_DESCRIPTION) return cached;
    } catch {
      // Cache inválido (gist deletado etc) — limpa e recria
      setCachedGistId(null);
    }
  }

  // Procura nos gists do usuário (até 100 mais recentes)
  const gists = await api("GET", "/gists?per_page=100", null, { token });
  const found = (gists || []).find(g => g.description === GIST_DESCRIPTION);
  if (found) {
    setCachedGistId(found.id);
    return found.id;
  }

  // Não existe — cria
  const created = await api("POST", "/gists", {
    description: GIST_DESCRIPTION,
    public: false,
    files: {
      [STATE_FILENAME]: { content: "{}" },
    },
  }, { token });

  setCachedGistId(created.id);
  return created.id;
}

/** Valida o token e retorna info do usuário. */
export async function testGistToken(tokenOverride) {
  const token = (tokenOverride ?? getGistToken()).trim();
  if (!token) return { ok: false, erro: "Token não configurado." };
  try {
    const user = await api("GET", "/user", null, { token });
    return { ok: true, login: user.login, name: user.name };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

async function fetchFileContent(file) {
  if (!file) return null;
  let content = file.content;
  // GitHub trunca arquivos >1MB; nesse caso baixa via raw_url
  if (file.truncated && file.raw_url) {
    const r = await fetch(file.raw_url, { cache: "no-store" });
    if (!r.ok) throw new Error(`Erro lendo raw_url: HTTP ${r.status}`);
    content = await r.text();
  }
  if (!content || !content.trim() || content.trim() === "{}") return null;
  try { return JSON.parse(content); }
  catch { return null; }
}

export async function gistFetchState() {
  const token = getGistToken();
  if (!token) throw new Error("Token GitHub não configurado.");
  const id = await findOrCreateGist(token);
  const gist = await api("GET", `/gists/${id}`, null, { token });
  return fetchFileContent(gist?.files?.[STATE_FILENAME]);
}

export async function gistSaveState(state) {
  const token = getGistToken();
  if (!token) throw new Error("Token GitHub não configurado.");
  const id = await findOrCreateGist(token);
  const content = JSON.stringify(state);
  await api("PATCH", `/gists/${id}`, {
    files: {
      [STATE_FILENAME]: { content },
    },
  }, { token });
  return { ok: true, bytes: content.length };
}

export async function gistFetchKeys() {
  const token = getGistToken();
  if (!token) throw new Error("Token GitHub não configurado.");
  const id = await findOrCreateGist(token);
  const gist = await api("GET", `/gists/${id}`, null, { token });
  return fetchFileContent(gist?.files?.[KEYS_FILENAME]);
}

export async function gistSaveKeys(keys) {
  const token = getGistToken();
  if (!token) throw new Error("Token GitHub não configurado.");
  const id = await findOrCreateGist(token);
  await api("PATCH", `/gists/${id}`, {
    files: {
      [KEYS_FILENAME]: { content: JSON.stringify(keys) },
    },
  }, { token });
}
