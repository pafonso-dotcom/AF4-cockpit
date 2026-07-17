/* Inicia a assinatura via KIWIFY: redireciona o cliente logado pro checkout
   hospedado da Kiwify (URL em VITE_KIWIFY_CHECKOUT_URL), com o e-mail dele
   pré-preenchido — assim o webhook casa o pagamento com a conta certa. */
import { getUser } from "./supabase.js";
import { toast } from "./toast.js";

// Link de CHECKOUT (pagamento) da Kiwify — pay.kiwify.com.br/...
// Fallback fixo pro link oficial; a env var só é usada se for um link de
// checkout válido. Link curto kiwify.app/... é IGNORADO (aquele voltava pro
// app, porque era a "página de vendas", não o pagamento).
const CHECKOUT_PADRAO = "https://pay.kiwify.com.br/cUQdLRD";
const _envUrl = (
  import.meta.env.VITE_KIWIFY_CHECKOUT_URL ||
  import.meta.env.VITE_KIWIFY_CHECKOUT ||
  import.meta.env.VITE_KIWIFY_URL ||
  ""
).trim();
export const KIWIFY_CHECKOUT_URL =
  (_envUrl && !/kiwify\.app\//i.test(_envUrl)) ? _envUrl : CHECKOUT_PADRAO;

export async function iniciarAssinatura() {
  try {
    if (!KIWIFY_CHECKOUT_URL) {
      toast.error("Checkout indisponível: link da Kiwify não configurado.");
      return;
    }
    let destino = KIWIFY_CHECKOUT_URL;
    // Links curtos da Kiwify (kiwify.app/xxx) podem abrir em branco com
    // querystring extra — então esses vão PUROS. Só pré-preenchemos o e-mail
    // em links completos de checkout (pay.kiwify.com.br/...).
    const ehLinkCurto = /(^|\.)kiwify\.app\//i.test(KIWIFY_CHECKOUT_URL);
    if (!ehLinkCurto) {
      try {
        const user = await Promise.race([
          getUser(),
          new Promise((res) => setTimeout(() => res(null), 1200)),
        ]);
        if (user?.email) {
          const u = new URL(KIWIFY_CHECKOUT_URL);
          u.searchParams.set("email", user.email);
          if (user.user_metadata?.nome) u.searchParams.set("name", user.user_metadata.nome);
          destino = u.toString();
        }
      } catch { /* segue sem pré-preencher */ }
    }
    window.location.assign(destino);
  } catch (e) {
    toast.error(e.message || "Falha ao iniciar a assinatura.");
  }
}
