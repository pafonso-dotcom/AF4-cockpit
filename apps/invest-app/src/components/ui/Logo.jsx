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
        <linearGradient id="aurumGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c9a961" />
          <stop offset="1" stopColor="#e6cd8f" />
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill="#0c0b0a" stroke="#c9a96155" strokeWidth="1.5" />
      <g fill="none" stroke="url(#aurumGrad)" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 47 L32 16 L46 47" />
        <path d="M24 36 H40" />
      </g>
    </svg>
  );
}

/**
 * Marca completa: símbolo + "Aurum" + sufixo ".investi".
 */
export default function Logo({ size = 28, sufixo = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
      <LogoMark size={size} />
      <span style={{ display: "inline-flex", alignItems: "baseline", gap: 1 }}>
        <span style={{
          fontFamily: T.serif, fontWeight: 600, fontSize: Math.round(size * 0.72),
          color: T.gold, letterSpacing: "-0.01em", lineHeight: 1,
        }}>Aurum</span>
        {sufixo && (
          <span style={{
            fontFamily: T.serif, fontWeight: 500, fontSize: Math.round(size * 0.42),
            color: T.muted, lineHeight: 1,
          }}>.investi</span>
        )}
      </span>
    </span>
  );
}
