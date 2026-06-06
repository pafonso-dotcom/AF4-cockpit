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
  const base = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 };
  const variants = {
    default: {},
    elevated: { boxShadow: "0 8px 24px rgba(0,0,0,.25)" },
    outlined: { background: "transparent" },
    soft: { background: T.bgSoft },
  };
  return (
    <div style={{ ...base, ...(variants[variant] || {}), ...style }} {...rest}>
      {children}
    </div>
  );
}
