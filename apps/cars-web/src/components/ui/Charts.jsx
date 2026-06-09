import React from "react";
import { T } from "../../lib/theme.js";

/* ============================================================
   CHARTS · componentes de gráfico reutilizáveis (SVG inline)
   Usados pelas páginas de Relatórios dos 3 módulos.
   ============================================================ */

/**
 * BarChart vertical · ideal para evolução temporal.
 * Props: data = [{label, value}, ...], color (opcional, default T.gold)
 */
export function BarChart({ data, color, height = 160, formatValue }) {
  const cor = color || T.gold;
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const fmt = formatValue || ((v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height, marginBottom: 8 }}>
      {data.map((d, i) => {
        const h = Math.max((Math.abs(d.value) / max) * 100, 3);
        return (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
            <div style={{
              width: "100%",
              background: `linear-gradient(180deg, ${cor}, ${cor}66)`,
              borderRadius: "4px 4px 0 0",
              minHeight: 4,
              height: `${h}%`,
              transition: "all .2s",
            }} title={`${d.label}: ${fmt(d.value)}`} />
            <div style={{ fontSize: 9, color: T.muted, fontVariantNumeric: "tabular-nums" }}>
              {fmt(d.value)}
            </div>
            <div style={{ fontSize: 9.5, color: T.faint }}>{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * BarChart com 2 séries (ex: Receitas vs Despesas).
 * data = [{label, value1, value2}, ...]
 */
export function BarChartDouble({ data, colors, height = 160, labels, formatValue }) {
  const c1 = colors?.[0] || T.gold;
  const c2 = colors?.[1] || T.red;
  const lbl = labels || ["A", "B"];
  const max = Math.max(...data.flatMap(d => [Math.abs(d.value1), Math.abs(d.value2)]), 1);
  const fmt = formatValue || ((v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0));

  return (
    <>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height, marginBottom: 8 }}>
        {data.map((d, i) => {
          const h1 = Math.max((Math.abs(d.value1) / max) * 100, 3);
          const h2 = Math.max((Math.abs(d.value2) / max) * 100, 3);
          return (
            <div key={i} style={{ flex: 1, display: "flex", gap: 2, alignItems: "flex-end", height: "100%" }}>
              <div style={{
                flex: 1,
                background: `linear-gradient(180deg, ${c1}, ${c1}66)`,
                borderRadius: "4px 4px 0 0",
                height: `${h1}%`, minHeight: 3,
              }} title={`${d.label} ${lbl[0]}: ${fmt(d.value1)}`} />
              <div style={{
                flex: 1,
                background: `linear-gradient(180deg, ${c2}, ${c2}66)`,
                borderRadius: "4px 4px 0 0",
                height: `${h2}%`, minHeight: 3,
              }} title={`${d.label} ${lbl[1]}: ${fmt(d.value2)}`} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: T.faint, marginBottom: 8 }}>
        {data.map((d, i) => <span key={i} style={{ flex: 1, textAlign: "center" }}>{d.label}</span>)}
      </div>
      <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: T.muted }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: c1, borderRadius: 3 }} />{lbl[0]}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 10, height: 10, background: c2, borderRadius: 3 }} />{lbl[1]}</span>
      </div>
    </>
  );
}

/**
 * Lista de barras horizontais · ideal para top categorias / ranking.
 * data = [{label, value, color?}, ...]
 */
export function HorizontalBarList({ data, formatValue }) {
  const max = Math.max(...data.map(d => Math.abs(d.value)), 1);
  const fmt = formatValue || ((v) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {data.map((d, i) => {
        const pct = (Math.abs(d.value) / max) * 100;
        return (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px", gap: 10, alignItems: "center", fontSize: 11.5 }}>
            <div style={{ color: T.ink }}>{d.label}</div>
            <div style={{ height: 8, background: T.bgSoft, borderRadius: 100, overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                background: d.color || T.gold,
                borderRadius: 100,
                transition: "width .3s",
              }} />
            </div>
            <div style={{ textAlign: "right", color: T.muted, fontVariantNumeric: "tabular-nums" }}>{d.valorLabel != null ? d.valorLabel : fmt(d.value)}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Card-wrapper de relatório.
 */
export function ReportCard({ title, children, footer }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: 18,
      boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)",
    }}>
      <h4 style={{
        fontSize: 11,
        letterSpacing: ".2em",
        textTransform: "uppercase",
        fontWeight: 500,
        marginBottom: 14,
        color: T.ink,
      }}>{title}</h4>
      {children}
      {footer && (
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 10 }}>{footer}</div>
      )}
    </div>
  );
}

export function ReportGrid({ children }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
      gap: 16,
      marginTop: 18,
    }}>
      {children}
    </div>
  );
}
