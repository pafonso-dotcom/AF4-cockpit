import React from "react";
import { T } from "../../lib/theme.js";

export default function PageHeader({ eyebrow, title, sub, action }) {
  return (
    <div className="page-header flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 pb-6"
         style={{ borderBottom: `1px solid ${T.border}` }}>
      <div>
        <div className="label-eyebrow">{eyebrow}</div>
        <h2 className="page-header-title" style={{ fontFamily: T.serif, color: T.ink, marginTop: 8, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
        {sub && <div className="page-header-sub italic" style={{ color: T.muted, marginTop: 8 }}>{sub}</div>}
      </div>
      {action && <div>{action}</div>}
      <style>{`
        .page-header { margin-bottom: 14px !important; padding-bottom: 10px !important; }
        .page-header-title { font-size: clamp(28px, 5vw, 42px); margin-top: 4px !important; }
        .page-header-sub { font-size: 14px; margin-top: 4px !important; }
        @media (max-width: 768px) {
          .page-header { margin-bottom: 12px !important; padding-bottom: 8px !important; gap: 8px !important; }
          .page-header-title { font-size: 22px !important; line-height: 1.1 !important; }
          .page-header-sub { font-size: 12px !important; margin-top: 3px !important; }
        }
      `}</style>
    </div>
  );
}
