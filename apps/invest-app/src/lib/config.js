/* ============================================================
   CONFIG · constantes centrais do produto AF.invest
   ============================================================ */

// Endereço público oficial do app (domínio próprio).
// O .pages.dev segue funcionando, mas a URL "de marca" é esta.
export const APP_URL = "https://afinvest.inf.br";

// Nome do produto (para textos/convites).
export const APP_NOME = "AF.invest";

// Plano/cobrança (Mercado Pago). O preço real do checkout fica no servidor
// (env PLANO_PRECO); aqui é só o que a tela do Paywall mostra.
export const PLANO_PRECO = Number(import.meta.env.VITE_PLANO_PRECO) || 29.90;
export const PLANO_NOME = import.meta.env.VITE_PLANO_NOME || "Pro";
