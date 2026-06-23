import React from "react";
import { Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";

// Gancho de IA (fase 2): botão presente, desativado. O ponto de integração
// fica pronto — basta trocar o handler por perguntarAoClaude(buildContext(...)).
export default function IAAnaliseCard() {
  return (
    <Card variant="soft">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Sparkles size={18} style={{ color: T.gold, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Análise com IA</div>
          <div style={{ fontSize: 11, color: T.muted }}>Resumo do mês em linguagem natural — em breve.</div>
        </div>
        <button disabled title="Em breve"
          style={{ background: T.border, color: T.muted, border: "none", borderRadius: 10,
                   padding: "6px 12px", fontSize: 11.5, fontWeight: 600, cursor: "not-allowed", opacity: 0.7 }}>
          Em breve
        </button>
      </div>
    </Card>
  );
}
