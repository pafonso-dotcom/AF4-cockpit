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
  // Detecta automaticamente edição em qualquer input/textarea/select dentro do
  // modal. Como o botão "Salvar" chama onClose() direto (não passa por
  // safeClose), o aviso de "sair sem salvar" só dispara no X / ESC / clicar fora.
  const touchedRef = useRef(false);
  // Guarda onde o mousedown começou — pra não fechar quando o usuário seleciona
  // texto dentro do modal e solta o clique em cima do overlay (drag-select).
  const mouseDownOnOverlayRef = useRef(false);

  const precisaConfirmar = () => isDirtyRef.current || touchedRef.current;

  // Wrapper que pergunta antes de fechar se houver mudanças
  const safeClose = async () => {
    if (precisaConfirmar()) {
      const ok = await confirm({
        title: "Sair sem salvar?",
        body: "Você não salvou as alterações deste formulário. Se sair agora, as informações digitadas serão perdidas.",
        danger: true,
        confirmLabel: "Sair sem salvar",
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
      if (precisaConfirmar()) {
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
    <div onMouseDown={(e) => { mouseDownOnOverlayRef.current = e.target === ref.current; }}
         onClick={(e) => {
           // Só fecha se o clique COMEÇOU e TERMINOU no overlay (não um
           // drag-select que começou dentro do modal e soltou aqui).
           if (e.target === ref.current && mouseDownOnOverlayRef.current) safeClose();
           mouseDownOnOverlayRef.current = false;
         }}
         ref={ref}
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
      <div className="modal-content"
        onInput={() => { touchedRef.current = true; }}
        onChange={() => { touchedRef.current = true; }}
        style={{
        background: T.card,
        border: `1px solid ${T.borderHi}`,
        maxWidth: wide ? 800 : 520,
        width: "100%",
        maxHeight: "92vh",
        overflowY: "auto",
        padding: "clamp(18px, 4vw, 32px)",
        position: "relative",
        borderRadius: 18,
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
                  minWidth: 44, minHeight: 44, // área de toque iOS HIG mínima
                  display: "grid", placeItems: "center",
                  borderRadius: 14, zIndex: 2,
                }}>
          <X size={22} />
        </button>
        <h3 style={{
          fontFamily: T.serif, fontSize: "clamp(20px, 4.5vw, 28px)", color: T.ink,
          marginBottom: 20, letterSpacing: "-0.02em", paddingRight: 50,
        }}>{title}</h3>
        {children}
      </div>

      {/* Mobile: modal vira sheet fullscreen */}
      <style>{`
        @media (max-width: 640px) {
          .modal-overlay-bg {
            padding: 0 !important;
            background: ${T.bg} !important;
            align-items: stretch !important;
          }
          .modal-content {
            max-width: 100% !important;
            width: 100% !important;
            max-height: none !important;
            min-height: 100vh;
            border-radius: 0 !important;
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding-top: max(24px, env(safe-area-inset-top, 0px)) !important;
            padding-bottom: max(80px, calc(env(safe-area-inset-bottom, 0px) + 70px)) !important;
          }
        }
      `}</style>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
