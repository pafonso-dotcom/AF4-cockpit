// ============================================================
// Atualizar app (PWA) — força buscar a versão mais recente.
// Limpa o Cache Storage do service worker, manda o SW atualizar e recarrega.
// Resolve o caso "já fiz deploy mas o app continua a mostrar o antigo".
// ============================================================

export async function forcarAtualizacaoApp() {
  try {
    // 1. Limpa todos os caches do PWA (assets antigos ficam em Cache Storage).
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    // 2. Pede ao service worker para procurar uma versão nova.
    if (typeof navigator !== "undefined" && navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.update().catch(() => {})));
    }
  } catch {
    // best-effort — segue para o reload de qualquer forma
  }
  // 3. Recarrega com CACHE-BUSTER na URL (bug 2026-09-30: reload() da mesma
  // URL vinha do cache HTTP do iOS — que o JS não consegue limpar — e o app
  // "atualizava" pra própria versão velha). URL diferente = HTML fresco.
  // O boot limpa o parâmetro da barra de endereço (index.html).
  try {
    window.location.replace(window.location.origin + window.location.pathname + "?atualizado=" + Date.now());
  } catch {
    try { window.location.reload(); } catch {}
  }
}
