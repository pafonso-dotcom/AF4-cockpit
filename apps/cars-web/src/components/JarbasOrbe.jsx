import React from "react";

/**
 * ORBE HUD do Jarbas — arte original inspirada em interfaces de filme de
 * ficção (anéis concêntricos, ticks, arcos girando, brilho ciano reativo).
 * SVG + CSS puro, sem libs. Ideias vindas da pesquisa de UIs "holográficas":
 * rotação lenta em idle, contra-rotação dos arcos, glow que pulsa com a voz
 * e sequência de "power-up" ao montar.
 *
 * Props: size (px) · nivel (0..1, volume do mic) · fase
 * ("idle"|"ouvindo"|"pensando"|"falando"|"mudo") · rotulo (texto central).
 */
const CORES = {
  idle:     "#4dd0e1",
  ouvindo:  "#4dd0e1",
  pensando: "#7f9fb0",
  falando:  "#5ee6ff",
  mudo:     "#ff5c72",
};

export default function JarbasOrbe({ size = 180, nivel = 0, fase = "idle", rotulo = "JARBAS" }) {
  const cor = CORES[fase] || CORES.idle;
  const rapido = fase === "falando";
  const glow = 6 + Math.min(nivel * 260, 46) + (rapido ? 10 : 0);
  const escalaCore = 1 + Math.min(nivel * 1.6, 0.28);

  return (
    <div style={{ width: size, height: size, position: "relative", filter: `drop-shadow(0 0 ${glow}px ${cor}aa)` }}
         className="jorbe-powerup">
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ display: "block" }}>
        {/* anel externo de ticks (relógio de HUD) */}
        <g className="jorbe-gira" style={{ animationDuration: rapido ? "7s" : "26s" }}>
          <circle cx="100" cy="100" r="94" fill="none" stroke={cor} strokeWidth="3"
                  strokeDasharray="2 7.2" opacity="0.85" />
          <circle cx="100" cy="100" r="86" fill="none" stroke={cor} strokeWidth="1"
                  strokeDasharray="14 30" opacity="0.5" />
        </g>
        {/* arcos segmentados em contra-rotação */}
        <g className="jorbe-gira-inv" style={{ animationDuration: rapido ? "5s" : "16s" }}>
          <circle cx="100" cy="100" r="72" fill="none" stroke={cor} strokeWidth="6"
                  strokeDasharray="52 38 20 38" strokeLinecap="round" opacity="0.9" />
          <circle cx="100" cy="100" r="62" fill="none" stroke={cor} strokeWidth="1.5"
                  strokeDasharray="4 9" opacity="0.55" />
        </g>
        {/* arco de destaque (tipo medidor) */}
        <g className="jorbe-gira" style={{ animationDuration: rapido ? "3.5s" : "11s" }}>
          <circle cx="100" cy="100" r="79" fill="none" stroke="#ffd166" strokeWidth="3"
                  strokeDasharray="34 462" strokeLinecap="round" opacity="0.9" />
        </g>
        {/* núcleo */}
        <g style={{ transform: `scale(${escalaCore})`, transformOrigin: "100px 100px", transition: "transform .09s linear" }}>
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
        {/* nome no centro */}
        <text x="100" y="106" textAnchor="middle"
              style={{ fill: "#eafcff", fontSize: 15, fontWeight: 800, letterSpacing: "3.5px", fontFamily: "inherit" }}>
          {rotulo}
        </text>
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
