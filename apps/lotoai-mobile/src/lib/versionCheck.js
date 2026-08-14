/* ============================================================
   VERSION CHECK · detecta se há build novo no servidor
   ─────────────────────────────────────────────────────────────
   O bundle é hasheado (index-XXX.js), então a URL do bundle no
   HTML muda a cada deploy. Comparando o hash atual (embutido
   no meu <script src>) com o do index.html remoto, dá pra
   detectar se sobrou versão nova.
   ============================================================ */

let _bundleAtual = null;

/** Extrai o nome do bundle atual do próprio <script src> */
export function bundleAtual() {
  if (_bundleAtual) return _bundleAtual;
  const scripts = document.querySelectorAll("script[src]");
  for (const s of scripts) {
    const m = s.src.match(/assets\/index-([^"/]+)\.js/);
    if (m) { _bundleAtual = m[1]; return _bundleAtual; }
  }
  return null;
}

/**
 * Busca o index.html remoto (com no-cache) e extrai o hash do bundle
 * mais recente. Retorna null se falhar.
 */
export async function bundleRemoto() {
  try {
    const url = new URL(location.href);
    url.searchParams.set("_v", Date.now());
    const res = await fetch(url.pathname + "?_v=" + Date.now(), {
      cache: "no-store",
      headers: { "Cache-Control": "no-cache" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const m = html.match(/assets\/index-([^"/]+)\.js/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/**
 * Retorna true se tem versão nova esperando.
 */
export async function temVersaoNova() {
  const atual = bundleAtual();
  const remoto = await bundleRemoto();
  return atual && remoto && atual !== remoto;
}

/**
 * Limpa caches (SW + HTTP) e recarrega a página.
 */
export async function forcarAtualizacao() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {}
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
  } catch {}
  // adiciona query-string pra bypassar todas as camadas de cache
  const url = new URL(location.href);
  url.searchParams.set("_r", Date.now());
  location.replace(url.toString());
}
