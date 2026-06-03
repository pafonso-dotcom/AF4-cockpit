/* ============================================================
   BRAND · este projeto (numvi-financas) é o produto COMERCIAL.
   Fixado em "comercial" — marca "·finanças" e tabelas numvi_com_*.
   (O app pessoal é o outro deploy, cars-web/af4cockpit.)
   ============================================================ */

// Fixo: ignora qualquer VITE_NUMVI_VARIANT do build (evita cair em "pessoal"
// por engano de configuração).
export const VARIANT = "comercial";

export const IS_COMERCIAL = VARIANT === "comercial";

// Sufixo cinza ao lado de "Numvi" no cabeçalho / login.
export const BRAND_SUFIXO = IS_COMERCIAL ? "·finanças" : "·pessoal";

// Tabelas de dados por variante. Permite que pessoal e comercial coexistam
// no MESMO projeto Supabase sem misturar dados: cada variante só lê/escreve
// nas suas próprias tabelas (e cada usuário só nas suas linhas, via RLS).
//   pessoal   → numvi_state / numvi_keys      (dados já existentes do dono)
//   comercial → numvi_com_state / numvi_com_keys
// Quando o comercial migrar para um projeto Supabase dedicado, basta apontar
// VITE_SUPABASE_URL/KEY para o novo projeto — os nomes de tabela continuam.
export const TABLE_STATE = IS_COMERCIAL ? "numvi_com_state" : "numvi_state";
export const TABLE_KEYS  = IS_COMERCIAL ? "numvi_com_keys"  : "numvi_keys";
