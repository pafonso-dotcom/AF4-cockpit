import React from "react";

/**
 * Marca Afinanças — "A" + "finanças" nas cores "aurora" do card Patrimônio.
 * Símbolo "Alta / mini-card": o tile reproduz o gradiente aurora (azul · teal ·
 * sálvia · areia) e traz um "A" e uma linha de alta brancos, com o ponto areia
 * no fim — patrimônio subindo.
 *
 *   <AF4Mark size={36} />     → símbolo sozinho (favicon / mobile)
 *   <Logo size={28} />        → símbolo + "Afinanças"
 */

// Cores do wordmark (paleta aurora): azul-ardósia + azul suave.
const WORD_A = "#6f93a6";
const WORD_F = "#7fa8c4";
const DOT    = "#f0e6cf"; // ponto areia claro (glow do canto do card)

export function AF4Mark({ size = 36, gid }) {
  const id = gid || `af-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="Afinanças"
         xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        {/* base azul-ardósia → sálvia */}
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#6f93a6" /><stop offset="1" stopColor="#52756c" />
        </linearGradient>
        {/* manchas radiais do aurora (mesma receita do AURORA_BG) */}
        <radialGradient id={`${id}-1`} cx="0.15" cy="0.20" r="0.75">
          <stop stopColor="#7fa8c4" /><stop offset="0.55" stopColor="#7fa8c4" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-2`} cx="0.85" cy="0.15" r="0.6">
          <stop stopColor="#c9b48a" /><stop offset="0.5" stopColor="#c9b48a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-3`} cx="0.70" cy="0.90" r="0.75">
          <stop stopColor="#5b8a8f" /><stop offset="0.55" stopColor="#5b8a8f" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-sq`}><rect width="64" height="64" rx="15" /></clipPath>
      </defs>
      {/* tile aurora */}
      <g clipPath={`url(#${id}-sq)`}>
        <rect width="64" height="64" fill={`url(#${id}-b)`} />
        <rect width="64" height="64" fill={`url(#${id}-1)`} />
        <rect width="64" height="64" fill={`url(#${id}-2)`} />
        <rect width="64" height="64" fill={`url(#${id}-3)`} />
      </g>
      {/* "A" branco */}
      <text x="30" y="47" textAnchor="middle"
            fontFamily="'Inter', 'Nunito', system-ui, sans-serif" fontWeight="800" fontSize="40"
            fill="#ffffff">A</text>
      {/* linha de alta branca (com leve sombra pra separar do "A") */}
      <polyline points="13,45 23,39 31,42 41,27 49,19" fill="none"
                stroke="rgba(18,28,32,0.22)" strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="13,45 23,39 31,42 41,27 49,19" fill="none"
                stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* ponto que brilha no fim da linha */}
      <circle cx="49" cy="19" r="3.6" fill={DOT} />
    </svg>
  );
}

// Alias de compatibilidade — alguns lugares ainda importam NumviMark.
export const NumviMark = AF4Mark;

export default function Logo({
  size = 30,
  wordColor = WORD_F,
  sufixo = "",   // mantido por compat; o nome "Afinanças" já é uma palavra só
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.4 }}>
      <AF4Mark size={size * 1.3} />
      <span style={{
        fontFamily: "'Inter', 'Nunito', system-ui, -apple-system, sans-serif",
        fontWeight: 800, fontSize: size, letterSpacing: "-0.02em",
        lineHeight: 1, display: "inline-flex", alignItems: "baseline",
      }}>
        <span style={{ color: WORD_A }}>A</span>
        <span style={{ color: wordColor }}>finanças</span>
      </span>
    </div>
  );
}
