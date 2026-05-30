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

  // Investimentos
  { modulo: "invest", tab: "investimentos",  label: "Painel",              grupo: "Investimentos" },
  { modulo: "invest", tab: "carteira",       label: "Carteira",            grupo: "Investimentos" },
  { modulo: "invest", tab: "objetivos",      label: "Objetivos (árvore)",  grupo: "Investimentos" },
  { modulo: "invest", tab: "monte-carteira", label: "Monte sua Carteira",  grupo: "Investimentos" },
  { modulo: "invest", tab: "calc-renda",     label: "Calculadora",         grupo: "Investimentos" },
  { modulo: "invest", tab: "analises",       label: "Análises",            grupo: "Investimentos" },
  { modulo: "invest", tab: "proventos",      label: "Proventos",           grupo: "Investimentos" },
  { modulo: "invest", tab: "mercado",        label: "Mercado",             grupo: "Investimentos" },
  { modulo: "invest", tab: "relatorios-i",   label: "Relatórios",          grupo: "Investimentos" },

  // Negócio
  { modulo: "negocio", tab: "negocio-painel",   label: "Painel",   grupo: "Negócio" },
  { modulo: "negocio", tab: "negocio-veiculos", label: "Veículos", grupo: "Negócio" },
  { modulo: "negocio", tab: "negocio-servicos", label: "Serviços", grupo: "Negócio" },
  { modulo: "negocio", tab: "negocio-clientes", label: "Clientes", grupo: "Negócio" },

  // Agenda
  { modulo: "agenda", tab: "inicio",     label: "Início",       grupo: "Agenda" },
  { modulo: "agenda", tab: "notas",      label: "Compromissos", grupo: "Agenda" },
  { modulo: "agenda", tab: "calendario", label: "Calendário",   grupo: "Agenda" },
  { modulo: "agenda", tab: "tarefas",    label: "Tarefas",      grupo: "Agenda" },
  { modulo: "agenda", tab: "ideias",     label: "Ideias",       grupo: "Agenda" },
  { modulo: "agenda", tab: "sugestoes",  label: "Sugestões",    grupo: "Agenda" },
  { modulo: "agenda", tab: "metas",      label: "Metas",        grupo: "Agenda" },
  { modulo: "agenda", tab: "compras",    label: "Compras",      grupo: "Agenda" },
  { modulo: "agenda", tab: "habitos",    label: "Hábitos",      grupo: "Agenda" },
  { modulo: "agenda", tab: "diario",     label: "Diário",       grupo: "Agenda" },
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
