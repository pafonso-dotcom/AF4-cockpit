/**
 * Backups do app por usuário, no Supabase (tabela af4_backups).
 *
 * Estratégia:
 * - 5 slots por user; rotação automática (trigger after-insert no banco)
 * - Cada snapshot tem label ("auto" / "manual") e o state completo
 *   serializado em jsonb
 * - Isolamento entre users via RLS (auth.uid() = user_id)
 *
 * Sem sessão Supabase (modo dev/local), as operações viram no-ops
 * silenciosos pra não quebrar o fluxo do app.
 */

import { supabase, getSession } from "./supabase.js";

const MAX_SLOTS = 5;
const DEFAULT_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

function safeStr(o) {
  try { return JSON.stringify(o); } catch { return null; }
}

/** Lista backups do usuário logado (mais novo primeiro). Array vazio se offline. */
export async function listBackups() {
  if (!supabase) return [];
  const session = await getSession();
  if (!session) return [];
  const { data, error } = await supabase
    .from("af4_backups")
    .select("id, created_at, label, size_bytes")
    .order("created_at", { ascending: false })
    .limit(MAX_SLOTS);
  if (error) {
    console.warn("[AF4] listBackups", error);
    return [];
  }
  return (data || []).map(row => ({
    id: row.id,
    ts: new Date(row.created_at).getTime(),
    label: row.label,
    sizeKb: Math.round((row.size_bytes || 0) / 1024),
  }));
}

/** Cria um backup novo pro user logado. Retorna metadata ou null. */
export async function createBackup(data, label = "auto") {
  if (!supabase) return null;
  const session = await getSession();
  if (!session) return null;
  const str = safeStr(data);
  if (!str) return null;
  const sizeBytes = new Blob([str]).size;
  const { data: row, error } = await supabase
    .from("af4_backups")
    .insert({
      user_id: session.user.id,
      label,
      size_bytes: sizeBytes,
      payload: data,
    })
    .select("id, created_at, label, size_bytes")
    .single();
  if (error) {
    console.warn("[AF4] createBackup", error);
    return null;
  }
  return {
    id: row.id,
    ts: new Date(row.created_at).getTime(),
    label: row.label,
    sizeKb: Math.round((row.size_bytes || 0) / 1024),
  };
}

/** Lê o payload completo de um backup. Retorna null se não existir/erro. */
export async function readBackup(id) {
  if (!supabase || !id) return null;
  const { data, error } = await supabase
    .from("af4_backups")
    .select("payload")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.warn("[AF4] readBackup", error);
    return null;
  }
  return data?.payload ?? null;
}

/** Apaga um backup específico. */
export async function deleteBackup(id) {
  if (!supabase || !id) return false;
  const { error } = await supabase.from("af4_backups").delete().eq("id", id);
  if (error) {
    console.warn("[AF4] deleteBackup", error);
    return false;
  }
  return true;
}

/** Decide se já passou tempo suficiente desde o último backup automático. */
export async function shouldAutoBackup(intervalMs = DEFAULT_INTERVAL_MS) {
  if (!supabase) return false;
  const session = await getSession();
  if (!session) return false;
  const { data, error } = await supabase
    .from("af4_backups")
    .select("created_at")
    .eq("label", "auto")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.warn("[AF4] shouldAutoBackup", error);
    return false;
  }
  if (!data) return true;
  return (Date.now() - new Date(data.created_at).getTime()) >= intervalMs;
}

/** Helper formata um timestamp de backup em PT-BR legível. */
export function formatBackupDate(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "—"; }
}
