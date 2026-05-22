import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ArrowUpRight, Check } from "lucide-react";
import { T, THEMES } from "../../lib/theme.js";

export default function ThemePicker({ themeId, setThemeId, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const themesArr = Object.values(THEMES);

  const content = (
    <div onClick={(e) => { if (e.target === ref.current) onClose(); }} ref={ref}
         style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1000,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: T.card, border: `1px solid ${T.borderHi}`, maxWidth: 720, width: "100%",
                    maxHeight: "90vh", overflowY: "auto", padding: 32, position: "relative" }}>
        <button onClick={onClose}
                style={{ position: "absolute", top: 16, right: 16, color: T.muted,
                         background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>

        <div className="label-eyebrow">Aparência</div>
        <h3 style={{ fontFamily: T.serif, fontSize: 32, color: T.ink, marginTop: 6, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Escolha sua paleta
        </h3>
        <div style={{ color: T.muted, fontSize: 15, fontStyle: "italic", marginBottom: 24 }}>
          Seis interpretações editoriais — do dourado clássico ao pergaminho claro.
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themesArr.map(th => {
            const active = th.id === themeId;
            return (
              <button key={th.id} onClick={() => { setThemeId(th.id); onClose(); }}
                style={{
                  background: th.bg,
                  border: `1px solid ${active ? th.gold : th.border}`,
                  borderWidth: active ? 2 : 1,
                  padding: 18,
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "transform 0.2s",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>

                {/* Mini preview header */}
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: th.gold }} />

                <div className="flex items-start justify-between gap-3 mb-3 mt-1">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: T.serif, fontSize: 22, color: th.ink, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                      {th.nome}
                    </div>
                    <div style={{ color: th.muted, fontSize: 12, fontStyle: "italic", marginTop: 4 }}>
                      {th.subtitulo}
                    </div>
                  </div>
                  {active && (
                    <div style={{ background: th.gold, color: th.bg, padding: "4px 8px", flexShrink: 0,
                                  display: "flex", alignItems: "center", gap: 4,
                                  fontFamily: T.sans, fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>
                      <Check size={10} /> Ativo
                    </div>
                  )}
                </div>

                {/* Sample editorial card */}
                <div style={{ background: th.cardHi, border: `1px solid ${th.border}`, padding: 12, marginTop: 8 }}>
                  <div style={{ fontFamily: T.sans, fontSize: 9, letterSpacing: "0.2em",
                                textTransform: "uppercase", color: th.muted, marginBottom: 4 }}>
                    Patrimônio
                  </div>
                  <div style={{ fontFamily: T.serif, fontSize: 22, color: th.ink, fontVariantNumeric: "tabular-nums" }}>
                    R$ 124.928
                  </div>
                  <div className="flex items-center gap-1 mt-1" style={{ color: th.green, fontFamily: T.mono, fontSize: 11 }}>
                    <ArrowUpRight size={12} /> +4.82%
                  </div>
                </div>

                {/* Color swatches */}
                <div className="flex gap-1.5 mt-3">
                  {[th.gold, th.green, th.red, th.blue, th.muted, th.border].map((c, i) => (
                    <div key={i} style={{ width: 18, height: 18, background: c, border: `1px solid ${th.border}` }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ color: T.faint, fontSize: 12, fontStyle: "italic", marginTop: 24, textAlign: "center" }}>
          Sua escolha é salva automaticamente entre sessões.
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

