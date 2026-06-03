import React from "react";

/**
 * Marca NUMVI — "dinheiro com visão" (Opção 3: N no anel/moeda).
 * Símbolo: anel dourado (moeda/riqueza) com a inicial "N" no centro.
 * Wordmark: "Numvi" sans-serif bold numa linha — N em bordô, "umvi" dourado,
 * + sufixo descritor cinza opcional (ex.: "·finanças").
 *
 *   <NumviMark size={36} />     → símbolo sozinho (favicon / mobile)
 *   <Logo size={28} sufixo="·finanças" />  → símbolo + "Numvi" + sufixo
 */

const GOLD_HI = "#F4D47C";
const GOLD_MD = "#E8C25A";
const GOLD_LO = "#B8902E";
const BORDO   = "#9E2B3A"; // vermelho bordô do "N"

export function NumviMark({ size = 36, bg = "#23272E", gid }) {
  const id = gid || `numvi-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="Numvi"
         xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor={GOLD_HI} />
          <stop offset="0.5" stopColor={GOLD_MD} />
          <stop offset="1" stopColor={GOLD_LO} />
        </linearGradient>
      </defs>
      {/* fundo arredondado grafite */}
      <rect width="64" height="64" rx="15" fill={bg} />
      {/* anel (moeda / riqueza) */}
      <circle cx="32" cy="32" r="23" fill="none" stroke={`url(#${id})`} strokeWidth="3.2" />
      {/* "A" no centro (Aurum) */}
      <text x="32" y="33" textAnchor="middle" dominantBaseline="central"
            fontFamily="'Nunito', system-ui, sans-serif" fontWeight="800" fontSize="34"
            fill={`url(#${id})`}>A</text>
    </svg>
  );
}

export default function Logo({
  size = 30,
  wordColor = GOLD_MD,
  sufixo = "",              // ex.: "·finanças" — descritor cinza
  sufixoColor = "#9aa0ab",
  bg = "#23272E",
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.4 }}>
      <NumviMark size={size * 1.3} bg={bg} />
      <span style={{
        fontFamily: "'Nunito', system-ui, -apple-system, sans-serif",
        fontWeight: 800, fontSize: size, letterSpacing: "-0.01em",
        lineHeight: 1, display: "inline-flex", alignItems: "baseline",
      }}>
        <span style={{ color: BORDO }}>A</span>
        <span style={{ color: wordColor }}>urum</span>
        {sufixo && (
          <span style={{ color: sufixoColor, fontWeight: 500, fontSize: size * 0.6, marginLeft: size * 0.05 }}>
            {sufixo}
          </span>
        )}
      </span>
    </div>
  );
}
