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
