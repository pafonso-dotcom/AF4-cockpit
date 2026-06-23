import React from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { fmt, todayISO } from "../../../../lib/format.js";
import { toPDF } from "../../../../lib/exportRelatorio.js";

// Documento imprimível de fatura/recibo. Renderiza via portal direto no body
// pra que o helper toPDF (print-only-this) isole só este card na impressão.
export default function FaturaDocModal({ venda: v, cliente, servicos = [], onClose }) {
  const empresa = (() => {
    try { return localStorage.getItem("af4:empresa-nome") || "Âncora"; }
    catch { return "Âncora"; }
  })();
  const pendente = v.pago === false;
  const numero = String(v.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase();
  const refLabel = v.faturaRef
    ? (v.faturaRef.length === 4 ? `Ano ${v.faturaRef}` : `${v.faturaRef.slice(5)}/${v.faturaRef.slice(0, 4)}`)
    : (v.data ? v.data.split("-").reverse().join("/") : "—");
  const servicosVinc = v.servicosIds || (v.servicoId ? [v.servicoId] : []);
  const itens = servicosVinc.map(id => servicos.find(s => s.id === id)?.nome).filter(Boolean);
  const dataEmissao = (v.data || todayISO()).split("-").reverse().join("/");

  const content = (
    <div className="modal-overlay-bg" onClick={onClose}
         style={{
           position: "fixed", inset: 0, zIndex: 1000,
           background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center",
           padding: 20, overflowY: "auto",
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: "min(560px, 100%)", maxHeight: "92vh", overflowY: "auto",
                    background: "#fff", borderRadius: 16 }}>
        {/* Documento (isolado na impressão) */}
        <div id="fatura-doc-print" style={{ padding: 28, color: "#111", background: "#fff", fontFamily: "Georgia, serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{empresa}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Prestação de serviços</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
                {pendente ? "Fatura" : "Recibo"}
              </div>
              <div style={{ fontSize: 11, color: "#666" }}>Nº {numero}</div>
              <div style={{ fontSize: 11, color: "#666" }}>Emissão: {dataEmissao}</div>
            </div>
          </div>

          <div style={{
            display: "inline-block", marginBottom: 16, padding: "4px 12px", borderRadius: 4,
            fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase",
            background: pendente ? "#fde2e2" : "#dcf5e3", color: pendente ? "#b42318" : "#137a3b",
            border: `1px solid ${pendente ? "#f0a9a3" : "#9ad9b3"}`,
          }}>
            {pendente ? "● Pagamento pendente" : `✓ Pago${v.pagoEm ? ` em ${v.pagoEm.split("-").reverse().join("/")}` : ""}`}
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#888", marginBottom: 4 }}>Cobrar de</div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{cliente?.nome || "Cliente não informado"}</div>
            {cliente?.doc && <div style={{ fontSize: 12, color: "#555" }}>{cliente.doc}</div>}
            {cliente?.email && <div style={{ fontSize: 12, color: "#555" }}>{cliente.email}</div>}
            {cliente?.telefone && <div style={{ fontSize: 12, color: "#555" }}>{cliente.telefone}</div>}
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 11, padding: 14, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{v.nome}</div>
            {itens.length > 0 && (
              <ul style={{ margin: "0 0 8px 18px", padding: 0, fontSize: 12.5, color: "#444" }}>
                {itens.map((nome, i) => <li key={i}>{nome}</li>)}
              </ul>
            )}
            {v.obs && <div style={{ fontSize: 11.5, color: "#777", fontStyle: "italic", marginBottom: 8 }}>{v.obs}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: "#222" }}>
              <span style={{ color: "#666" }}>Competência</span>
              <span style={{ fontWeight: 600 }}>{refLabel}</span>
            </div>
            <div style={{ borderTop: "1px solid #eee", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 700 }}>{fmt(v.valor)}</span>
            </div>
          </div>

          <div style={{ fontSize: 11, color: "#999", textAlign: "center", borderTop: "1px solid #eee", paddingTop: 10 }}>
            Documento gerado por {empresa} · {dataEmissao}
          </div>
        </div>

        {/* Ações (não imprimem) */}
        <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 28px 22px" }}>
          <button className="btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn-gold" onClick={() => toPDF("fatura-doc-print")}>
            <FileText size={13} className="inline mr-1" /> Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
