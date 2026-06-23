import React from "react";
import { T } from "../../../../lib/theme.js";
import { fmt } from "../../../../lib/format.js";

export default function FinTotal({ label, valor, cor, hidden }) {
  return (
    <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 11, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 3 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 16, fontWeight: 700, color: cor }}>
        {hidden ? "•••" : fmt(valor)}
      </div>
    </div>
  );
}
