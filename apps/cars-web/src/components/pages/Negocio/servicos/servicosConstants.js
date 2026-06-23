// Catálogo pronto de serviços típicos de agência (CRM, tráfego pago, etc).
// Usado pelo botão "Serviços de agência" pra pré-popular o catálogo.
export const SERVICOS_AGENCIA = [
  { nome: "Gestão de CRM", descricao: "Implantação e gestão mensal de CRM", precoSugerido: 1500, custoBase: 0 },
  { nome: "Tráfego Pago (Gestão)", descricao: "Gestão de campanhas (Meta/Google Ads) — fee mensal", precoSugerido: 1500, custoBase: 0 },
  { nome: "Social Media", descricao: "Planejamento e gestão de redes sociais", precoSugerido: 1200, custoBase: 0 },
  { nome: "Criação de Conteúdo", descricao: "Pacote mensal de posts/criativos", precoSugerido: 900, custoBase: 0 },
  { nome: "Landing Page", descricao: "Criação de página de captura/venda", precoSugerido: 1800, custoBase: 0 },
  { nome: "Criação de Site", descricao: "Site institucional ou e-commerce", precoSugerido: 3500, custoBase: 0 },
  { nome: "SEO", descricao: "Otimização para buscadores — fee mensal", precoSugerido: 1200, custoBase: 0 },
  { nome: "Automação / Funil", descricao: "Automação de marketing e funil de vendas", precoSugerido: 1500, custoBase: 0 },
  { nome: "Consultoria de Marketing", descricao: "Consultoria estratégica (hora/mês)", precoSugerido: 800, custoBase: 0 },
];

// Estilo base dos botões-ícone usados nas linhas/cards de Serviços.
export const btnIcon = (overrides = {}) => ({
  background: "transparent", border: "1px solid var(--bd)",
  color: "var(--tm)", padding: 6, borderRadius: 5, cursor: "pointer",
  minWidth: 32, minHeight: 32, display: "grid", placeItems: "center",
  ...overrides,
});
