/* Inicia a assinatura via KIWIFY: redireciona o cliente logado pro checkout
   hospedado da Kiwify (URL em VITE_KIWIFY_CHECKOUT_URL), com o e-mail dele
   pré-preenchido — assim o webhook casa o pagamento com a conta certa. */
import { getUser } from "./supabase.js";
import { toast } from "./toast.js";

// Link do produto/checkout na Kiwify (painel Kiwify → produto → link de checkout).
// Aceita variações de nome da variável pra evitar erro de digitação no painel.
export const KIWIFY_CHECKOUT_URL = (
  import.meta.env.VITE_KIWIFY_CHECKOUT_URL ||
  import.meta.env.VITE_KIWIFY_CHECKOUT ||
  import.meta.env.VITE_KIWIFY_URL ||
  ""
).trim();

export async function iniciarAssinatura() {
  try {
    if (!KIWIFY_CHECKOUT_URL) {
      toast.error("Checkout indisponível: link da Kiwify não configurado.");
      return;
    }
    let destino = KIWIFY_CHECKOUT_URL;
    try {
      const user = await getUser();
      if (user?.email) {
        const u = new URL(KIWIFY_CHECKOUT_URL);
        // Pré-preenche e-mail (e nome, se houver) no checkout da Kiwify.
        u.searchParams.set("email", user.email);
        if (user.user_metadata?.nome) u.searchParams.set("name", user.user_metadata.nome);
        destino = u.toString();
      }
    } catch { /* segue sem pré-preencher */ }
    window.location.href = destino;
  } catch (e) {
    toast.error(e.message || "Falha ao iniciar a assinatura.");
  }
}
