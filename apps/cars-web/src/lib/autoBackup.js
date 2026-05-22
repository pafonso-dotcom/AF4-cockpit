/**
 * Backup automático no localStorage.
 *
 * Estratégia:
 * - 5 slots rotativos (mantém últimas 5 versões)
 * - Snapshot a cada X horas (default 6h) ou quando muito dado mudou
 * - Cada snapshot guarda data, tamanho e dados completos
 * - Backups antigos saem automaticamente quando passa de 5 slots
 *
 * Chaves no localStorage:
 *   af4:backup:meta       → array de { id, ts, label, sizeKb }
 *   af4:backup:slot-{id}  → JSON dos dados
 */

const META_KEY = "af4:backup:meta";
const SLOT_PREFIX = "af4:backup:slot-";
const MAX_SLOTS = 5;
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

const safeParse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const safeStr = (o) => { try { return JSON.stringify(o); } catch { return null; } };

/** Lista os backups disponíveis (mais novo primeiro). */
export function listBackups() {
  const raw = localStorage.getItem(META_KEY);
  const meta = safeParse(raw, []) || [];
  return [...meta].sort((a, b) => (b.ts || 0) - (a.ts || 0));
}

/** Cria um backup novo. Retorna metadata. */
export function createBackup(data, label = "auto") {
  try {
    const str = safeStr(data);
    if (!str) return null;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ts = Date.now();
    const sizeKb = Math.round(new Blob([str]).size / 1024);

    localStorage.setItem(SLOT_PREFIX + id, str);

    const meta = listBackups();
    meta.unshift({ id, ts, label, sizeKb });

    // Mantém só os MAX_SLOTS mais novos; remove os antigos do storage
    const keep = meta.slice(0, MAX_SLOTS);
    const remove = meta.slice(MAX_SLOTS);
    remove.forEach(m => {
      try { localStorage.removeItem(SLOT_PREFIX + m.id); } catch {}
    });

    localStorage.setItem(META_KEY, JSON.stringify(keep));
    return { id, ts, label, sizeKb };
  } catch (err) {
    console.warn("Falha ao criar backup:", err);
    return null;
  }
}

/** Recupera dados de um backup por id. */
export function readBackup(id) {
  const raw = localStorage.getItem(SLOT_PREFIX + id);
  return safeParse(raw, null);
}

/** Apaga um backup específico. */
export function deleteBackup(id) {
  try {
    localStorage.removeItem(SLOT_PREFIX + id);
    const meta = listBackups().filter(m => m.id !== id);
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

/** Decide se já passou tempo suficiente desde o último backup automático. */
export function shouldAutoBackup(intervalMs = DEFAULT_INTERVAL_MS) {
  const meta = listBackups();
  if (meta.length === 0) return true;
  const ultimoAuto = meta.find(m => m.label === "auto");
  if (!ultimoAuto) return true;
  return (Date.now() - ultimoAuto.ts) >= intervalMs;
}

/** Helper formata um timestamp de backup em PT-BR legível */
export function formatBackupDate(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}
