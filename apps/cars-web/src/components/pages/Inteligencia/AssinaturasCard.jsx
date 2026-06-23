import React from "react";
import { fmt } from "../../../lib/format.js";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { totalAssinaturas } from "../../../lib/inteligenciaPainel.js";
import { Vazio } from "./ScoreCard.jsx";

export default function AssinaturasCard({ assinaturas = [], hidden }) {
  if (!assinaturas.length) {
    return <Card><Vazio texto="Nenhuma assinatura recorrente detectada." /></Card>;
  }
  const { mensal, anual } = totalAssinaturas(assinaturas);
  return (
    <Card>
      <div style={{ fontSize: 12.5, color: T.ink, marginBottom: 10 }}>
        Você compromete <strong style={{ color: T.gold }}>{hidden ? "•••" : fmt(mensal)}/mês</strong>
        {" "}em assinaturas (<span className="num">{hidden ? "•••" : fmt(anual)}</span>/ano).
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {assinaturas.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.conhecida ? "★ " : ""}{a.descricao || "Assinatura"}
            </span>
            <span style={{ fontSize: 10.5, color: T.muted }}>{a.frequencia}</span>
            <span className="num" style={{ color: T.ink, fontWeight: 600 }}>{hidden ? "•••" : fmt(a.valorMedio)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
