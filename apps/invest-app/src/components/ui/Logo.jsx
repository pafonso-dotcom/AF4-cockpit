import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Marca do produto Aurum.
 * Símbolo "A" dourado (que evoca um pico / crescimento) sobre fundo escuro.
 * Vetor (SVG): nítido em qualquer tamanho e serve de favicon / ícone PWA.
 */
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Aurum" style={{ flexShrink: 0 }}>
      <defs>
        {/* Gradiente ouro da paleta: Ouro Profundo → Ouro → Ouro Claro */}
        <linearGradient id="aurumGold" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#F6E3A1" />
          <stop offset="0.5" stopColor="#E8C25A" />
          <stop offset="1" stopColor="#C9961F" />
        </linearGradient>
      </defs>
      {/* "A" triangular: triângulo externo com recorte interno + barra horizontal */}
      <path
        d="M32 6 L60 58 L4 58 Z M32 22 L18 50 L46 50 Z"
        fill="url(#aurumGold)" fillRule="evenodd"
      />
      {/* barra do "A" (atravessa o vão interno) */}
      <rect x="22" y="44" width="20" height="5" rx="1" fill="url(#aurumGold)" />
      {/* brilho na aresta esquerda do pico */}
      <path d="M32 6 L20 40" stroke="#fff6d8" strokeWidth="1" opacity="0.45" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Marca completa: símbolo + "Aurum" + sufixo ".invest".
 * Cores FIXAS da marca (dourado) — não mudam com a paleta, pra manter
 * identidade consistente (o logo vive numa barra de fundo escuro).
 */
export default function Logo({ size = 28, sufixo = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <LogoMark size={size} />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}>
        <span style={{
          fontFamily: T.serif, fontWeight: 600, fontSize: Math.round(size * 0.72),
          color: "#d4b87a", letterSpacing: "-0.01em", lineHeight: 1,
        }}>Aurum</span>
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
