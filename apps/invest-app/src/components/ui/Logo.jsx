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
        <linearGradient id="aurumGold" x1="0" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#f6e6b0" />
          <stop offset="0.5" stopColor="#d9b450" />
          <stop offset="1" stopColor="#9a7322" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill="#0c0b0a" stroke="#c9a96144" strokeWidth="1.5" />
      {/* "A" dourado facetado */}
      <path d="M32,12 L50,52 L41,52 L37,41 L27,41 L23,52 L14,52 Z M32,25 L36,36 L28,36 Z"
            fill="url(#aurumGold)" fillRule="evenodd" />
      {/* dobra 3D: metade direita mais escura */}
      <path d="M32,12 L50,52 L41,52 L37,41 L32,41 L32,36 L36,36 L32,25 Z"
            fill="#3a2b08" opacity="0.28" />
      {/* brilho na aresta central */}
      <path d="M32,12 L32,25" stroke="#fff3cf" strokeWidth="0.8" opacity="0.5" />
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
