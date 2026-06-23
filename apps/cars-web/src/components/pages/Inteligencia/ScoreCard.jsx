import React from "react";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";

// Score financeiro 0-1000 + faixa (nivel/cor) + fatores do breakdown.
export default function ScoreCard({ score, hidden }) {
  if (!score || !score.breakdown) {
    return <Card><Vazio texto="Registre mais transações para calcular seu score." /></Card>;
  }
  const pct = Math.max(0, Math.min(100, (score.total / 1000) * 100));
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: T.serif, fontSize: 34, fontWeight: 700, color: score.cor }}>
          {hidden ? "•••" : score.total}
        </span>
        <span style={{ fontSize: 13, color: T.muted }}>/ 1000</span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, color: score.cor,
                       textTransform: "uppercase", letterSpacing: ".06em" }}>{score.nivel}</span>
      </div>
      <div style={{ height: 6, borderRadius: 100, background: `${score.cor}22`, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: score.cor }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {score.breakdown.map((b, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, color: T.ink }}>{b.label}</span>
            <span className="num" style={{ color: T.muted }}>{hidden ? "•••" : `${Math.round(b.pts)}/${b.max}`}</span>
            <div style={{ width: 70, height: 4, borderRadius: 100, background: T.border, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, (b.pts / b.max) * 100))}%`, height: "100%",
                            background: b.pts / b.max >= 0.5 ? T.green : T.gold }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Vazio({ texto }) {
  return <div style={{ fontSize: 12.5, color: T.muted, fontStyle: "italic", padding: "8px 2px" }}>{texto}</div>;
}
export { Vazio };
