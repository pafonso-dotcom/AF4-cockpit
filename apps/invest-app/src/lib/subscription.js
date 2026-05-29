/* ============================================================
   ASSINATURA · status de cobrança do cliente (Fase 4 — estrutura)

   Lê a linha do usuário em `subscriptions` (Supabase). O acesso só é
   travado quando a cobrança está LIGADA (VITE_BILLING_ENABLED="true").
   Enquanto desligada, todo mundo entra (comportamento atual).
   ============================================================ */
import { supabase, supabaseConfigured, getUser } from "./supabase.js";

// Interruptor geral da cobrança (variável de ambiente do build).
export const billingEnabled = String(import.meta.env.VITE_BILLING_ENABLED || "") === "true";

export async function getSubscription() {
  if (!supabaseConfigured) return { active: true, status: "local" };
  const user = await getUser();
  if (!user) return { active: false, status: "no-user" };
  try {
    const { data, error } = await supabase
      .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!data) return { active: false, status: "none" };
    const agora = Date.now();
    const statusOk = ["active", "trialing"].includes(data.status);
    const valido = data.validade ? new Date(data.validade).getTime() > agora : false;
    const emTrial = data.trial_ate ? new Date(data.trial_ate).getTime() > agora : false;
    return { ...data, active: statusOk && (valido || emTrial) };
  } catch (e) {
    console.warn("[subscription] leitura falhou:", e.message);
    return { active: false, status: "error" };
  }
}

// Regra única de "pode usar o app?".
export function acessoLiberado(sub) {
  if (!billingEnabled) return true; // cobrança desligada → libera
  return !!sub?.active;
}
