import React, { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW_ELEVATED } from "../../lib/styles.js";

/**
 * Menu de ações secundárias no cabeçalho — junta vários botões num só "⋯ Ações"
 * pra não lotar a barra. Fecha ao clicar fora / apertar Esc.
 *
 * itens: array de { label, icon?, onClick, disabled?, danger? } (falsy é ignorado,
 * então dá pra usar `cond && { ... }`).
 */
export default function ActionMenu({ itens = [], label = "Ações", minWidth = 230 }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const visiveis = (itens || []).filter(Boolean);
  if (!visiveis.length) return null;

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button onClick={() => setOpen(v => !v)} className="btn-ghost"
              title="Mais ações" aria-haspopup="menu" aria-expanded={open}
              style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
        <MoreHorizontal size={14} /> {label}
      </button>
      {open && (
        <div role="menu" style={{
          position: "absolute", top: "100%", right: 0, marginTop: 6, zIndex: 60,
          minWidth, background: T.card, border: `1px solid ${T.border}`,
          borderRadius: 12, boxShadow: CARD_SHADOW_ELEVATED, overflow: "hidden",
        }}>
          {visiveis.map((it, i) => {
            const Icon = it.icon;
            const cor = it.disabled ? T.faint : (it.danger ? T.red : T.ink);
            return (
              <button key={i} role="menuitem" disabled={it.disabled}
                onClick={() => { if (it.disabled) return; setOpen(false); it.onClick?.(); }}
                style={{
                  width: "100%", textAlign: "left", background: "transparent", border: "none",
                  borderBottom: i < visiveis.length - 1 ? `1px solid ${T.border}` : "none",
                  color: cor, padding: "10px 14px", fontSize: 12.5,
                  cursor: it.disabled ? "default" : "pointer", opacity: it.disabled ? 0.6 : 1,
                  display: "flex", alignItems: "center", gap: 8,
                }}
                onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = T.bgSoft; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                {Icon && <Icon size={13} />}{it.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
