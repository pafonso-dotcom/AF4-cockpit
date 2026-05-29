// Config de fonte de dados por classe de ativo — preparado pra trocar no futuro.

const KEY_FONTE = "af4:fonte-dados";
const DEFAULT_FONTES = { fii: "planilha", acao: "planilha", stock: "manual", reit: "manual" };

export function lerFontes() {
  try { return { ...DEFAULT_FONTES, ...JSON.parse(localStorage.getItem(KEY_FONTE) || "{}") }; }
  catch { return { ...DEFAULT_FONTES }; }
}
export function salvarFontes(cfg) {
  try { localStorage.setItem(KEY_FONTE, JSON.stringify(cfg)); } catch {}
}

export const FONTES_DISPONIVEIS = [
  { id: "planilha",   label: "Planilha semanal", desc: "Importa do Excel", ativo: true },
  { id: "brapi-free", label: "BRAPI Free",       desc: "Preço + básicos", ativo: true },
  { id: "brapi-pro",  label: "BRAPI Pro",        desc: "Completo (requer token)", ativo: true },
  { id: "manual",     label: "Manual",           desc: "Você preenche", ativo: true },
];
