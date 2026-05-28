// Config de visibilidade dos cards do Painel (Visão Geral).
// Persistido em localStorage; lido pelo Dashboard e editado em Configurações → Aparência.

const KEY = "af4:dashboard-cards";

// Todos os cards possíveis do Painel (existentes + novos da Fase 2)
export const CARDS_DISPONIVEIS = [
  { id: "stat-cards",       label: "KPIs (Saldo · Receitas · Despesas)", fase: 1, fixo: true },
  { id: "saldo-previsto",   label: "Saldo previsto fim do mês",          fase: 1 },
  { id: "ultimos-12m",      label: "Gráfico Últimos 12 meses",           fase: 1 },
  { id: "por-classe",       label: "Investimentos por classe",           fase: 1 },
  { id: "por-categoria",    label: "Gastos por categoria",               fase: 1 },
  { id: "metas",            label: "Metas em curso",                     fase: 1 },
  { id: "ultimas-tx",       label: "Últimas transações",                 fase: 1 },
  // Fase 2 — novos
  { id: "donut-categorias", label: "🍩 Donut de categorias (novo)",       fase: 2 },
  { id: "waterfall",        label: "📊 Waterfall do mês (novo)",          fase: 2 },
  { id: "evolucao-saldo",   label: "📈 Evolução do saldo (novo)",         fase: 2 },
  // Relatórios financeiros (cards opcionais)
  { id: "rel-receita-despesa", label: "📊 Receita vs Despesa · 6 meses (relatório)", fase: 2 },
  { id: "rel-top-categorias",  label: "🏷 Top categorias do mês (relatório)",        fase: 2 },
  { id: "rel-cashflow",        label: "📈 Cashflow preditivo (relatório)",           fase: 2 },
];

const DEFAULT = {
  "stat-cards": true, "saldo-previsto": true, "ultimos-12m": true,
  "por-classe": true, "por-categoria": true, "metas": true, "ultimas-tx": true,
  "donut-categorias": false, "waterfall": false, "evolucao-saldo": false,
  "rel-receita-despesa": false, "rel-top-categorias": false, "rel-cashflow": false,
};

export function lerCardsConfig() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT };
    return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT };
  }
}

export function salvarCardsConfig(cfg) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
}

export function toggleCard(id) {
  const cfg = lerCardsConfig();
  cfg[id] = !cfg[id];
  salvarCardsConfig(cfg);
  return cfg;
}
