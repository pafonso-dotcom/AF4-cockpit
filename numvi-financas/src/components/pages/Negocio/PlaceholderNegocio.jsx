import React from "react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";

/**
 * Esqueleto inicial das páginas do módulo Negócio.
 * Cada sub-aba importa e configura este componente com:
 *  - eyebrow, titulo, sub do PageHeader
 *  - lista do que vai ser implementado em PRs seguintes
 *
 * Substitua o conteúdo conforme cada feature é entregue.
 */
export default function PlaceholderNegocio({ eyebrow, titulo, sub, roadmap = [] }) {
  return (
    <div className="fade-up py-8 px-6">
      <PageHeader eyebrow={eyebrow} title={titulo} sub={sub} />

      <div style={{
        background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
        padding: 32, textAlign: "center", marginBottom: 16,
      }}>
        <div style={{
          fontSize: 11, letterSpacing: ".25em", textTransform: "uppercase",
          color: T.gold, fontWeight: 600, marginBottom: 8,
        }}>
          Em construção
        </div>
        <div style={{ color: T.muted, fontSize: 13, lineHeight: 1.55, maxWidth: 540, margin: "0 auto" }}>
          A estrutura desta área já está pronta. Os dados são persistidos junto com o
          resto do app. As funcionalidades abaixo serão entregues em PRs separados.
        </div>
      </div>

      {roadmap.length > 0 && (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 20 }}>
          <div className="label-eyebrow" style={{ marginBottom: 12 }}>Próximos passos</div>
          <ul style={{ display: "grid", gap: 10, paddingLeft: 0, listStyle: "none" }}>
            {roadmap.map((item, i) => (
              <li key={i} style={{
                display: "flex", gap: 10, fontSize: 13, color: T.ink, lineHeight: 1.5,
                paddingBottom: 10, borderBottom: i < roadmap.length - 1 ? `1px dashed ${T.border}` : "none",
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: `${T.gold}22`, color: T.gold,
                  display: "grid", placeItems: "center", flexShrink: 0,
                  fontSize: 11, fontWeight: 700,
                }}>
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
