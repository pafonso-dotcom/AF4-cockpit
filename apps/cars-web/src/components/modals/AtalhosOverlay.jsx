import React, { useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import { T } from "../../lib/theme.js";

const ATALHOS = [
  { tecla: "N",   desc: "Nova Transação" },
  { tecla: "A",   desc: "Novo Aporte (Investimentos)" },
  { tecla: "?",   desc: "Mostrar esta lista" },
  { tecla: "Esc", desc: "Fechar modais" },
];

export default function AtalhosOverlay({ onClose }) {
  useEffect(() => {
    const onEsc = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [onClose]);

  return (
    <div
      data-modal-open="true"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,.55)",
        display: "grid", placeItems: "center",
        padding: 12,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: 14, padding: "22px 26px",
          maxWidth: 440, width: "100%",
          border: `1px solid ${T.border}`,
          boxShadow: "0 20px 50px rgba(0,0,0,.5)",
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 16,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Keyboard size={20} color={T.gold} />
            <h3 style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>Atalhos de teclado</h3>
          </div>
          <button onClick={onClose}
            style={{
              background: "transparent", border: "none",
              cursor: "pointer", color: T.muted,
              padding: 6, borderRadius: 11,
            }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {ATALHOS.map((a, i) => (
            <div key={a.tecla} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: i < ATALHOS.length - 1 ? `1px dashed ${T.border}` : "none",
            }}>
              <span style={{ fontSize: 13, color: T.ink }}>{a.desc}</span>
              <kbd style={{
                background: T.bgSoft, padding: "4px 12px", borderRadius: 11,
                fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                color: T.gold, border: `1px solid ${T.border}`,
                minWidth: 32, textAlign: "center", display: "inline-block",
              }}>{a.tecla}</kbd>
            </div>
          ))}
        </div>

        <div style={{
          fontSize: 11, color: T.muted, marginTop: 16,
          fontStyle: "italic", lineHeight: 1.5,
        }}>
          Atalhos desabilitados em campos de texto. <kbd style={{ background: T.bgSoft, padding: "1px 6px", borderRadius: 3, fontFamily: "monospace", fontSize: 10 }}>?</kbd> funciona sempre.
        </div>
      </div>
    </div>
  );
}
