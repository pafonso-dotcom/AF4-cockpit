/**
 * Lista plana de todos os destinos navegáveis do app (módulo + aba).
 * Usada pelo Command Palette (busca rápida Ctrl/Cmd+K).
 *
 * Cada item: { modulo, tab, label, grupo }
 *   - modulo/tab: o que setar pra navegar
 *   - label: nome da aba
 *   - grupo: nome do módulo (pra agrupar/contexto na busca)
 */
export const NAV_ITEMS = [
  // Finanças
  { modulo: "financas", tab: "dashboard",    label: "Painel",             grupo: "Finanças" },
  { modulo: "financas", tab: "contas",       label: "Contas",             grupo: "Finanças" },
  { modulo: "financas", tab: "cartoes",      label: "Cartões",            grupo: "Finanças" },
  { modulo: "financas", tab: "transacoes",   label: "Transações",         grupo: "Finanças" },
  { modulo: "financas", tab: "areceber",     label: "A Receber & Dívidas", grupo: "Finanças" },
  { modulo: "financas", tab: "fixas",        label: "Despesas Fixas",     grupo: "Finanças" },
  { modulo: "financas", tab: "analiseia",    label: "Análise IA",         grupo: "Finanças" },
  { modulo: "financas", tab: "planejamento", label: "Planejamento",       grupo: "Finanças" },
  { modulo: "financas", tab: "categorias",   label: "Categorias",         grupo: "Finanças" },
  { modulo: "financas", tab: "perguntar",    label: "Pergunte ao Claude", grupo: "Finanças" },
  { modulo: "financas", tab: "relatorios-f", label: "Relatórios",         grupo: "Finanças" },
  { modulo: "financas", tab: "audit",        label: "Histórico",          grupo: "Finanças" },

  // Agenda — incorporada ao módulo Finanças.
  { modulo: "financas", tab: "calendario", label: "Calendário",   grupo: "Agenda" },
  { modulo: "financas", tab: "notas",      label: "Compromissos", grupo: "Agenda" },
  { modulo: "financas", tab: "tarefas",    label: "Tarefas",      grupo: "Agenda" },
  { modulo: "financas", tab: "metas",      label: "Metas",        grupo: "Agenda" },
  { modulo: "financas", tab: "compras",    label: "Compras",      grupo: "Agenda" },
  { modulo: "financas", tab: "habitos",    label: "Hábitos",      grupo: "Agenda" },
  { modulo: "financas", tab: "diario",     label: "Diário",       grupo: "Agenda" },
  { modulo: "financas", tab: "ideias",     label: "Ideias",       grupo: "Agenda" },
  { modulo: "financas", tab: "inicio",     label: "Agenda · Início", grupo: "Agenda" },
  { modulo: "financas", tab: "sugestoes",  label: "Sugestões",    grupo: "Agenda" },
];

// Normaliza pra busca (sem acento, minúsculo)
export function normalizeBusca(s = "") {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function filtrarNav(query) {
  const q = normalizeBusca(query.trim());
  if (!q) return NAV_ITEMS;
  return NAV_ITEMS.filter(it =>
    normalizeBusca(it.label).includes(q) || normalizeBusca(it.grupo).includes(q)
  );
}
