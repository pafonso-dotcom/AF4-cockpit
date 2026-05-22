import React from "react";
import { T } from "../../lib/theme.js";

export default function ColorPicker({ value, onChange }) {
  const cores = [T.gold, T.goldHi, T.green, T.red, T.blue, "#9a8fb3", "#d49b8d", "#a3c9a8", "#b39a8f", "#7ea580"];
  return (
    <div className="flex gap-2 flex-wrap">
      {cores.map(c => (
        <button key={c} onClick={() => onChange(c)}
          style={{
            width: 32, height: 32, background: c,
            border: value === c ? `2px solid ${T.ink}` : `1px solid ${T.border}`,
            cursor: "pointer", padding: 0,
          }} />
      ))}
    </div>
  );
}
