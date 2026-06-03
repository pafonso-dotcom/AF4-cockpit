/* ============================================================
   SEEDS · dados iniciais carregados quando o app é aberto pela primeira vez
   Por padrão, o cockpit começa LIMPO — só com categorias sugeridas
   pra você não ter trabalho. Adicione seus dados pelos botões "+ Novo".
   ============================================================ */

import { uid } from "./format.js";

// Categorias sugeridas (você pode renomear, apagar, ou criar novas pelas configurações)
export const seedCategorias = [
  // Receitas
  { id: uid(), nome: "Salário",      tipo: "receita", cor: "#7ea580", limite: null, subcategorias: [] },
  { id: uid(), nome: "Freelance",    tipo: "receita", cor: "#a3c9a8", limite: null, subcategorias: [] },
  { id: uid(), nome: "Dividendos",   tipo: "receita", cor: "#c9a96b", limite: null, subcategorias: [] },
  { id: uid(), nome: "Outros",       tipo: "receita", cor: "#9ab084", limite: null, subcategorias: [] },
  // Despesas
  { id: uid(), nome: "Moradia",      tipo: "despesa", cor: "#c47a6c", limite: null, subcategorias: [] },
  { id: uid(), nome: "Alimentação",  tipo: "despesa", cor: "#d49b8d", limite: null, subcategorias: [] },
  { id: uid(), nome: "Transporte",   tipo: "despesa", cor: "#b8826e", limite: null, subcategorias: [] },
  { id: uid(), nome: "Saúde",        tipo: "despesa", cor: "#7b95b3", limite: null, subcategorias: [] },
  { id: uid(), nome: "Educação",     tipo: "despesa", cor: "#9a8fb3", limite: null, subcategorias: [] },
  { id: uid(), nome: "Lazer",        tipo: "despesa", cor: "#e6c785", limite: null, subcategorias: [] },
  { id: uid(), nome: "Assinaturas",  tipo: "despesa", cor: "#b39a8f", limite: null, subcategorias: [] },
  { id: uid(), nome: "Cartão",       tipo: "despesa", cor: "#a47e6e", limite: null, subcategorias: [] },
  { id: uid(), nome: "Outros",       tipo: "despesa", cor: "#8a8a93", limite: null, subcategorias: [] },
];

// Tudo o que segue começa VAZIO — você adiciona pelos botões do app.
export const seedAtivos        = [];
export const seedContas        = [];
export const seedTransacoes    = [];
export const seedCartoes       = [];
export const seedParcelamentos = [];
export const seedDevedores     = [];
export const seedDividas       = [];

export const seedMetas         = [];

// Loja AF4
export const seedVeiculos      = [];
export const seedVendas        = [];
export const seedClientes      = [];
