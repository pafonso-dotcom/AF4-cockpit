import React, { useState, useRef } from "react";
import JarbasOrbe from "./JarbasOrbe.jsx";

const POS_KEY = "af4:jarbas-bolha:v1";

/**
 * BOLHA flutuante do Jarbas — fica em cima do app inteiro (estilo chat head).
 * Toca → abre o Modo Conversa direto. Dá pra ARRASTAR pra qualquer canto
 * (posição lembrada). Some enquanto o Jarbas está aberto.
 */
export default function JarbasBolha({ onAbrir }) {
  const [pos, setPos] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || "null");
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
    } catch {}
    return null; // null = posição padrão (canto direito, acima do FAB)
  });
  const arrasto = useRef(null); // {dx, dy, moveu}

  const clampar = (x, y) => ({
    x: Math.min(Math.max(x, 4), window.innerWidth - 66),
    y: Math.min(Math.max(y, 4), window.innerHeight - 66),
  });

  const aoPointerDown = (e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    arrasto.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, moveu: false };
    el.setPointerCapture?.(e.pointerId);
  };
  const aoPointerMove = (e) => {
    if (!arrasto.current) return;
    const nx = e.clientX - arrasto.current.dx;
    const ny = e.clientY - arrasto.current.dy;
    // só vira arrasto depois de mexer de verdade (senão é toque)
    if (!arrasto.current.moveu) {
      const r = e.currentTarget.getBoundingClientRect();
      if (Math.abs(nx - r.left) < 6 && Math.abs(ny - r.top) < 6) return;
      arrasto.current.moveu = true;
    }
    setPos(clampar(nx, ny));
  };
  const aoPointerUp = () => {
    if (!arrasto.current) return;
    const moveu = arrasto.current.moveu;
    arrasto.current = null;
    if (moveu) {
      setPos(p => { try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch {} return p; });
    } else {
      onAbrir?.();
    }
  };

  const estilo = pos
    ? { left: pos.x, top: pos.y }
    : { right: 18, bottom: 216 }; // padrão: acima do FAB ＋

  return (
    <button
      onPointerDown={aoPointerDown}
      onPointerMove={aoPointerMove}
      onPointerUp={aoPointerUp}
      title="Jarbas — toca pra conversar, arrasta pra mover"
      aria-label="Abrir o Jarbas"
      className="no-print"
      style={{
        position: "fixed", zIndex: 190, ...estilo,
        width: 62, height: 62, padding: 0, borderRadius: "50%",
        background: "radial-gradient(circle at 35% 30%, #0e3a46, #041820 75%)",
        border: "1px solid #4dd0e155", cursor: "grab",
        display: "grid", placeItems: "center", touchAction: "none",
        willChange: "transform",
      }}>
      {/* estático = só o anel externo girando devagar (custo ~zero) */}
      <JarbasOrbe size={54} fase="idle" rotulo="" estatico />
    </button>
  );
}
