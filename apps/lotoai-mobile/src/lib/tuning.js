/* ============================================================
   TUNING · leitura dos pesos ajustados pelo Guru IA
   ─────────────────────────────────────────────────────────────
   public/tuning.json é atualizado pelo script tune-strategy.mjs
   automaticamente após cada import de concursos. O Combo IA lê
   os pesos daqui pra ajustar o mix de estratégias.
   ============================================================ */

let _cache = null;

export async function loadTuning() {
  if (_cache !== null) return _cache;
  try {
    const res = await fetch("./tuning.json", { cache: "no-cache" });
    if (res.ok) {
      _cache = await res.json();
      return _cache;
    }
  } catch {}
  _cache = null;
  return null;
}

/** Retorna os pesos ajustados; ou null se o tuning ainda não rodou */
export function pesosAjustados(tuning) {
  return tuning?.pesos || null;
}

/** Retorna o insight narrativo pra mostrar na UI */
export function insightAtual(tuning) {
  return tuning?.insight || null;
}
