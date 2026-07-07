import React from "react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";

/* ============================================================
   UI "widget" compartilhada — ícone em anel, mini-sparkline e
   bloco de estatística (número grande e fino). Usada no Painel,
   Cartões e Relatórios para manter o mesmo visual.
   ============================================================ */

// Mini-sparkline (linha suave) — traços ilustrativos de tendência.
// `points` são valores relativos (0..n); depois dá pra plugar série real.
export function Sparkline({ points = [], cor, w = 52, h = 20 }) {
  if (points.length < 2) return null;
  const max = Math.max(...points), min = Math.min(...points);
  const range = max - min || 1;
  const step = w / (points.length - 1);
  const d = points.map((p, i) =>
    `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)} ${(h - 1.5 - ((p - min) / range) * (h - 3)).toFixed(1)}`
  ).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0, overflow: "visible" }} aria-hidden>
      <path d={d} fill="none" stroke={cor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
    </svg>
  );
}

// Ícone dentro de um anel fino — identidade dos blocos estilo widget.
export function RingIcon({ icon: Icon, cor, size = 34, stroke }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      border: `1.4px solid ${cor}`, color: cor,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Icon size={Math.round(size * 0.44)} strokeWidth={1.6} style={stroke ? { color: stroke } : undefined} />
    </div>
  );
}

// Bloco de estatística estilo widget: ícone em anel + rótulo, número grande e
// fino embaixo e (opcional) sparkline ao lado. `valor` já formatado OU número.
export function StatTile({ icon, cor = T.gold, label, valor, sub, spark, hidden, moeda }) {
  const oculto = !!hidden;
  const texto = typeof valor === "number" ? fmt(valor, moeda) : valor;
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: "11px 12px", minHeight: 92,
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {icon && <RingIcon icon={icon} cor={cor} size={30} />}
        <div style={{ fontSize: 10.5, lineHeight: 1.15, color: T.muted, fontWeight: 600 }}>{label}</div>
      </div>
      <div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, marginTop: 10 }}>
          <div className="num" style={{ fontSize: 16, fontWeight: 400, color: T.ink, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {oculto ? "•••" : texto}
          </div>
          {!oculto && spark && <Sparkline points={spark} cor={cor} w={44} h={20} />}
        </div>
        {sub && <div style={{ fontSize: 9.5, color: T.faint, marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}
