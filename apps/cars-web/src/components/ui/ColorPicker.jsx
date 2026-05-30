import React, { useRef } from "react";
import { Check } from "lucide-react";
import { T } from "../../lib/theme.js";

export default function ColorPicker({ value, onChange }) {
  const cores = [T.gold, T.goldHi, T.green, T.red, T.blue, "#9a8fb3", "#d49b8d", "#a3c9a8", "#b39a8f", "#7ea580"];
  const refs = useRef([]);

  // Navegação por teclado: setas movem o foco/seleção entre as cores.
  const onKey = (e, i) => {
    let next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % cores.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + cores.length) % cores.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = cores.length - 1;
    if (next === null) return;
    e.preventDefault();
    onChange(cores[next]);
    refs.current[next]?.focus();
  };

  return (
    <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="Escolher cor">
      {cores.map((c, i) => {
        const sel = value === c;
        return (
          <button key={c}
            ref={el => (refs.current[i] = el)}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={`Cor ${i + 1}${sel ? " (selecionada)" : ""}`}
            tabIndex={sel || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(c)}
            onKeyDown={e => onKey(e, i)}
            style={{
              width: 32, height: 32, background: c, borderRadius: 6,
              border: sel ? `2px solid ${T.ink}` : `1px solid ${T.border}`,
              cursor: "pointer", padding: 0,
              display: "grid", placeItems: "center",
              boxShadow: sel ? `0 0 0 2px ${T.bg}, 0 0 0 4px ${c}` : "none",
            }}>
            {sel && <Check size={14} color="#fff" strokeWidth={3} style={{ mixBlendMode: "difference" }} />}
          </button>
        );
      })}
    </div>
  );
}
