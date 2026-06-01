/* ============================================================
   ADMIN · acesso ao painel gerencial (só pro administrador)
   ============================================================ */
import { getSession } from "./supabase.js";

// E-mail do admin (build var). Usado só pra MOSTRAR a aba — a proteção real
// é no servidor (ADMIN_EMAIL no endpoint /api/admin).
export const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || "").toLowerCase();

export function ehAdmin(user) {
  return !!adminEmail && (user?.email || "").toLowerCase() === adminEmail;
}

export async function fetchAdminOverview() {
  const s = await getSession();
  const token = s?.access_token;
  if (!token) throw new Error("Sessão não encontrada.");
  const r = await fetch("/api/admin/overview", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}

/** Concede/estende (dias>0) ou encerra (dias<=0) o período de teste de um cliente. */
export async function definirTrial(userId, dias) {
  const s = await getSession();
  const token = s?.access_token;
  if (!token) throw new Error("Sessão não encontrada.");
  const r = await fetch("/api/admin/trial", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ user_id: userId, dias }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Erro ${r.status}`);
  return data;
}
