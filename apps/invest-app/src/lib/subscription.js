/* ============================================================
   ASSINATURA · status de cobrança do cliente (Fase 4)

   Lê a linha do usuário em `subscriptions` (Supabase). O acesso só é
   travado quando a cobrança está LIGADA (VITE_BILLING_ENABLED="true").

   Período de teste (trial): VITE_TRIAL_DIAS define quantos dias o cliente
   novo usa de graça. É calculado pela data de criação da conta (não precisa
   gravar nada no banco) — simples e seguro.
   ============================================================ */
import { supabase, supabaseConfigured, getUser } from "./supabase.js";

// Interruptor geral da cobrança (variável de ambiente do build).
// Tolerante a "true"/"True"/"TRUE"/"1" (evita erro de digitação no painel).
export const billingEnabled = /^(true|1|sim|on)$/i.test(String(import.meta.env.VITE_BILLING_ENABLED || "").trim());

// Dias de teste grátis pra contas novas (0 = sem trial).
export const trialDias = Math.max(0, Number(import.meta.env.VITE_TRIAL_DIAS) || 0);

// "Grandfather" do beta: contas criadas ANTES desta data têm acesso liberado
// pra sempre (os testers atuais não pagam). Só quem criar conta depois precisa
// assinar. Configurável por VITE_BETA_CUTOFF (ISO). Default: virada da comercialização.
export const betaCutoff = import.meta.env.VITE_BETA_CUTOFF || "2026-07-14T00:00:00Z";

export async function getSubscription() {
  if (!supabaseConfigured) return { active: true, status: "local" };
  const user = await getUser();
  if (!user) return { active: false, status: "no-user" };

  // Trial implícito: dias restantes desde a criação da conta.
  let trialRestante = 0;
  if (trialDias > 0 && user.created_at) {
    const fim = new Date(user.created_at).getTime() + trialDias * 86400000;
    trialRestante = Math.max(0, Math.ceil((fim - Date.now()) / 86400000));
  }

  // Grandfather: conta criada antes da virada da comercialização → acesso livre.
  const grandfathered = !!(betaCutoff && user.created_at
    && new Date(user.created_at).getTime() < new Date(betaCutoff).getTime());

  try {
    const { data, error } = await supabase
      .from("subscriptions").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;

    const agora = Date.now();
    const statusOk = data && ["active", "trialing"].includes(data.status);
    const valido = data?.validade ? new Date(data.validade).getTime() > agora : false;
    const emTrialBanco = data?.trial_ate ? new Date(data.trial_ate).getTime() > agora : false;
    const pago = !!(statusOk && (valido || emTrialBanco));

    if (pago) return { ...data, active: true, grandfathered, trialRestante };
    // Sem assinatura paga → vale grandfather do beta ou o trial implícito.
    return { ...(data || {}), status: data?.status || "none", active: grandfathered || trialRestante > 0, grandfathered, emTrial: trialRestante > 0, trialRestante };
  } catch (e) {
    console.warn("[subscription] leitura falhou:", e.message);
    return { active: grandfathered || trialRestante > 0, status: "error", grandfathered, emTrial: trialRestante > 0, trialRestante };
  }
}

export function acessoLiberado(sub) {
  if (!billingEnabled) return true; // cobrança desligada → libera
  return !!sub?.active;
}
