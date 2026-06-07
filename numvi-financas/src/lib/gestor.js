/**
 * Gestor (admin) do produto comercial Afinanças.
 * O gestor vê o painel "Gerencial" e as Configurações; os clientes não.
 *
 * Sobrescreva no build com VITE_GESTOR_EMAILS (lista separada por vírgula).
 */
const ENV_EMAILS = (import.meta.env.VITE_GESTOR_EMAILS || "")
  .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

export const GESTOR_EMAILS = ENV_EMAILS.length ? ENV_EMAILS : ["p.afonso@me.com"];

export function isGestor(email) {
  if (!email) return false;
  return GESTOR_EMAILS.includes(String(email).trim().toLowerCase());
}

// URL do app (pra o convite por WhatsApp). Pode sobrescrever no build.
export const APP_URL = import.meta.env.VITE_APP_URL
  || "https://numvi-financas.p-afonso.workers.dev";
