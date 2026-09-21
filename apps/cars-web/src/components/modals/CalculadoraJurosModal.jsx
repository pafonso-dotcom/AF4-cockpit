import React, { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { calcularJuros } from "../../lib/juros.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

const PRAZOS = [6, 12, 24, 36, 60];

/**
 * Calculadora de juros — simples ou compostos, taxa ao mês ou ao ano,
 * com aporte mensal opcional. Calcula ao vivo enquanto digita.
 * Aberta pelo botão 🧮 no Painel de Finanças.
 */
export default function CalculadoraJurosModal({ onClose }) {
  const [principal, setPrincipal] = useState("");
  const [taxa, setTaxa] = useState("");
  const [taxaPeriodo, setTaxaPeriodo] = useState("mes");
  const [meses, setMeses] = useState("12");
  const [aporteMensal, setAporteMensal] = useState("");
  const [composto, setComposto] = useState(true);

  const r = useMemo(() => calcularJuros({
    principal: parseFloat(principal) || 0,
    taxa: parseFloat(taxa) || 0,
    taxaPeriodo,
    meses: parseInt(meses, 10) || 0,
    aporteMensal: parseFloat(aporteMensal) || 0,
    composto,
  }), [principal, taxa, taxaPeriodo, meses, aporteMensal, composto]);

  const temResultado = r.montante > 0 && (parseFloat(taxa) || 0) > 0;

  // Marcos da tabelinha: início, 1/4, 1/2, 3/4 e final do período.
  const marcos = useMemo(() => {
    const n = r.serie.length - 1;
    if (n <= 0) return [];
    const idx = [...new Set([0, Math.round(n / 4), Math.round(n / 2), Math.round((3 * n) / 4), n])];
    return idx.map(i => r.serie[i]);
  }, [r.serie]);

  const chip = (ativo) => ({
    padding: "7px 14px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontWeight: 700,
    background: ativo ? `${T.gold}22` : T.bgSoft, color: ativo ? T.gold : T.muted,
    border: `1px solid ${ativo ? T.gold : T.border}`,
  });

  return (
    <Modal title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Calculator size={20} style={{ color: T.gold }} /> Calculadora de juros</span>} onClose={onClose}>
      {/* Simples × Composto */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setComposto(true)} style={chip(composto)}>Compostos (juros sobre juros)</button>
        <button onClick={() => setComposto(false)} style={chip(!composto)}>Simples</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor inicial (R$)">
          <input type="number" step="0.01" min="0" value={principal} autoFocus
                 onChange={e => setPrincipal(e.target.value)} placeholder="10.000,00" />
        </Field>
        <Field label="Taxa de juros (%)">
          <div style={{ display: "flex", gap: 4 }}>
            <input type="number" step="0.01" min="0" value={taxa}
                   onChange={e => setTaxa(e.target.value)} placeholder="1,2" style={{ flex: 1 }} />
            <select value={taxaPeriodo} onChange={e => setTaxaPeriodo(e.target.value)} style={{ width: "auto" }}>
              <option value="mes">ao mês</option>
              <option value="ano">ao ano</option>
            </select>
          </div>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Período (meses)">
          <input type="number" min="1" max="1200" value={meses}
                 onChange={e => setMeses(e.target.value)} />
        </Field>
        <Field label="Aporte mensal (R$) — opcional">
          <input type="number" step="0.01" min="0" value={aporteMensal}
                 onChange={e => setAporteMensal(e.target.value)} placeholder="0,00" />
        </Field>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "2px 0 12px" }}>
        {PRAZOS.map(p => (
          <button key={p} onClick={() => setMeses(String(p))}
                  style={{ padding: "3px 10px", borderRadius: 100, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                           background: parseInt(meses, 10) === p ? `${T.gold}22` : "transparent",
                           color: parseInt(meses, 10) === p ? T.gold : T.muted,
                           border: `1px solid ${parseInt(meses, 10) === p ? T.gold : T.border}` }}>
            {p >= 12 ? `${p / 12} ano${p > 12 ? "s" : ""}` : `${p} meses`}
          </button>
        ))}
      </div>

      {/* Resultado */}
      {temResultado ? (
        <>
          <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, color: T.muted, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700 }}>Montante final</div>
            <div className="num" style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, color: T.gold, marginTop: 2 }}>{fmt(r.montante)}</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 6, fontSize: 11.5 }}>
              <span style={{ color: T.muted }}>Investido: <b className="num" style={{ color: T.ink }}>{fmt(r.totalInvestido)}</b></span>
              <span style={{ color: T.green }}>Juros: <b className="num">+{fmt(r.totalJuros)}</b></span>
              {taxaPeriodo === "ano" && (
                <span style={{ color: T.faint }}>equivale a {fmtN(r.taxaMensalPct, 2)}% a.m.</span>
              )}
            </div>
          </div>
          <div style={{ fontSize: 11.5 }}>
            {marcos.map((m, i) => (
              <div key={m.mes} style={{ display: "flex", justifyContent: "space-between", padding: "4px 2px", borderBottom: i < marcos.length - 1 ? `1px dashed ${T.border}` : "none" }}>
                <span style={{ color: T.muted }}>{m.mes === 0 ? "Início" : `Mês ${m.mes}`}</span>
                <span className="num" style={{ color: T.ink, fontWeight: m.mes === r.serie.length - 1 ? 700 : 500 }}>{fmt(m.saldo)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ padding: "18px 12px", textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>
          Preencha valor e taxa pra ver o resultado ao vivo.
        </div>
      )}

      <div className="flex gap-3 justify-end mt-5">
        <button className="btn-ghost" onClick={() => { setPrincipal(""); setTaxa(""); setAporteMensal(""); setMeses("12"); }}>Limpar</button>
        <button className="btn-gold" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
