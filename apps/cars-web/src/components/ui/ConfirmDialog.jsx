import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertCircle } from "lucide-react";
import { T } from "../../lib/theme.js";
import { confirm } from "../../lib/confirm.js";

export default function ConfirmDialog() {
  const [state, setState] = useState(null);

  useEffect(() => {
    return confirm._subscribe((opts) => setState(opts));
  }, []);

  if (!state) return null;

  const close = (result) => {
    state.resolve(result);
    setState(null);
  };

  const content = (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1100,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        animation: "fadeIn 0.15s ease",
      }}>
      <div style={{
        background: T.card, border: `1px solid ${T.borderHi}`,
        maxWidth: 440, width: "100%", padding: 28,
      }}>
        <div className="flex items-start gap-3 mb-4">
          {state.danger && (
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: `${T.red}22`, color: T.red,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <AlertCircle size={20} />
            </div>
          )}
          <div className="flex-1">
            <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, letterSpacing: "-0.01em", lineHeight: 1.2 }}>
              {state.title}
            </h3>
            {state.body && (
              <p style={{ color: T.muted, fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
                {state.body}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={() => close(false)}
                  style={{
                    background: "transparent", color: T.muted,
                    border: `1px solid ${T.border}`, padding: "10px 18px",
                    fontFamily: T.sans, fontSize: 12, letterSpacing: "0.1em",
                    textTransform: "uppercase", fontWeight: 500, cursor: "pointer",
                  }}>
            {state.cancelLabel}
          </button>
          <button onClick={() => close(true)} autoFocus
                  style={{
                    background: state.danger ? T.red : T.gold,
                    color: state.danger ? "#fff" : T.bg,
                    border: "none", padding: "10px 18px",
                    fontFamily: T.sans, fontSize: 12, letterSpacing: "0.1em",
                    textTransform: "uppercase", fontWeight: 600, cursor: "pointer",
                  }}>
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
