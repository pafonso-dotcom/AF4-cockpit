import React, { createContext, useContext } from "react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW, CARD_SHADOW_ELEVATED } from "../../lib/styles.js";

// Ligado por telas que querem o layout "sem caixa" (ex.: o Painel): os Cards
// sem variant explícita ficam flat — sem fundo, borda ou sombra —, e o conteúdo
// respira direto sobre o fundo. Só afeta quem estiver dentro do Provider; o
// resto do app continua com o card padrão.
export const FlatCardContext = createContext(false);

/**
 * Card base reutilizável — padroniza fundo/borda/raio/respiro dos painéis.
 * Variantes:
 *   default  → card padrão (fundo card + borda)
 *   elevated → com sombra (destaque)
 *   outlined → fundo transparente, só borda
 *   soft     → fundo suave (bgSoft)
 *   flat     → sem caixa (sem fundo/borda/sombra) — separa por espaço
 * Sem variant explícita, herda "flat" quando dentro de FlatCardContext.
 * Aceita style/onClick/etc. via ...rest.
 */
export default function Card({ variant, style, children, ...rest }) {
  const flat = useContext(FlatCardContext);
  const v = variant || (flat ? "flat" : "default");
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
  };
  return (
    <div style={{ ...base, ...(variants[v] || {}), ...style }} {...rest}>
      {children}
    </div>
  );
}
