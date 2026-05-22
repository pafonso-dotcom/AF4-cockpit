/**
 * Audit log · histórico de alterações no app.
 * Cada operação relevante (criar/editar/excluir transação, venda, conta, etc)
 * registra uma entrada com timestamp, autor, ação, alvo e diff.
 *
 * Chave: af4:audit:v1 (rotativo, max 500 entradas; mais antigas saem primeiro)
 */

const KEY = "af4:audit:v1";
const MAX = 500;

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export function list() {
  return safe(() => {
    const raw = localStorage.getItem(KEY);
    const arr = JSON.parse(raw || "[]");
    return Array.isArray(arr) ? arr : [];
  }, []);
}

/**
 * action: "create" | "update" | "delete" | "system"
 * target: { tipo, nome, id }   ex: { tipo: "venda", nome: "Hyundai Creta", id: "..." }
 * meta:   { diff?, antes?, depois? }  livre
 */
export function log(action, target, meta = {}) {
  return safe(() => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ts: Date.now(),
      autor: "Paulo", // futuro: pegar do contexto de multi-user (item 11)
      action,
      target,
      meta,
    };
    const arr = list();
    arr.unshift(entry);
    const trimmed = arr.slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(trimmed));
    return entry;
  }, null);
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch {}
}

export function formatRelativeTime(ts) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d}d`;
  return new Date(ts).toLocaleDateString("pt-BR");
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(ts) {
  return new Date(ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/**
 * Helpers temáticos pra uso rápido em componentes.
 */
export const audit = {
  create: (tipo, nome, id, depois) => log("create", { tipo, nome, id }, { depois }),
  update: (tipo, nome, id, antes, depois) => log("update", { tipo, nome, id }, { antes, depois }),
  delete: (tipo, nome, id, antes) => log("delete", { tipo, nome, id }, { antes }),
  system: (descricao, meta = {}) => log("system", { tipo: "system", nome: descricao, id: null }, meta),
};
