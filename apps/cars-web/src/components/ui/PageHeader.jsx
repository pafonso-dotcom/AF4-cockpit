import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Cabeçalho padrão das páginas — versão compacta.
 *
 * Antes: title 28-42px, sub 14px, margin-bottom 14px.
 * Agora: title 20-28px, sub 12px, margin-bottom 10px.
 * Ganho de ~30-40px verticais por página, sem mudar a personalidade
 * editorial (mantém serif + eyebrow + sub).
 */
export default function PageHeader({ eyebrow, title, sub, action }) {
  return (
    <div className="page-header flex flex-col md:flex-row md:items-end md:justify-between gap-3"
         style={{ borderBottom: `1px solid ${T.border}` }}>
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div className="label-eyebrow page-header-eyebrow">{eyebrow}</div>
        )}
        <h2 className="page-header-title"
            style={{ fontFamily: T.serif, color: T.ink, lineHeight: 1.05, letterSpacing: "-0.015em", margin: 0 }}>
          {title}
        </h2>
        {sub && (
          <div className="page-header-sub italic" style={{ color: T.muted }}>
            {sub}
          </div>
        )}
      </div>
      {action && <div className="page-header-action">{action}</div>}
      <style>{`
        .page-header {
          margin-bottom: 10px;
          padding-bottom: 8px;
        }
        .page-header-eyebrow {
          font-size: 9px;
          letter-spacing: .2em;
          margin-bottom: 4px;
        }
        .page-header-title {
          font-size: clamp(20px, 3.4vw, 28px);
          font-weight: 500;
        }
        .page-header-sub {
          font-size: 12px;
          margin-top: 3px;
          line-height: 1.4;
        }
        @media (max-width: 768px) {
          .page-header {
            margin-bottom: 8px;
            padding-bottom: 6px;
            gap: 6px !important;
          }
          .page-header-title {
            font-size: 18px;
            line-height: 1.15;
          }
          .page-header-sub {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
