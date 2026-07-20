import React from "react";

/**
 * Marca Afinanças — "A" (bordô) + "finanças" (dourado).
 * Símbolo "Alta": o "A" bordô com uma linha de alta dourada cruzando por cima,
 * terminando num ponto que brilha — patrimônio subindo.
 *
 *   <AF4Mark size={36} />     → símbolo sozinho (favicon / mobile)
 *   <Logo size={28} />        → símbolo + "Afinanças"
 */

const GOLD_HI = "#F6BC8E";
const GOLD_MD = "#ED9355";
const GOLD_LO = "#CF7A3C";
const BORDO   = "#9E2B3A"; // vermelho bordô do "A"

export function AF4Mark({ size = 36, bg = "#23272E", gid }) {
  const id = gid || `af-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="Afinanças"
         xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        {/* linha de alta: dourado escuro embaixo → claro em cima */}
        <linearGradient id={id} x1="12" y1="46" x2="52" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor={GOLD_LO} />
          <stop offset="0.5" stopColor={GOLD_MD} />
          <stop offset="1" stopColor={GOLD_HI} />
        </linearGradient>
      </defs>
      {/* fundo arredondado grafite */}
      <rect width="64" height="64" rx="15" fill={bg} />
      {/* "A" bordô */}
      <text x="30" y="47" textAnchor="middle"
            fontFamily="'Inter', 'Nunito', system-ui, sans-serif" fontWeight="800" fontSize="40"
            fill={BORDO}>A</text>
      {/* linha de alta cruzando por cima */}
      <polyline points="13,45 23,39 31,42 41,27 49,19" fill="none"
                stroke={`url(#${id})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* ponto que brilha no fim da linha */}
      <circle cx="49" cy="19" r="3.4" fill={GOLD_HI} />
    </svg>
  );
}

// Alias de compatibilidade — alguns lugares ainda importam NumviMark.
export const NumviMark = AF4Mark;

export default function Logo({
  size = 30,
  wordColor = GOLD_MD,
  sufixo = "",   // mantido por compat; o nome "Afinanças" já é uma palavra só
  bg = "#23272E",
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.4 }}>
      <AF4Mark size={size * 1.3} bg={bg} />
      <span style={{
        fontFamily: "'Inter', 'Nunito', system-ui, -apple-system, sans-serif",
        fontWeight: 800, fontSize: size, letterSpacing: "-0.02em",
        lineHeight: 1, display: "inline-flex", alignItems: "baseline",
      }}>
        <span style={{ color: BORDO }}>A</span>
        <span style={{ color: wordColor }}>finanças</span>
      </span>
    </div>
  );
}
