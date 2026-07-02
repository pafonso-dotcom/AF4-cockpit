import React, { useState } from "react";
import { Info } from "lucide-react";
import { T } from "../../lib/theme.js";

/**
 * StatCard com 3 features:
 * - tooltip: explica como o número é calculado (item 16)
 * - variation: indicador MoM { pct, label, goodIfUp } (item 10)
 * - sub: subtítulo simples (compat)
 */
export default function StatCard({ label, value, accent, icon: Icon, sub, tooltip, variation, compact }) {
  const [showTip, setShowTip] = useState(false);

  const variationColor = variation
    ? variation.pct === 0 ? T.muted
      : (variation.pct > 0
        ? (variation.goodIfUp === false ? T.red : T.green)
        : (variation.goodIfUp === false ? T.green : T.red))
    : T.muted;

  return (
    <div style={{ background: T.card, padding: compact ? 12 : 20, position: "relative" }} className="card-hover">
      <div className="flex items-start justify-between" style={{ marginBottom: compact ? 6 : 12 }}>
        <div className="label-eyebrow" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: compact ? 9.5 : undefined }}>
          {label}
          {tooltip && (
            <span
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              onClick={(e) => { e.stopPropagation(); setShowTip(v => !v); }}
              style={{ display: "inline-flex", alignItems: "center", cursor: "help", color: T.muted, opacity: 0.7 }}
              aria-label="Mais informações"
            >
              <Info size={10} />
            </span>
          )}
        </div>
        {Icon && <Icon size={compact ? 12 : 14} style={{ color: accent }} />}
      </div>

      <div className="num" style={{ fontFamily: T.serif, fontSize: compact ? "clamp(15px, 2vw, 19px)" : "clamp(20px, 3vw, 28px)", color: T.ink, lineHeight: 1.1, display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <span>{value}</span>
        {variation && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 2,
            fontSize: 10, padding: "2px 6px", borderRadius: 100,
            background: `${variationColor}22`, color: variationColor,
            fontWeight: 600, fontFamily: T.sans, lineHeight: 1,
          }}>
            {variation.pct > 0 ? "↑" : variation.pct < 0 ? "↓" : "–"} {Math.abs(variation.pct).toFixed(1)}%
          </span>
        )}
      </div>

      {(sub || variation?.label) && (
        <div className="num text-xs" style={{ color: T.muted, marginTop: compact ? 4 : 8 }}>
          {variation?.label || sub}
        </div>
      )}

      {tooltip && showTip && (
        <div style={{
          position: "absolute", top: "100%", left: 12, right: 12, marginTop: 4,
          background: T.ink, color: T.bg, padding: "8px 11px", borderRadius: 11,
          fontSize: 11, lineHeight: 1.5, zIndex: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,.5)",
          maxWidth: 280,
        }}>
          {tooltip}
        </div>
      )}
    </div>
  );
}
