import React from "react";
import { T } from "../../lib/theme.js";

export default function PageHeader({ eyebrow, title, sub, action }) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 pb-6"
         style={{ borderBottom: `1px solid ${T.border}` }}>
      <div>
        <div className="label-eyebrow">{eyebrow}</div>
        <h2 style={{ fontFamily: T.serif, fontSize: "clamp(36px, 6vw, 56px)", color: T.ink, marginTop: 8, lineHeight: 1, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
        {sub && <div style={{ color: T.muted, fontSize: 17, marginTop: 8 }} className="italic">{sub}</div>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
