import React from "react";
import { T } from "../../lib/theme.js";

export default function Stat({ label, value, cor, grande }) {
  return (
    <div className="flex justify-between items-baseline">
      <div className="label-eyebrow">{label}</div>
      <div className="num" style={{ color: cor || T.ink, fontSize: grande ? 22 : 16, fontFamily: grande ? T.serif : T.mono }}>
        {value}
      </div>
    </div>
  );
}
