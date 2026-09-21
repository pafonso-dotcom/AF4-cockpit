import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Estado vazio padronizado: ícone (emoji ou componente), frase e ação
 * opcional. Substitui os "textos secos" espalhados pelo app.
 */
export default function Vazio({ icone = "📭", texto, acaoLabel, onAcao, compacto = false }) {
  return (
    <div style={{ padding: compacto ? "18px 14px" : "30px 16px", textAlign: "center", color: T.muted }}>
      <div style={{ fontSize: compacto ? 20 : 26, marginBottom: 6 }} aria-hidden>{icone}</div>
      <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>{texto}</div>
      {acaoLabel && onAcao && (
        <button className="btn-gold" onClick={onAcao} style={{ marginTop: 12, padding: "8px 16px", fontSize: 11.5 }}>
          {acaoLabel}
        </button>
      )}
    </div>
  );
}
