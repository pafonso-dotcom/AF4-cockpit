import React, { useState, useMemo } from "react";
import { Download, Printer, FileSpreadsheet, Table } from "lucide-react";
import { T } from "../../lib/theme.js";
import { exportCSV, exportXLSX, printHTML, buildPDFReport } from "../../lib/importExport.js";
import { toast } from "../../lib/toast.js";
import Field from "../ui/Field.jsx";

export default function ExportPanel({ transacoes, contas, ativos, totais, parcelamentos = [], cartoes = [], onDone }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [escopo, setEscopo] = useState({ contas: true, ativos: true, transacoes: true });
  const [format, setFormat] = useState("pdf"); // pdf | csv | xlsx

  const filtered = useMemo(() => {
    return transacoes.filter(t => {
      if (from && (t.data || "") < from) return false;
      if (to && (t.data || "") > to) return false;
      return true;
    });
  }, [transacoes, from, to]);

  const handleExport = async () => {
    try {
      if (format === "csv") {
        exportCSV(filtered);
      } else if (format === "xlsx") {
        await exportXLSX({
          transacoes: escopo.transacoes ? filtered : [],
          contas: escopo.contas ? contas : [],
          ativos: escopo.ativos ? ativos : [],
          parcelamentos,
          cartoes,
        });
        toast.success("Excel gerado e baixado.");
      } else {
        const html = buildPDFReport({
          transacoes: escopo.transacoes ? filtered : [],
          contas: escopo.contas ? contas : [],
          ativos: escopo.ativos ? ativos : [],
          totais,
          escopo,
        });
        printHTML(html);
      }
      setTimeout(onDone, 300);
    } catch (e) {
      toast.error("Falha ao exportar: " + (e?.message || "erro"));
    }
  };

  return (
    <div>
      {/* Format selector */}
      <div className="label-eyebrow mb-3">Formato</div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { id: "pdf",  l: "PDF",   icon: Printer,         desc: "Relatório editorial · impressão" },
          { id: "csv",  l: "CSV",   icon: FileSpreadsheet, desc: "Texto simples · contadores" },
          { id: "xlsx", l: "Excel", icon: Table,           desc: "Várias abas · cores e larguras" },
        ].map(f => {
          const Icon = f.icon;
          const active = format === f.id;
          return (
            <button key={f.id} onClick={() => setFormat(f.id)}
              style={{
                background: active ? T.cardHi : T.bgSoft,
                border: `1px solid ${active ? T.gold : T.border}`,
                borderWidth: active ? 2 : 1, padding: 16, textAlign: "left", cursor: "pointer",
              }}>
              <Icon size={20} style={{ color: active ? T.gold : T.muted, marginBottom: 8 }} />
              <div style={{ fontFamily: T.serif, fontSize: 18, color: T.ink }}>{f.l}</div>
              <div style={{ color: T.muted, fontSize: 12, fontStyle: "italic", marginTop: 2 }}>{f.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Date range */}
      <div className="label-eyebrow mb-3">Período · transações</div>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Field label="De"><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="Até"><input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
      </div>

      {/* Scope (PDF only) */}
      {format === "pdf" && (
        <>
          <div className="label-eyebrow mb-3">Seções a incluir</div>
          <div className="space-y-2 mb-6">
            {[
              { k: "contas", l: "Contas e saldos" },
              { k: "ativos", l: "Investimentos" },
              { k: "transacoes", l: "Transações detalhadas (agrupadas por mês)" },
            ].map(o => (
              <label key={o.k} className="flex items-center gap-3 cursor-pointer p-2"
                     style={{ background: T.bgSoft, border: `1px solid ${T.border}` }}>
                <input type="checkbox" checked={!!escopo[o.k]}
                       onChange={e => setEscopo({ ...escopo, [o.k]: e.target.checked })}
                       style={{ width: 16, height: 16, accentColor: T.gold }} />
                <span style={{ color: T.ink }}>{o.l}</span>
              </label>
            ))}
          </div>
        </>
      )}

      {/* Summary */}
      <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 14, marginBottom: 16 }}>
        <div style={{ color: T.muted, fontSize: 13, fontStyle: "italic" }}>
          {format === "pdf"
            ? <>Será gerado um relatório com {filtered.length} transações no período selecionado.
                {" "}A janela de impressão do navegador irá abrir — escolha
                <strong style={{ color: T.gold }}> "Salvar como PDF"</strong> no destino para baixar.</>
            : <>Será exportado um arquivo CSV com {filtered.length} transações.
                {" "}Compatível com Excel, Numbers e Google Sheets.</>}
        </div>
      </div>

      <div className="flex gap-3">
        <button className="btn-gold" onClick={handleExport}>
          {format === "pdf" ? <Printer size={14} className="inline mr-2" /> : <Download size={14} className="inline mr-2" />}
          {format === "pdf" ? "Gerar PDF" : "Baixar CSV"}
        </button>
        <button className="btn-ghost" onClick={onDone}>Cancelar</button>
      </div>
    </div>
  );
}

