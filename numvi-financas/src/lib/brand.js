/* ============================================================
   BRAND · variante do app (pessoal vs comercial)
   Definida em build via VITE_NUMVI_VARIANT:
     "pessoal"   (default) → uso pessoal do dono; dados no Supabase pessoal.
     "comercial"           → produto comercial; Supabase próprio (via env vars).
   Mesmo código-fonte, dois deploys distintos só pela variável de build.
   ============================================================ */

// Default "pessoal" por segurança: o Worker pessoal não define a variável,
// então sem ela o app cai no ambiente do dono (dados em numvi_state) em vez de
// expor o shell comercial / esconder os dados pessoais. O deploy COMERCIAL
// define VITE_NUMVI_VARIANT=comercial explicitamente.
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
//   pessoal   → aurum_state / aurum_keys       (onde os dados do dono já estão)
//   comercial → numvi_com_state / numvi_com_keys
// Nota: a tabela do pessoal é "aurum_state" (legado) — é lá que os dados
// existentes vivem. Um rename anterior para "numvi_state" apontava para uma
// tabela inexistente, quebrando o sync. Quando o comercial migrar para um
// projeto Supabase dedicado, basta apontar VITE_SUPABASE_URL/KEY para o novo.
export const TABLE_STATE = IS_COMERCIAL ? "numvi_com_state" : "aurum_state";
export const TABLE_KEYS  = IS_COMERCIAL ? "numvi_com_keys"  : "aurum_keys";
