import React from "react";
import { createPortal } from "react-dom";
import { FileText } from "lucide-react";
import { fmt } from "../../../../lib/format.js";
import { toPDF } from "../../../../lib/exportRelatorio.js";

// Documento imprimível do financeiro (resumo + série mensal + extrato).
// Portal direto no body pra que o toPDF (print-only-this) isole só este card.
export default function FinanceiroDocModal({ financeiro, periodoLabel, onClose }) {
  const empresa = (() => {
    try { return localStorage.getItem("af4:empresa-nome") || "Âncora"; }
    catch { return "Âncora"; }
  })();
  const tipoLabel = (t) => ({
    "venda-servico": "Receita · venda", "fatura-recorrente": "Receita · fatura",
    "pago-instalador": "Repasse colaborador", "custo-servico": "Custo/prestador",
    "ajuste-entrada": "Entrada manual", "ajuste-saida": "Saída manual",
  }[t] || t);
  const emissao = new Date().toLocaleDateString("pt-BR");

  const content = (
    <div className="modal-overlay-bg" onClick={onClose}
         style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.6)",
                  display: "grid", placeItems: "center", padding: 20, overflowY: "auto" }}>
      <div onClick={e => e.stopPropagation()}
           style={{ width: "min(680px, 100%)", maxHeight: "92vh", overflowY: "auto", background: "#fff", borderRadius: 16 }}>
        <div id="financeiro-doc-print" style={{ padding: 28, color: "#111", background: "#fff", fontFamily: "Georgia, serif" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: 12, marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{empresa}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>Financeiro · Caixa do Negócio</div>
            </div>
            <div style={{ textAlign: "right", fontSize: 11, color: "#666" }}>
              <div>Período: {periodoLabel}</div>
              <div>Emissão: {emissao}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 24, marginBottom: 16, fontSize: 13 }}>
            <div><span style={{ color: "#666" }}>Entradas:</span> <strong style={{ color: "#137a3b" }}>{fmt(financeiro.entradas)}</strong></div>
            <div><span style={{ color: "#666" }}>Saídas:</span> <strong style={{ color: "#b42318" }}>{fmt(financeiro.saidas)}</strong></div>
            <div><span style={{ color: "#666" }}>Resultado:</span> <strong>{fmt(financeiro.resultado)}</strong></div>
            <div><span style={{ color: "#666" }}>Saldo Caixa:</span> <strong>{fmt(financeiro.saldoAtual)}</strong></div>
          </div>

          {financeiro.serie.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #ccc" }}>
                  <th style={{ textAlign: "left", padding: "5px 6px", color: "#666" }}>Mês</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666" }}>Receita</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666" }}>Despesa</th>
                  <th style={{ textAlign: "right", padding: "5px 6px", color: "#666" }}>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {financeiro.serie.map(m => (
                  <tr key={m.mes} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "5px 6px" }}>{m.label}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "#137a3b" }}>{fmt(m.receita)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", color: "#b42318" }}>{fmt(m.despesa)}</td>
                    <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: 600 }}>{fmt(m.lucro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase", color: "#888", marginBottom: 6 }}>Extrato</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #ccc" }}>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#666" }}>Data</th>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#666" }}>Tipo</th>
                <th style={{ textAlign: "left", padding: "4px 6px", color: "#666" }}>Descrição</th>
                <th style={{ textAlign: "right", padding: "4px 6px", color: "#666" }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {financeiro.movs.map((h, i) => {
                const v = Number(h.valor || 0);
                return (
                  <tr key={h.id || i} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={{ padding: "4px 6px" }}>{(h.data || "").split("-").reverse().join("/")}</td>
                    <td style={{ padding: "4px 6px" }}>{tipoLabel(h.tipo)}</td>
                    <td style={{ padding: "4px 6px" }}>{h.descricao || ""}</td>
                    <td style={{ padding: "4px 6px", textAlign: "right", color: v >= 0 ? "#137a3b" : "#b42318" }}>
                      {v >= 0 ? "+" : "−"} {fmt(Math.abs(v))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div style={{ fontSize: 11, color: "#999", textAlign: "center", borderTop: "1px solid #eee", marginTop: 12, paddingTop: 10 }}>
            {empresa} · Financeiro do Caixa do Negócio · {emissao}
          </div>
        </div>

        <div className="no-print" style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "14px 28px 22px" }}>
          <button className="btn-ghost" onClick={onClose}>Fechar</button>
          <button className="btn-gold" onClick={() => toPDF("financeiro-doc-print")}>
            <FileText size={13} className="inline mr-1" /> Imprimir / PDF
          </button>
        </div>
      </div>
    </div>
  );
  return createPortal(content, document.body);
}
