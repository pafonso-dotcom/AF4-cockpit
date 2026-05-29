/* ============================================================
   SUPABASE · cliente de autenticação + nuvem (multi-tenant)

   As credenciais vêm de variáveis de ambiente (NUNCA hardcoded):
     VITE_SUPABASE_URL
     VITE_SUPABASE_ANON_KEY
   Defina-as num arquivo .env (veja .env.example) ou nas variáveis
   de build do seu provedor (Cloudflare/Vercel/etc).

   Se as variáveis não estiverem definidas, o app roda em "modo local"
   (sem login, dados só no navegador) — útil em desenvolvimento.
   ============================================================ */

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const supabaseConfigured = !!(URL && ANON);

export const supabase = supabaseConfigured
  ? createClient(URL, ANON, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

/* ---------- Sessão / usuário ---------- */
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function getUser() {
  const s = await getSession();
  return s?.user || null;
}

export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data?.subscription?.unsubscribe?.();
}

/* ---------- Ações de auth ---------- */
export async function signIn(email, senha) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function signUp(email, senha) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { data, error } = await supabase.auth.signUp({ email, password: senha });
  if (error) throw error;
  return data;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function resetPassword(email) {
  if (!supabase) throw new Error("Supabase não configurado.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
  });
  if (error) throw error;
}
