import React, { useState, useEffect } from "react";
import { Check, X, AlertCircle, Info } from "lucide-react";
import { T } from "../../lib/theme.js";
import { toast } from "../../lib/toast.js";

export default function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    return toast._subscribe((event) => {
      if (event.type === "add") {
        setToasts((curr) => [...curr, event.toast]);
        if (event.toast.duration) {
          setTimeout(() => {
            setToasts((curr) => curr.filter((t) => t.id !== event.toast.id));
          }, event.toast.duration);
        }
      } else if (event.type === "remove") {
        setToasts((curr) => curr.filter((t) => t.id !== event.id));
      } else if (event.type === "clear") {
        setToasts([]);
      }
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      zIndex: 300,
      display: "flex",
      flexDirection: "column-reverse",
      gap: 8,
      pointerEvents: "none",
      maxWidth: "calc(100vw - 40px)",
      width: 360,
    }}>
      {toasts.map((t) => <ToastItem key={t.id} t={t} />)}
    </div>
  );
}

function ToastItem({ t }) {
  const color = t.type === "success" ? T.green
              : t.type === "error" ? T.red
              : T.blue;
  const Icon = t.type === "success" ? Check
             : t.type === "error" ? AlertCircle
             : Info;

  const dismiss = () => toast.dismiss(t.id);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background: T.card,
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        padding: "12px 14px",
        pointerEvents: "auto",
        boxShadow: "0 8px 20px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        animation: "slideIn 0.2s ease",
      }}>
      <Icon size={18} style={{ color, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, color: T.ink, fontSize: 13, lineHeight: 1.4 }}>
        {t.msg}
        {t.action && (
          <button
            onClick={() => { t.action.onClick(); dismiss(); }}
            style={{
              display: "block",
              marginTop: 6,
              background: "transparent",
              color,
              border: "none",
              padding: 0,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}>
            {t.action.label}
          </button>
        )}
      </div>
      <button onClick={dismiss}
              style={{ background: "transparent", border: "none", color: T.muted, padding: 2, cursor: "pointer", flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}
