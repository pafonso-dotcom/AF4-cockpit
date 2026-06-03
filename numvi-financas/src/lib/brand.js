/* ============================================================
   BRAND · este projeto (numvi-financas) é o produto COMERCIAL.
   Fixado em "comercial" — marca "·finanças" e tabelas numvi_com_*.
   (O app pessoal é o outro deploy, cars-web/af4cockpit.)
   ============================================================ */

// Fixo: este projeto (numvi-financas) é SÓ o produto comercial. O app pessoal
// é um deploy separado (cars-web) com nome próprio — então aqui não há
// ambiguidade e ignoramos qualquer VITE_NUMVI_VARIANT.
export const VARIANT = "comercial";

export const IS_COMERCIAL = VARIANT === "comercial";

// Sufixo cinza ao lado de "Numvi" no cabeçalho / login.
export const BRAND_SUFIXO = IS_COMERCIAL ? "·finanças" : "·pessoal";

// Tabelas de dados por variante. Permite que pessoal e comercial coexistam
// no MESMO projeto Supabase sem misturar dados: cada variante só lê/escreve
// nas suas próprias tabelas (e cada usuário só nas suas linhas, via RLS).
//   pessoal   → aurum_state / aurum_keys       (onde os dados do dono já estão)
//   comercial → numvi_com_state / numvi_com_keys
// Nota: a tabela do pessoal é "aurum_state" (legado) — é lá que os dados
// existentes vivem. Um rename anterior para "numvi_state" apontava para uma
// tabela inexistente, quebrando o sync. Quando o comercial migrar para um
// projeto Supabase dedicado, basta apontar VITE_SUPABASE_URL/KEY para o novo.
export const TABLE_STATE = IS_COMERCIAL ? "numvi_com_state" : "aurum_state";
export const TABLE_KEYS  = IS_COMERCIAL ? "numvi_com_keys"  : "aurum_keys";
