/* Inicia a assinatura: chama o servidor (/api/checkout), que cria a
   preapproval no Mercado Pago, e redireciona pro pagamento. */
import { getSession } from "./supabase.js";
import { toast } from "./toast.js";

export async function iniciarAssinatura() {
  try {
    const s = await getSession();
    const token = s?.access_token;
    if (!token) throw new Error("Faça login para assinar.");
    const r = await fetch("/api/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok || !out.init_point) throw new Error(out.error || "Não foi possível iniciar o pagamento.");
    window.location.href = out.init_point;
  } catch (e) {
    toast.error(e.message || "Falha ao iniciar a assinatura.");
  }
}
