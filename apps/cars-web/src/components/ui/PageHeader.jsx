import React from "react";
import { T } from "../../lib/theme.js";

/**
 * Cabeçalho padrão das páginas — versão INLINE (Opção B).
 *
 * Antes: eyebrow + h1 grande (28-42px) + sub em linhas separadas,
 *        ocupando ~110px de altura.
 * Agora: eyebrow chip + título inline + sub bem pequeno embaixo
 *        (escondido em mobile), ocupando ~40-50px.
 *
 * Ganho de ~60-70px verticais por página — toda a hierarquia fica
 * numa linha só, deixando muito mais espaço pra conteúdo.
 */
export default function PageHeader({ eyebrow, title, sub, action }) {
  return (
    <div className="page-header"
         style={{ borderBottom: `1px solid ${T.border}` }}>
      <div className="page-header-row">
        <div className="page-header-main">
          {eyebrow && (
            <span className="page-header-eyebrow">{eyebrow}</span>
          )}
          <h2 className="page-header-title"
              style={{ fontFamily: T.serif, color: T.ink, letterSpacing: "-0.01em", margin: 0 }}>
            {title}
          </h2>
        </div>
        {action && <div className="page-header-action">{action}</div>}
      </div>
      {sub && (
        <div className="page-header-sub italic" style={{ color: T.muted }}>
          {sub}
        </div>
      )}
      <style>{`
        .page-header {
          margin-bottom: 10px;
          padding-bottom: 6px;
        }
        .page-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .page-header-main {
          display: inline-flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
          min-width: 0;
        }
        .page-header-eyebrow {
          font-size: 9px;
          letter-spacing: .2em;
          text-transform: uppercase;
          color: var(--td);
          font-weight: 600;
          padding: 2px 7px;
          border: 1px solid var(--bd);
          border-radius: 3px;
          flex-shrink: 0;
        }
        .page-header-title {
          font-size: 20px;
          font-weight: 500;
          line-height: 1.1;
        }
        .page-header-sub {
          font-size: 11px;
          margin-top: 3px;
          line-height: 1.4;
        }
        @media (max-width: 768px) {
          .page-header { margin-bottom: 8px; padding-bottom: 5px; }
          .page-header-main { gap: 7px; }
          .page-header-eyebrow { font-size: 8.5px; padding: 1.5px 6px; }
          .page-header-title { font-size: 17px; }
          .page-header-sub {
            display: none; /* esconde sub em mobile pra maximizar conteúdo */
          }
        }
      `}</style>
    </div>
  );
}
