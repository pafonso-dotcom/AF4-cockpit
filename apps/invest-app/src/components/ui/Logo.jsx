import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Marca do produto Aureus.invest — símbolo "Alta": o "A" vermelho com uma
 * linha de alta VERDE cruzando por cima e um ponto que brilha no fim
 * (carteira subindo). Vetor (SVG): nítido em qualquer tamanho e serve de
 * favicon / ícone PWA.
 */
export function LogoMark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Aureus.invest" style={{ flexShrink: 0 }}>
      <defs>
        {/* linha de alta: verde escuro embaixo → verde claro em cima */}
        <linearGradient id="altaInvGrad" x1="12" y1="46" x2="52" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0F9D6B" />
          <stop offset="0.5" stopColor="#22C55E" />
          <stop offset="1" stopColor="#86EFAC" />
        </linearGradient>
      </defs>
      {/* tile azul-marinho (identidade do invest) */}
      <rect width="64" height="64" rx="15" fill="#0f1d35" />
      {/* "A" vermelho */}
      <text x="30" y="47" textAnchor="middle"
            fontFamily="'Inter', 'Nunito', system-ui, sans-serif" fontWeight="800" fontSize="40"
            fill="#a01e2e">A</text>
      {/* linha de alta verde cruzando por cima */}
      <polyline points="13,45 23,39 31,42 41,27 49,19" fill="none"
                stroke="url(#altaInvGrad)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* ponto que brilha no fim da linha */}
      <circle cx="49" cy="19" r="3.4" fill="#86EFAC" />
    </svg>
  );
}

/**
 * Marca completa: símbolo + "Aureus" + sufixo ".invest".
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
          letterSpacing: "-0.01em", lineHeight: 1,
        }}>
          <span style={{ color: "#a01e2e" }}>A</span>
          <span style={{ color: "#34C77B" }}>ureus</span>
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
