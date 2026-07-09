// Tokens de estilo compartilhados — fonte única de verdade para os cards.
// Antes a string de sombra ficava copiada inline em vários arquivos, então
// mudar/remover a sombra exigia caçar cada cópia (e sempre sobrava uma).
// Agora é um lugar só.

// Sombra padrão dos cards (estilo SaaS, quase imperceptível no escuro).
export const CARD_SHADOW =
  "0 2px 8px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.06)";

// Sombra de destaque (cards "elevados").
export const CARD_SHADOW_ELEVATED =
  "0 10px 28px rgba(16,24,40,.10), 0 2px 6px rgba(16,24,40,.06)";

// Superfície "aurora" do card de Patrimônio Total — reaproveitada em outros
// cards (Centro de Controle, Alocação por Moeda) pra manter a mesma cara.
// Texto/ícones devem ser brancos por cima dela.
export const AURORA_BG =
  "radial-gradient(120% 90% at 15% 20%, #7fa8c4 0%, transparent 55%)," +
  "radial-gradient(120% 100% at 85% 15%, #c9b48a 0%, transparent 50%)," +
  "radial-gradient(140% 120% at 70% 90%, #5b8a8f 0%, transparent 55%)," +
  "linear-gradient(135deg, #6f93a6, #52756c)";
