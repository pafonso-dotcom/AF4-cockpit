// Tokens de estilo compartilhados — fonte única de verdade para os cards.
// Antes a string de sombra ficava copiada inline em vários arquivos, então
// mudar/remover a sombra exigia caçar cada cópia (e sempre sobrava uma).
// Agora é um lugar só.

// Sombra padrão dos cards (estilo SaaS, quase imperceptível no escuro).
export const CARD_SHADOW =
  "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)";

// Sombra de destaque (cards "elevados").
export const CARD_SHADOW_ELEVATED =
  "0 10px 28px rgba(16,24,40,.10), 0 2px 6px rgba(16,24,40,.06)";
