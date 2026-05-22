import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Upload, Download } from "lucide-react";
import { T } from "../../lib/theme.js";
import ImportPanel from "./ImportPanel.jsx";
import ExportPanel from "./ExportPanel.jsx";

export default function ImportExportModal({ onClose, transacoes, setTransacoes, contas, setContas, categorias, ativos, totais, parcelamentos, cartoes }) {
  const ref = useRef();
  const [mode, setMode] = useState("import"); // import | export

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

  const content = (
    <div onClick={(e) => { if (e.target === ref.current) onClose(); }} ref={ref}
         style={{
           position: "fixed", inset: 0,
           background: "rgba(0,0,0,0.85)",
           zIndex: 1000,
           display: "flex", alignItems: "center", justifyContent: "center",
           padding: 16,
         }}>
      <div style={{
        background: T.card, border: `1px solid ${T.borderHi}`,
        maxWidth: 720, width: "100%",
        maxHeight: "92vh", overflowY: "auto",
        padding: 32, position: "relative",
        borderRadius: 12,
        boxShadow: "0 24px 60px rgba(0,0,0,.6)",
      }}>
        <button onClick={onClose} aria-label="Fechar"
                style={{ position: "absolute", top: 16, right: 16, color: T.muted,
                         background: "transparent", border: "none", cursor: "pointer", padding: 4 }}>
          <X size={20} />
        </button>

        <div className="label-eyebrow">Dados</div>
        <h3 style={{ fontFamily: T.serif, fontSize: 32, color: T.ink, marginTop: 6, marginBottom: 6, letterSpacing: "-0.02em" }}>
          Importar & Exportar
        </h3>
        <div style={{ color: T.muted, fontSize: 15, fontStyle: "italic", marginBottom: 20 }}>
          Traga extratos do seu banco em CSV ou OFX. Exporte planilhas em CSV ou um relatório editorial em PDF.
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6" style={{ borderBottom: `1px solid ${T.border}` }}>
          {[{ id: "import", l: "Importar", icon: Upload }, { id: "export", l: "Exportar", icon: Download }].map(t => {
            const Icon = t.icon;
            const active = mode === t.id;
            return (
              <button key={t.id} onClick={() => setMode(t.id)}
                style={{
                  background: active ? T.cardHi : "transparent",
                  color: active ? T.gold : T.muted,
                  borderBottom: active ? `2px solid ${T.gold}` : "2px solid transparent",
                  padding: "10px 18px", display: "flex", alignItems: "center", gap: 8,
                  fontFamily: T.sans, fontSize: 11, letterSpacing: "0.15em",
                  textTransform: "uppercase", fontWeight: 500, cursor: "pointer", marginBottom: -1,
                }}>
                <Icon size={13} /> {t.l}
              </button>
            );
          })}
        </div>

        {mode === "import" ? (
          <ImportPanel
            transacoes={transacoes} setTransacoes={setTransacoes}
            contas={contas} setContas={setContas}
            categorias={categorias}
            onDone={onClose}
          />
        ) : (
          <ExportPanel transacoes={transacoes} contas={contas} ativos={ativos} totais={totais} parcelamentos={parcelamentos} cartoes={cartoes} onDone={onClose} />
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
