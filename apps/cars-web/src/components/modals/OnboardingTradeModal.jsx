import React from "react";
import { Check, Shield, Sparkles, AlertTriangle } from "lucide-react";
import { T } from "../../lib/theme.js";
import Modal from "../ui/Modal.jsx";

export default function OnboardingTradeModal({ onClose }) {
  return (
    <Modal title="AF4 Trade · Apoio à decisão" onClose={onClose}>
      <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, marginBottom: 16 }}>
        Esta ferramenta organiza indicadores técnicos (RSI, MACD, volume, tendência) e
        gera explicações via IA pra te ajudar a analisar oportunidades em cripto.
        <strong style={{ color: T.red }}> Não é recomendação de investimento.</strong>
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 18 }}>
        <Item icon={<Sparkles size={16} color={T.gold} />} text="Dados públicos da Binance (com até 1min de atraso)" />
        <Item icon={<AlertTriangle size={16} color={T.gold} />} text="IA pode errar — sempre confirme antes de operar" />
        <Item icon={<Shield size={16} color={T.gold} />} text="Você é responsável pelas suas decisões de trade" />
        <Item icon={<Check size={16} color={T.gold} />} text="Comece com valores baixos enquanto entende como a ferramenta se comporta" />
      </div>

      <div style={{
        padding: 12, fontSize: 11.5, color: T.muted,
        background: `${T.gold}11`, border: `1px solid ${T.gold}55`,
        borderRadius: 11, lineHeight: 1.5,
      }}>
        🪙 Watchlist padrão tem 15 criptos (BTC, ETH, SOL, etc.). Você pode adicionar/remover em
        <strong style={{ color: T.gold }}> AF4 Trade → Watchlist</strong>.
      </div>

      <div className="flex gap-3 justify-end mt-5">
        <button onClick={onClose}
          style={{
            background: T.gold, color: T.bg, border: "none",
            padding: "10px 18px", borderRadius: 12, fontSize: 12,
            letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          <Check size={14} /> Entendi e quero continuar
        </button>
      </div>
    </Modal>
  );
}

function Item({ icon, text }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{icon}</div>
      <div style={{ fontSize: 12.5, color: T.ink, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}
