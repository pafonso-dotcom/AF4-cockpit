/* ============================================================
   CONFIG · constantes centrais do produto AF.invest
   ============================================================ */

// Endereço público do app usado nos convites/links.
// Usamos o domínio antigo aureus.inf.br (já ativo na Cloudflare) até o
// domínio de marca afinvest.inf.br ser registrado — aí é só trocar aqui.
export const APP_URL = "https://aureus.inf.br";

// Nome do produto (para textos/convites).
export const APP_NOME = "AF.invest";

// Plano/cobrança (Mercado Pago). O preço real do checkout fica no servidor
// (env PLANO_PRECO); aqui é só o que a tela do Paywall mostra.
export const PLANO_PRECO = Number(String(import.meta.env.VITE_PLANO_PRECO ?? "").replace(",", ".")) || 39.90;
export const PLANO_NOME = import.meta.env.VITE_PLANO_NOME || "Pro";
