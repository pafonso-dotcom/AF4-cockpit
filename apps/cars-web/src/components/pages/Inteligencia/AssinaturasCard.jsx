import React from "react";
import { fmt } from "../../../lib/format.js";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { totalAssinaturas } from "../../../lib/inteligenciaPainel.js";
import { Vazio } from "./ScoreCard.jsx";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export default function AssinaturasCard({ assinaturas = [], fixas = [], hidden, onTabChange }) {
  if (!assinaturas.length) {
    return <Card><Vazio texto="Nenhuma assinatura recorrente detectada." /></Card>;
  }
  const fixaNomes = new Set((fixas || []).map((f) => norm(f.nome)));
  const { mensal, anual } = totalAssinaturas(assinaturas);
  return (
    <Card>
      <div style={{ fontSize: 12.5, color: T.ink, marginBottom: 10 }}>
        Você compromete <strong style={{ color: T.gold }}>{hidden ? "•••" : fmt(mensal)}/mês</strong>
        {" "}em assinaturas (<span className="num">{hidden ? "•••" : fmt(anual)}</span>/ano).
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {assinaturas.map((a, i) => {
          const jaFixa = fixaNomes.has(norm(a.descricao));
          return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <span style={{ flex: 1, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.conhecida ? "★ " : ""}{a.descricao || "Assinatura"}
            </span>
            <span style={{ fontSize: 10.5, color: T.muted }}>{a.frequencia}</span>
            <span className="num" style={{ color: T.ink, fontWeight: 600, minWidth: 70, textAlign: "right" }}>{hidden ? "•••" : fmt(a.valorMedio)}</span>
            {jaFixa ? (
              <span style={{ fontSize: 8.5, padding: "2px 7px", borderRadius: 100, background: `${T.green}1f`, color: T.green, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>já é fixa</span>
            ) : (
              <button onClick={() => onTabChange?.("fixas")}
                title="Cadastrar como despesa fixa"
                style={{ fontSize: 9.5, padding: "3px 9px", borderRadius: 100, background: `${T.gold}1f`, color: T.gold, border: `1px solid ${T.gold}55`, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                Virar fixa
              </button>
            )}
          </div>
          );
        })}
      </div>
    </Card>
  );
}
