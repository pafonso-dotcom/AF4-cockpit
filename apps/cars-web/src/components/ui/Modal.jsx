import React, { useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { T } from "../../lib/theme.js";
import { confirm } from "../../lib/confirm.js";

/**
 * Modal genérico. Renderizado via Portal direto no <body>.
 *
 * Props:
 * - title, children, onClose, wide
 * - isDirty (opcional): se true, pede confirmação antes de fechar
 */
export default function Modal({ title, children, onClose, wide, isDirty = false }) {
  const ref = useRef();
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Wrapper que pergunta antes de fechar se houver mudanças
  const safeClose = async () => {
    if (isDirtyRef.current) {
      const ok = await confirm({
        title: "Descartar mudanças?",
        body: "Você tem dados não salvos neste formulário. Se sair agora, eles serão perdidos.",
        danger: true,
        confirmLabel: "Sim, descartar",
        cancelLabel: "Continuar editando",
      });
      if (!ok) return;
    }
    onClose();
  };

  useEffect(() => {
    const k = (e) => { if (e.key === "Escape") safeClose(); };
    window.addEventListener("keydown", k);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Avisa antes de fechar a aba/recarregar
    const beforeUnload = (e) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
        return "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      window.removeEventListener("keydown", k);
      window.removeEventListener("beforeunload", beforeUnload);
      document.body.style.overflow = prevOverflow;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const content = (
    <div onClick={(e) => { if (e.target === ref.current) safeClose(); }} ref={ref}
         className="modal-overlay-bg"
         style={{
           position: "fixed", inset: 0,
           background: "rgba(0,0,0,0.85)",
           zIndex: 1000,
           display: "flex", alignItems: "flex-start", justifyContent: "center",
           padding: "max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom))",
           overflowY: "auto",
           WebkitOverflowScrolling: "touch",
         }}>
      <div className="modal-content" style={{
        background: T.card,
        border: `1px solid ${T.borderHi}`,
        maxWidth: wide ? 800 : 520,
        width: "100%",
        maxHeight: "92vh",
        overflowY: "auto",
        padding: "clamp(18px, 4vw, 32px)",
        position: "relative",
        borderRadius: 12,
        boxShadow: "0 24px 60px rgba(0,0,0,.6)",
        margin: "auto",
        WebkitOverflowScrolling: "touch",
      }}>
        <button onClick={safeClose}
                aria-label="Fechar"
                className="no-print"
                style={{
                  position: "absolute", top: 12, right: 12,
                  color: T.muted, background: "transparent",
                  border: "none", cursor: "pointer", padding: 6,
                  minWidth: 40, minHeight: 40, // área de toque maior no mobile
                  display: "grid", placeItems: "center",
                  borderRadius: 8,
                }}>
          <X size={20} />
        </button>
        <h3 style={{
          fontFamily: T.serif, fontSize: "clamp(20px, 4.5vw, 28px)", color: T.ink,
          marginBottom: 20, letterSpacing: "-0.02em", paddingRight: 44,
        }}>{title}</h3>
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
