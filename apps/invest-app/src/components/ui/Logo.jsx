import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Marca do produto AF.invest — moeda/anel com "A" (remete a moeda de ouro).
 * Anel duplo dourado + "A" central. Vetor (SVG): nítido em qualquer tamanho e
 * serve de favicon / ícone PWA.
 */
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="AF.invest" style={{ flexShrink: 0 }}>
      <defs>
        {/* Gradiente verde-oliva da marca: Claro → Médio → Profundo */}
        <linearGradient id="aurumGold" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#c2d6a5" />
          <stop offset="0.5" stopColor="#9dba79" />
          <stop offset="1" stopColor="#5d7548" />
        </linearGradient>
      </defs>
      {/* anel externo (moeda) */}
      <circle cx="32" cy="32" r="27" fill="none" stroke="url(#aurumGold)" strokeWidth="3" />
      {/* anel interno fino */}
      <circle cx="32" cy="32" r="21" fill="none" stroke="url(#aurumGold)" strokeWidth="1.2" opacity="0.5" />
      {/* "A" central */}
      <path d="M32 17 L43 47 L37 47 L34.3 39 L29.7 39 L27 47 L21 47 Z M32 27 L30.4 34 L33.6 34 Z"
            fill="url(#aurumGold)" fillRule="evenodd" />
    </svg>
  );
}

/**
 * Marca completa: símbolo + "AF" + sufixo ".invest" → "AF.invest".
 * Cores FIXAS da marca: "AF" em verde-oliva — identidade consistente sobre a
 * barra lateral de fundo escuro.
 */
export default function Logo({ size = 28, sufixo = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <LogoMark size={size} />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}>
        <span style={{
          fontFamily: T.serif, fontWeight: 600, fontSize: Math.round(size * 0.72),
          letterSpacing: "-0.01em", lineHeight: 1,
        }}>
          <span style={{ color: "#9dba79" }}>A</span>
          <span style={{ color: "#c2d6a5" }}>F</span>
        </span>
        {sufixo && (
          <span style={{
            fontFamily: T.serif, fontWeight: 500, fontSize: Math.round(size * 0.42),
            color: "rgba(232,224,205,.5)", lineHeight: 1,
          }}>.invest</span>
        )}
      </span>
    </span>
  );
}
