// ⏸️ PROJETO JARBAS PAUSADO (2026-09-23) — fora da UI; spec e prompt de
// retomada em docs/jarbas/JARBAS-PROMPT.md. Não apagar: repluga depois.
import React from "react";

/**
 * ORBE HUD do Jarbas — arte original (anéis, ticks, arcos, brilho ciano).
 *
 * PERFORMANCE (reforma 2026-09-22, "interface pesada"):
 * - Nada de drop-shadow animado: o glow é uma DIV atrás com blur FIXO,
 *   animando só opacity/transform (GPU).
 * - O nível da voz NÃO passa por props/estado React: o pai escreve a CSS
 *   var `--jnivel` (0..1) direto no DOM e o núcleo/glow reagem via calc().
 * - `estatico` (bolha flutuante): só o anel externo gira devagar; sem
 *   power-up, sem contra-rotação, sem glow — custo ~zero em toda tela.
 *
 * Props: size · fase ("idle"|"ouvindo"|"pensando"|"falando"|"mudo") ·
 * rotulo (texto central) · estatico.
 */
const CORES = {
  idle:     "#4dd0e1",
  ouvindo:  "#4dd0e1",
  pensando: "#7f9fb0",
  falando:  "#5ee6ff",
  mudo:     "#ff5c72",
};

export default function JarbasOrbe({ size = 180, fase = "idle", rotulo = "JARBAS", estatico = false }) {
  const cor = CORES[fase] || CORES.idle;
  const rapido = fase === "falando";

  return (
    <div className={estatico ? "" : "jorbe-powerup"}
         style={{ width: size, height: size, position: "relative" }}>
      {/* glow barato: blur fixo, anima opacity/scale via CSS var */}
      {!estatico && (
        <div aria-hidden style={{
          position: "absolute", inset: "-14%", borderRadius: "50%",
          background: `radial-gradient(circle, ${cor}55 0%, transparent 62%)`,
          filter: "blur(10px)",
          opacity: "min(calc(0.35 + var(--jnivel, 0) * 2.2), 0.95)",
          transform: "scale(min(calc(1 + var(--jnivel, 0) * 0.6), 1.25))",
          willChange: "opacity, transform",
          pointerEvents: "none",
        }} />
      )}
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: "block", position: "relative" }}>
        {/* anel externo de ticks */}
        <g className="jorbe-gira" style={{ animationDuration: estatico ? "40s" : rapido ? "7s" : "26s", willChange: "transform" }}>
          <circle cx="100" cy="100" r="94" fill="none" stroke={cor} strokeWidth="3"
                  strokeDasharray="2 7.2" opacity="0.85" />
          <circle cx="100" cy="100" r="86" fill="none" stroke={cor} strokeWidth="1"
                  strokeDasharray="14 30" opacity="0.5" />
        </g>
        {/* arcos segmentados em contra-rotação (fora no modo estático) */}
        {!estatico && (
          <g className="jorbe-gira-inv" style={{ animationDuration: rapido ? "5s" : "16s", willChange: "transform" }}>
            <circle cx="100" cy="100" r="72" fill="none" stroke={cor} strokeWidth="6"
                    strokeDasharray="52 38 20 38" strokeLinecap="round" opacity="0.9" />
            <circle cx="100" cy="100" r="62" fill="none" stroke={cor} strokeWidth="1.5"
                    strokeDasharray="4 9" opacity="0.55" />
          </g>
        )}
        {!estatico && (
          <g className="jorbe-gira" style={{ animationDuration: rapido ? "3.5s" : "11s", willChange: "transform" }}>
            <circle cx="100" cy="100" r="79" fill="none" stroke="#ffd166" strokeWidth="3"
                    strokeDasharray="34 462" strokeLinecap="round" opacity="0.9" />
          </g>
        )}
        {/* núcleo — escala pelo nível de voz via CSS var */}
        <g style={{
          transform: estatico ? "none" : "scale(min(calc(1 + var(--jnivel, 0) * 1.6), 1.28))",
          transformOrigin: "100px 100px", willChange: "transform",
        }}>
          <circle cx="100" cy="100" r="46" fill={`url(#jorbe-grad-${fase})`} opacity="0.95"
                  className={fase === "pensando" ? "jorbe-respira" : ""} />
          <circle cx="100" cy="100" r="46" fill="none" stroke={cor} strokeWidth="1.4" opacity="0.9" />
          <circle cx="100" cy="100" r="52" fill="none" stroke={cor} strokeWidth="0.7" opacity="0.4" />
        </g>
        <defs>
          <radialGradient id={`jorbe-grad-${fase}`} cx="38%" cy="32%">
            <stop offset="0%" stopColor="#eafcff" stopOpacity="0.95" />
            <stop offset="35%" stopColor={cor} stopOpacity="0.75" />
            <stop offset="100%" stopColor="#062a33" stopOpacity="0.9" />
          </radialGradient>
        </defs>
        {rotulo && (
          <text x="100" y="106" textAnchor="middle"
                style={{ fill: "#eafcff", fontSize: 15, fontWeight: 800, letterSpacing: "3.5px", fontFamily: "inherit" }}>
            {rotulo}
          </text>
        )}
      </svg>
      <style>{`
        .jorbe-gira { transform-origin: 100px 100px; animation: jorbe-rot linear infinite; }
        .jorbe-gira-inv { transform-origin: 100px 100px; animation: jorbe-rot-inv linear infinite; }
        .jorbe-respira { animation: jorbe-breathe 1.6s ease-in-out infinite; }
        .jorbe-powerup { animation: jorbe-boot .7s cubic-bezier(.2,.9,.3,1.2); }
        @keyframes jorbe-rot { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes jorbe-rot-inv { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes jorbe-breathe { 0%,100% { opacity: .95; } 50% { opacity: .6; } }
        @keyframes jorbe-boot { from { transform: scale(.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
