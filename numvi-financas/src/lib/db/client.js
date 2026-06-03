/**
 * lib/db/client.js · cliente Supabase pra novas tabelas relacionais.
 *
 * Re-exporta o supabase client e adiciona helpers de probing.
 * Convive com o blob `aurum_state` legado até cutover final.
 */
import { supabase } from "../supabase.js";

export { supabase };

/**
 * Verifica se a tabela `contas` (nova arquitetura) existe.
 * Usa código de erro Postgres 42P01 (relation does not exist).
 */
export async function tabelasNovasExistem() {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from("contas").select("id").limit(1);
    if (error && (error.code === "42P01" || /does not exist/i.test(error.message))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** Conta linhas de uma tabela (escopo do user atual via RLS). */
export async function contarRows(tabela) {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from(tabela)
    .select("*", { count: "exact", head: true });
  if (error) {
    console.warn(`[db] contarRows(${tabela}):`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Snapshot de contagens pra todas as tabelas principais (útil pra dashboard de migração). */
export async function snapshotContagens() {
  const tabelas = [
    "contas", "categorias", "transacoes", "ativos", "cartoes",
    "parcelamentos", "fixas", "fixa_ocorrencias", "compromissos",
    "objetivos_carteira", "carteiras_modelo",
    "proventos_recebidos", "provento_movimentos",
    "trade_watchlist", "trade_historico", "trade_analises_idv",
    "metas", "agenda", "habitos", "habito_check_ins", "diario",
    "compras", "ideias", "tarefas",
    "perfis", "user_preferences", "api_keys",
  ];

  const out = {};
  for (const t of tabelas) {
    out[t] = await contarRows(t);
  }
  return out;
}
