/* ============================================================
   SUPABASE · client + auth helpers
   Lê env vars no build (Vite injeta import.meta.env.VITE_*).
   Se nao configurado, exporta um stub que avisa no console.
   ============================================================ */

import { createClient } from "@supabase/supabase-js";

const URL  = import.meta.env.VITE_SUPABASE_URL;
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!(URL && KEY);

export const supabase = supabaseConfigured
  ? createClient(URL, KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

if (!supabaseConfigured && typeof window !== "undefined") {
  console.warn(
    "[AF4] Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build. App rodando 100% local (localStorage)."
  );
}

/* ============================================================
   Helpers de autenticação
   ============================================================ */

export async function signIn(email, password) {
  if (!supabase) throw new Error("Supabase nao configurado");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

const redirectURL = () =>
  typeof window !== "undefined" ? window.location.origin : undefined;

export async function signUp(email, password) {
  if (!supabase) throw new Error("Supabase nao configurado");
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectURL() },
  });
  if (error) throw error;
  return data;
}

export async function resetPassword(email) {
  if (!supabase) throw new Error("Supabase nao configurado");
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: redirectURL(),
  });
  if (error) throw error;
}

export async function updatePassword(password) {
  if (!supabase) throw new Error("Supabase nao configurado");
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => cb(session, event));
  return () => data.subscription.unsubscribe();
}

/* ============================================================
   Helpers de dados (aurum_state, aurum_keys)
   ============================================================ */

export async function fetchAurumState() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("aurum_state")
    .select("state")
    .maybeSingle();
  if (error) {
    console.error("[AF4] fetchAurumState", error);
    return null;
  }
  return data?.state ?? null;
}

export async function saveAurumState(state) {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;
  const { error } = await supabase
    .from("aurum_state")
    .upsert({ user_id: session.user.id, state }, { onConflict: "user_id" });
  if (error) console.error("[AF4] saveAurumState", error);
}

export async function fetchAurumKeys() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("aurum_keys")
    .select("keys")
    .maybeSingle();
  if (error) {
    console.error("[AF4] fetchAurumKeys", error);
    return null;
  }
  return data?.keys ?? null;
}

export async function saveAurumKeys(keys) {
  if (!supabase) return;
  const session = await getSession();
  if (!session) return;
  const { error } = await supabase
    .from("aurum_keys")
    .upsert({ user_id: session.user.id, keys }, { onConflict: "user_id" });
  if (error) console.error("[AF4] saveAurumKeys", error);
}
