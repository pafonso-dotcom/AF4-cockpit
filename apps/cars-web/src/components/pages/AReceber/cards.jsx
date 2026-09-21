// Cards pequenos da tela A Receber & Dívidas (movidos de AReceberEDividas.jsx
// na fatia de 2026-09-21 — código idêntico, só mudou de arquivo).
import React from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";

export function VisaoCard({ label, valor, sub, cor, small }) {
  return (
    <div style={{
      padding: "9px 11px", background: T.card,
      border: `1px solid ${T.border}`, borderRadius: 12,
      borderLeft: `3px solid ${cor || T.border}`,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase",
        color: T.muted, marginBottom: 4, fontWeight: 600,
      }}>
        {label}
      </div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: small ? 13 : 15,
        color: cor || T.ink, fontWeight: 600, lineHeight: 1.1,
      }}>
        {valor == null ? "•••" : (typeof valor === "number" ? fmt(valor) : valor)}
      </div>
      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 3 }}>{sub}</div>
    </div>
  );
}

export function AlertCard({ cor, titulo, count, valor, sub, icone, actions }) {
  return (
    <div title={sub} style={{
      background: T.card,
      border: `1px solid ${cor}55`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 16,
      padding: "6px 8px",
      display: "flex", alignItems: "center", gap: 7, minWidth: 0,
    }}>
      <span style={{ fontSize: 14, flexShrink: 0 }}>{icone}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="label-eyebrow" style={{ color: cor, fontSize: 10, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{titulo}</div>
        <div className="num" style={{ fontSize: 13, fontWeight: 600, color: cor, lineHeight: 1.2, whiteSpace: "nowrap" }}>
          {count}{valor != null ? ` · ${fmt(valor)}` : ""}
        </div>
      </div>
      {actions && actions.length > 0 && (
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          {actions.map(a => (
            <button key={a.label} onClick={a.onClick} title={a.title}
              style={{
                background: `${cor}22`, color: cor,
                border: `1px solid ${cor}55`, borderRadius: 12,
                padding: "4px 6px", fontSize: 12, cursor: "pointer", lineHeight: 1,
              }}>
              {a.icon || a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
