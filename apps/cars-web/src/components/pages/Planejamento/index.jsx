import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { T } from "../../../lib/theme.js";
import ResumoExecutivo from "./ResumoExecutivo.jsx";
import CardsGrid from "./CardsGrid.jsx";
import PagarReceber from "./PagarReceber.jsx";
import AnualView from "./AnualView.jsx";
import ParcelasView from "./ParcelasView.jsx";
import AtencaoView from "./AtencaoView.jsx";
import ReservaEmergenciaView from "./ReservaEmergenciaView.jsx";
import DespesasFixas from "../DespesasFixas.jsx";

/**
 * Hub de Planejamento de Finanças.
 * - Compacto: 5 KPIs no topo + grid 2x2 + card destacado (Despesas) full-width
 * - Expandido: ao clicar num card, troca o hub pela view completa daquela área
 */
export default function Planejamento(props) {
  const { hidden, tab } = props;
  const [cardAberto, setCardAberto] = useState(null);
  const [voltouAoHub, setVoltouAoHub] = useState(false);
  const [atalhosAbertos, setAtalhosAbertos] = useState(false); // atalhos ocultos (pai → filhos)
  // Ao trocar de aba no menu, reseta a navegação interna do Planejamento.
  useEffect(() => { setCardAberto(null); setVoltouAoHub(false); }, [tab]);

  // "despesas" e "recebiveis" agora abrem a MESMA tela unificada (toggle A Pagar/Receber).
  const views = {
    despesas: PagarReceber,
    anual: AnualView,
    recebiveis: PagarReceber,
    parcelas: ParcelasView,
    atencao: AtencaoView,
    reserva: ReservaEmergenciaView,
    fixas: DespesasFixas,
  };

  // Tab do menu pode abrir uma view direto (ex.: "fixas" → Despesas Fixas;
  // "areceber" → A Pagar & Receber; "relatorios-anual" → Anual).
  const tabToCard = { fixas: "fixas", areceber: "recebiveis", "relatorios-anual": "anual" };
  const cardInicial = voltouAoHub ? null : (tabToCard[tab] || null);
  const aberto = cardAberto || cardInicial;

  // cardAberto pode trazer um parâmetro após ":" (ex.: "recebiveis:pagar")
  const [cardId, cardParam] = (aberto || "").split(":");
  if (cardId && views[cardId]) {
    const View = views[cardId];
    return (
      <div className="fade-up py-8 px-6">
        <button
          onClick={() => { setCardAberto(null); setVoltouAoHub(true); }}
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
        <View {...props} onAbrirCard={setCardAberto} vistaInicial={cardParam || "receber"} />
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

      {/* Atalhos ocultos (pai → filhos) — vão direto pra cada tela individual */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setAtalhosAbertos(v => !v)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "transparent", border: "none", cursor: "pointer",
            color: T.muted, fontSize: 11, fontWeight: 700, letterSpacing: ".1em",
            textTransform: "uppercase", padding: "4px 0",
          }}>
          <span style={{ display: "inline-block", transform: atalhosAbertos ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▸</span>
          Atalhos rápidos
        </button>
        {atalhosAbertos && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8, paddingLeft: 14 }}>
            {[
              { l: "💰 A Receber",     id: "recebiveis:receber" },
              { l: "⚠️ A Pagar",       id: "recebiveis:pagar" },
              { l: "🔁 Despesa Fixa",  id: "fixas" },
              { l: "💳 Parcelas",      id: "parcelas" },
            ].map(a => (
              <button key={a.id} onClick={() => setCardAberto(a.id)}
                style={{
                  padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                  background: `${T.gold}14`, color: T.ink,
                  border: `1px solid ${T.gold}55`, fontSize: 12.5, fontWeight: 600,
                  whiteSpace: "nowrap",
                }}>
                {a.l}
              </button>
            ))}
          </div>
        )}
      </div>

      <ResumoExecutivo {...props} onAbrir={setCardAberto} />
      <CardsGrid {...props} onAbrir={setCardAberto} />
    </div>
  );
}
