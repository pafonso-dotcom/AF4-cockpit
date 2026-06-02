import React from "react";

/**
 * Marca NUMVI — "dinheiro com visão" (formato wordmark estilo Aureus).
 * Símbolo: anel/moeda dourado com um "V" (visão) no centro.
 * Wordmark: "Numvi" sans-serif bold numa linha — N em bordô, resto dourado,
 * + sufixo descritor cinza opcional.
 *
 *   <NumviMark size={36} />     → símbolo sozinho (favicon / mobile)
 *   <Logo size={28} />          → símbolo + "Numvi" + sufixo
 */

const GOLD_HI = "#F4D47C";
const GOLD_MD = "#E8C25A";
const GOLD_LO = "#B8902E";
const N_COLOR = "#9E2B3A"; // vermelho bordô do "N" (mesmo tom do Aureus)

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
      {/* Anel (moeda / riqueza) */}
      <circle cx="32" cy="32" r="29" fill="none" stroke={`url(#${id})`} strokeWidth="3.5" />
      {/* "V" de visão — seta/pico ascendente no centro */}
      <path d="M20 22 L32 46 L34.6 40.8 L25.2 22 Z" fill={`url(#${id})`} />
      <path d="M34.6 40.8 L44 22 L38.8 22 L32 35.6 Z" fill={`url(#${id})`} />
    </svg>
  );
}

export default function Logo({
  size = 30,
  wordColor = GOLD_MD,
  sufixo = "",            // ex.: ".invest" / "finanças" — descritor cinza
  sufixoColor = "#9aa0ab",
  bg = "#23272E",
  // compat: chamadas antigas passavam tagline/tagColor — ignoradas no novo formato
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.4 }}>
      <NumviMark size={size * 1.3} bg={bg} />
      <span style={{
        fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
        fontWeight: 800, fontSize: size, letterSpacing: "-0.01em",
        lineHeight: 1, display: "inline-flex", alignItems: "baseline",
      }}>
        <span style={{ color: N_COLOR }}>N</span>
        <span style={{ color: wordColor }}>umvi</span>
        {sufixo && (
          <span style={{ color: sufixoColor, fontWeight: 500, fontSize: size * 0.62, marginLeft: size * 0.06 }}>
            {sufixo}
          </span>
        )}
      </span>
    </div>
  );
}
