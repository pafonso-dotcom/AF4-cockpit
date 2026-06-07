import React from "react";
import { T } from "../../lib/theme.js";

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
    background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14,
    // Sombra suave estilo SaaS (quase imperceptível no escuro, elegante no claro).
    boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
  };
  const variants = {
    default: {},
    elevated: { boxShadow: "0 10px 28px rgba(16,24,40,.10), 0 2px 6px rgba(16,24,40,.06)" },
    outlined: { background: "transparent", boxShadow: "none" },
    soft: { background: T.bgSoft, boxShadow: "none" },
  };
  return (
    <div style={{ ...base, ...(variants[variant] || {}), ...style }} {...rest}>
      {children}
    </div>
  );
}
