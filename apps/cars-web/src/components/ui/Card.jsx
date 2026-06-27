import React from "react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW, CARD_SHADOW_ELEVATED } from "../../lib/styles.js";

/**
 * Card base reutilizável — padroniza fundo/borda/raio/respiro dos painéis.
 * Variantes:
 *   default  → card padrão (fundo card + borda)
 *   elevated → com sombra (destaque)
 *   outlined → fundo transparente, só borda
 *   soft     → fundo suave (bgSoft)
 * Aceita style/onClick/etc. via ...rest.
 */
export default function Card({ variant = "default", style, children, ...rest }) {
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
  };
  return (
    <div style={{ ...base, ...(variants[variant] || {}), ...style }} {...rest}>
      {children}
    </div>
  );
}
