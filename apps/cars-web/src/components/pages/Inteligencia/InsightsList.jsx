import React from "react";
import { ArrowRight } from "lucide-react";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { tabAlvoInsight } from "../../../lib/inteligenciaPainel.js";
import { Vazio } from "./ScoreCard.jsx";

const COR_TIPO = { alerta: "#EF4444", atencao: "#F59E0B", positivo: "#10B981" };
const ICON_TIPO = { alerta: "⚠️", atencao: "🟡", positivo: "✅" };

export default function InsightsList({ insights = [], onIr }) {
  if (!insights.length) {
    return <Card><Vazio texto="Nenhum insight no momento — tudo sob controle." /></Card>;
  }
  return (
    <Card>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {insights.map((ins, i) => {
          const cor = COR_TIPO[ins.tipo] || T.muted;
          const alvo = tabAlvoInsight(ins);
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8,
                                   borderLeft: `3px solid ${cor}`, paddingLeft: 10 }}>
              <span style={{ fontSize: 13 }}>{ICON_TIPO[ins.tipo] || "•"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{ins.titulo}</div>
                {ins.descricao && <div style={{ fontSize: 11, color: T.muted }}>{ins.descricao}</div>}
              </div>
              {alvo && onIr && (
                <button onClick={() => onIr(alvo)} title="Ir para a tela"
                  style={{ background: "transparent", border: "none", color: T.gold, cursor: "pointer",
                           display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11 }}>
                  ir <ArrowRight size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
