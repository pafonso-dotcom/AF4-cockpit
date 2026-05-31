import React from "react";

/**
 * Marca Aurum — anel dourado (moeda / riqueza / ciclo) com um "A" em pico
 * (crescimento) no centro. Gradiente ouro premium, escalável e nítido em
 * qualquer tamanho. Cores fixas da marca (não mudam com a paleta).
 *
 *   <AurumMark size={36} />            → símbolo sozinho (favicon / mobile)
 *   <Logo size={28} />                 → símbolo + "AURUM" + tagline
 */

const GOLD_HI = "#F4D47C";
const GOLD_MD = "#E8C25A";
const GOLD_LO = "#B8902E";

export function AurumMark({ size = 36, ring = "#23272E", gid }) {
  const id = gid || `aurum-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="Aurum"
         role="img" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor={GOLD_HI} />
          <stop offset="0.5" stopColor={GOLD_MD} />
          <stop offset="1" stopColor={GOLD_LO} />
        </linearGradient>
      </defs>
      {/* Anel (moeda) — disco dourado com recorte interno */}
      <circle cx="32" cy="32" r="30" fill={`url(#${id})`} />
      <circle cx="32" cy="32" r="24.5" fill={ring} />
      {/* "A" em pico — duas pernas subindo até o cume + travessão */}
      <path d="M32 14 L45 47 L38.3 47 L32 30 L25.7 47 L19 47 Z" fill={`url(#${id})`} />
      <rect x="26.5" y="39.5" width="11" height="4" rx="1.2" fill={`url(#${id})`} />
      {/* brilho sutil na perna esquerda do pico */}
      <path d="M32 14 L25.7 30" stroke={GOLD_HI} strokeWidth="1.1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export default function Logo({
  size = 30,
  wordColor = "#E8C25A",
  tagColor = "#9aa0ab",
  tagline = true,
  ring = "#23272E",
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.42 }}>
      <AurumMark size={size * 1.22} ring={ring} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700, fontSize: size * 0.74, letterSpacing: ".16em",
          color: wordColor,
        }}>
          AURUM
        </span>
        {tagline && (
          <>
            <span style={{
              height: 1, marginTop: size * 0.17, marginBottom: size * 0.12,
              background: `linear-gradient(90deg, ${wordColor}, transparent)`,
            }} />
            <span style={{
              fontFamily: "Poppins, system-ui, sans-serif",
              fontSize: size * 0.265, letterSpacing: ".3em", textTransform: "uppercase",
              color: tagColor,
            }}>
              inteligência financeira
            </span>
          </>
        )}
      </div>
    </div>
  );
}
