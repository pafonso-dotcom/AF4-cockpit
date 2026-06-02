import React from "react";

/**
 * Marca NUMVI — "dinheiro com visão".
 * Símbolo: um V dourado em forma de seta/pico ascendente (crescimento) —
 * o "V" de visão. Gradiente ouro premium sobre grafite. Escalável e nítido
 * em qualquer tamanho; cores fixas da marca (não mudam com a paleta).
 *
 *   <NumviMark size={36} />     → símbolo sozinho (favicon / mobile)
 *   <Logo size={28} />          → símbolo + "NUMVI" + tagline
 */

const GOLD_HI = "#F4D47C";
const GOLD_MD = "#E8C25A";
const GOLD_LO = "#B8902E";
const N_COLOR = "#7B1E2B"; // vermelho bordô do "N" do NUMVI

export function NumviMark({ size = 36, bg = "#23272E", gid }) {
  const id = gid || `numvi-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" role="img" aria-label="NUMVI"
         xmlns="http://www.w3.org/2000/svg" style={{ display: "block", flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="14" y1="14" x2="50" y2="50" gradientUnits="userSpaceOnUse">
          <stop stopColor={GOLD_HI} />
          <stop offset="0.5" stopColor={GOLD_MD} />
          <stop offset="1" stopColor={GOLD_LO} />
        </linearGradient>
      </defs>
      {/* fundo arredondado grafite */}
      <rect width="64" height="64" rx="15" fill={bg} />
      {/* V / seta ascendente — duas hastes que descem ao vale e sobem ao pico.
          O traço direito sobe MAIS alto (seta de alta / visão pra cima). */}
      <path d="M15 17 L30 47 L33 41 L22 17 Z" fill={`url(#${id})`} />
      <path d="M33 41 L46 13 L40 13 L30 35 Z" fill={`url(#${id})`} />
      {/* ponta da seta no topo do traço direito */}
      <path d="M46 13 L41.5 22 L49.5 20.5 Z" fill={`url(#${id})`} />
      {/* brilho sutil */}
      <path d="M15 17 L22 17 L29 31" stroke={GOLD_HI} strokeWidth="0.8" opacity="0.4" strokeLinecap="round" />
    </svg>
  );
}

export default function Logo({
  size = 30,
  wordColor = "#E8C25A",
  tagColor = "#9aa0ab",
  tagline = true,
  bg = "#23272E",
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.42 }}>
      <NumviMark size={size * 1.2} bg={bg} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
        <span style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700, fontSize: size * 0.78, letterSpacing: ".2em",
          color: wordColor,
        }}>
          <span style={{ color: N_COLOR }}>N</span>UMVI
        </span>
        {tagline && (
          <>
            <span style={{
              height: 1, marginTop: size * 0.17, marginBottom: size * 0.12,
              background: `linear-gradient(90deg, ${wordColor}, transparent)`,
            }} />
            <span style={{
              fontFamily: "Poppins, system-ui, sans-serif",
              fontSize: size * 0.255, letterSpacing: ".28em", textTransform: "uppercase",
              color: tagColor,
            }}>
              dinheiro com visão
            </span>
          </>
        )}
      </div>
    </div>
  );
}
