import React from "react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW } from "../../lib/styles.js";

/**
 * KpiCard padrão. Substitui implementações inline em InvestPainel,
 * Projecao, AnaliseCarteira, CarteiraSaude e Proventos.
 *
 * Variantes:
 * - "standard" (default): card com border, padding 14, valor médio
 * - "cell": versão compacta com borderLeft colorido (estilo AnaliseCarteira)
 *
 * Props:
 * - label (string): rótulo curto, uppercase
 * - value (string|number): valor principal (formatado pelo caller)
 * - sub (string, opcional): subtítulo
 * - cor (string, opcional): cor de destaque (default T.gold)
 * - icon (lucide-react component, opcional): ícone do canto direito
 * - variation (number, opcional): % de variação, mostra ↗/↘ + valor
 * - negativeGood (bool, opcional): inverte cor de variação (despesas)
 * - variant ("standard" | "cell"): default "standard"
 */
export default function KpiCard({
  label, value, sub, cor, icon: Icon, variation, negativeGood,
  variant = "standard",
}) {
  const corFinal = cor || T.gold;
  const variationNum = typeof variation === "number" ? variation : null;
  const variationStr = variationNum != null
    ? (variationNum >= 0 ? "↗ +" : "↘ ") + variationNum.toFixed(2) + "%"
    : null;
  const positive = negativeGood
    ? (variationNum != null && variationNum <= 0)
    : (variationNum != null && variationNum >= 0);

  if (variant === "cell") {
    return (
      <div style={{
        background: T.card, border: `1px solid ${T.border}`,
        borderLeft: `3px solid ${corFinal}`, borderRadius: 18, padding: 12,
        boxShadow: CARD_SHADOW,
      }}>
        <div style={{
          fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
          color: T.muted, fontWeight: 600,
        }}>{label}</div>
        <div className="num" style={{
          fontFamily: T.serif, fontSize: 22, color: corFinal,
          fontWeight: 600, marginTop: 5, lineHeight: 1.1,
        }}>{value}</div>
      </div>
    );
  }

  // standard
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 16, padding: 14, position: "relative", minHeight: 110,
      boxShadow: CARD_SHADOW,
    }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 20, fontWeight: 600,
        marginTop: 6, color: T.ink,
      }}>{value}</div>
      {variationStr && (
        <div style={{
          fontSize: 11,
          color: positive ? T.green : T.red, marginTop: 4,
        }}>{variationStr}</div>
      )}
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sub}</div>}
      {Icon && (
        <div style={{
          position: "absolute", top: 14, right: 14, width: 32, height: 32,
          borderRadius: "50%", background: `${corFinal}1f`,
          display: "grid", placeItems: "center",
        }}>
          <Icon size={16} style={{ color: corFinal }} />
        </div>
      )}
    </div>
  );
}

/**
 * KpiInline — KPI compacto, sem borda/sombra, ícone pequeno no canto.
 * Era reimplementado idêntico em Negocio/Servicos, Negocio/Veiculos e
 * Planejamento/PrevisaoView; centralizado aqui (mesmo visual).
 * Props: { label, valor, sub, cor, icon }.
 */
export function KpiInline({ label, valor, sub, cor, icon: Icon }) {
  return (
    <div style={{ background: T.card, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted }}>
          {label}
        </div>
        {Icon && <Icon size={14} style={{ color: cor || T.gold, opacity: 0.7 }} />}
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 500, color: cor || T.ink, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </div>
      {sub && <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
