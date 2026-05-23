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
        .page-header-title { font-size: clamp(36px, 6vw, 56px); }
        .page-header-sub { font-size: 17px; }
        @media (max-width: 640px) {
          .page-header { margin-bottom: 18px; padding-bottom: 14px; gap: 10px; }
          .page-header-title { font-size: 26px !important; line-height: 1.1 !important; }
          .page-header-sub { font-size: 13px !important; margin-top: 4px !important; }
        }
      `}</style>
    </div>
  );
}
