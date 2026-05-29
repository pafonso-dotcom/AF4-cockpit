import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { T } from "../../../lib/theme.js";
import ResumoExecutivo from "./ResumoExecutivo.jsx";
import CardsGrid from "./CardsGrid.jsx";
import PagarReceber from "./PagarReceber.jsx";
import AnualView from "./AnualView.jsx";
import ParcelasView from "./ParcelasView.jsx";
import AtencaoView from "./AtencaoView.jsx";
import ReservaEmergenciaView from "./ReservaEmergenciaView.jsx";

/**
 * Hub de Planejamento de Finanças.
 * - Compacto: 5 KPIs no topo + grid 2x2 + card destacado (Despesas) full-width
 * - Expandido: ao clicar num card, troca o hub pela view completa daquela área
 */
export default function Planejamento(props) {
  const { hidden } = props;
  const [cardAberto, setCardAberto] = useState(null);

  // "despesas" e "recebiveis" agora abrem a MESMA tela unificada (toggle A Pagar/Receber).
  const views = {
    despesas: PagarReceber,
    anual: AnualView,
    recebiveis: PagarReceber,
    parcelas: ParcelasView,
    atencao: AtencaoView,
    reserva: ReservaEmergenciaView,
  };

  if (cardAberto && views[cardAberto]) {
    const View = views[cardAberto];
    return (
      <div className="fade-up py-8 px-6">
        <button
          onClick={() => setCardAberto(null)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", marginBottom: 16,
            background: T.card, border: `1px solid ${T.border}`,
            borderRadius: 7, fontSize: 11, fontWeight: 600,
            color: T.muted, cursor: "pointer",
            letterSpacing: ".05em", textTransform: "uppercase",
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}
        >
          <ArrowLeft size={14} /> Voltar ao Planejamento
        </button>
        <View {...props} onAbrirCard={setCardAberto}
              ladoInicial={cardAberto === "recebiveis" ? "receber" : "pagar"} />
      </div>
    );
  }

  return (
    <div className="fade-up py-8 px-6">
      <div style={{ marginBottom: 22 }}>
        <div style={{
          fontSize: 10, letterSpacing: ".2em", color: T.faint,
          textTransform: "uppercase", fontWeight: 600,
        }}>
          Finanças · Planejamento
        </div>
        <h1 style={{
          fontFamily: T.serif, fontSize: 34, fontWeight: 300,
          letterSpacing: "-.02em", marginTop: 6,
        }}>
          Centro de <em style={{ color: T.gold, fontStyle: "italic" }}>controle.</em>
        </h1>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
          Toque em um card para ver os detalhes completos.
        </p>
      </div>

      <ResumoExecutivo {...props} />
      <CardsGrid {...props} onAbrir={setCardAberto} />
    </div>
  );
}
