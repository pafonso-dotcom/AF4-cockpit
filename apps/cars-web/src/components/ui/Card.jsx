import React, { createContext, useContext } from "react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW, CARD_SHADOW_ELEVATED, CARD_SHADOW_SOFT } from "../../lib/styles.js";

// Ligado por telas que querem a "caixa suave" (ex.: o Painel): os Cards sem
// variant explícita ganham o box suave — fundo do card destacado do fundo, SEM
// linha de borda, com sombra leve. Só afeta quem estiver dentro do Provider; o
// resto do app continua com o card padrão.
export const SoftCardContext = createContext(false);

/**
 * Card base reutilizável — padroniza fundo/borda/raio/respiro dos painéis.
 * Variantes:
 *   default  → card padrão (fundo card + borda)
 *   elevated → com sombra (destaque)
 *   outlined → fundo transparente, só borda
 *   soft     → fundo suave (bgSoft)
 *   flat     → sem caixa (sem fundo/borda/sombra) — separa por espaço
 *   panel    → caixa suave (fundo card, sem borda, sombra leve, mais arredondada)
 * Sem variant explícita, herda "panel" quando dentro de SoftCardContext.
 * Aceita style/onClick/etc. via ...rest.
 */
export default function Card({ variant, style, children, ...rest }) {
  const soft = useContext(SoftCardContext);
  const v = variant || (soft ? "panel" : "default");
  const base = {
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 14,
    // Sombra suave estilo SaaS (quase imperceptível no escuro, elegante no claro).
    boxShadow: CARD_SHADOW,
  };
  const variants = {
    default: {},
    elevated: { boxShadow: CARD_SHADOW_ELEVATED },
    outlined: { background: "transparent", boxShadow: "none" },
    soft: { background: T.bgSoft, boxShadow: "none" },
    flat: { background: "transparent", border: "none", boxShadow: "none", borderRadius: 0, padding: 4 },
    panel: { border: "none", boxShadow: CARD_SHADOW_SOFT, borderRadius: 20 },
  };
  return (
    <div style={{ ...base, ...(variants[v] || {}), ...style }} {...rest}>
      {children}
    </div>
  );
}
