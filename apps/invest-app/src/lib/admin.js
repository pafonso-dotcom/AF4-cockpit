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
