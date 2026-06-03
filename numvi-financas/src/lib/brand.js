/* ============================================================
   BRAND · variante do app (pessoal vs comercial)
   Definida em build via VITE_NUMVI_VARIANT:
     "pessoal"   (default) → uso pessoal do dono; dados no Supabase pessoal.
     "comercial"           → produto comercial; Supabase próprio (via env vars).
   Mesmo código-fonte, dois deploys distintos só pela variável de build.
   ============================================================ */

const RAW = String(import.meta.env.VITE_NUMVI_VARIANT || "pessoal").toLowerCase().trim();

// "financas"/"finanças" são aceites como sinónimos de comercial por conveniência.
export const VARIANT = (RAW === "comercial" || RAW === "financas" || RAW === "finanças")
  ? "comercial"
  : "pessoal";

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
