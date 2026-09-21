// ParcelarBlock — UI explícita pra parcelar Recebimento/Compromisso por mês.
// (Movido de AReceberEDividas.jsx na fatia de 2026-09-21 — código idêntico.)
import React from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import Field from "../../ui/Field.jsx";

export default function ParcelarBlock({ form, setForm }) {
  const isReceber = form.tipo === "receber";
  const ativo = !!form.parcelar;
  const n = Math.max(1, Math.min(96, parseInt(form.numParcelas, 10) || 1));
  const valorTotal = Number(form.valor) || 0;
  const valorPorPar = form.modoValor === "total" && n > 0 ? valorTotal / n : valorTotal;
  const totalGerado = form.modoValor === "total" ? valorTotal : valorTotal * n;

  // Preview: lista os N vencimentos com base no Vencimento + 1 mês
  const preview = (() => {
    if (!ativo || !form.vencimento || n <= 1) return [];
    const [y, m, d] = form.vencimento.split("-").map(Number);
    if (!y || !m || !d) return [];
    const out = [];
    for (let i = 0; i < n; i++) {
      const alvoMes = m - 1 + i;
      const venc = new Date(y, alvoMes, 1);
      const ultimoDia = new Date(y, alvoMes + 1, 0).getDate();
      venc.setDate(Math.min(d, ultimoDia));
      out.push({
        parcela: `${i + 1}/${n}`,
        iso: `${venc.getFullYear()}-${String(venc.getMonth() + 1).padStart(2, "0")}-${String(venc.getDate()).padStart(2, "0")}`,
      });
    }
    return out;
  })();

  const dataLbl = (iso) => {
    if (!iso) return "—";
    try {
      const [y, m, d] = iso.split("-").map(Number);
      return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return iso; }
  };

  return (
    <div style={{
      background: T.bgSoft,
      border: `1px solid ${ativo ? T.gold : T.border}`,
      borderLeft: `3px solid ${ativo ? T.gold : T.border}`,
      borderRadius: 16,
      padding: 12,
      marginBottom: 14,
    }}>
      {/* Toggle */}
      <label style={{
        display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
        userSelect: "none",
      }}>
        <input type="checkbox" checked={ativo}
               onChange={e => setForm({ ...form, parcelar: e.target.checked })}
               style={{ width: 18, height: 18, accentColor: T.gold, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>
            Parcelar {isReceber ? "recebimento" : "pagamento"} por mês
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Cria uma entrada separada para cada mês a partir do vencimento.
          </div>
        </div>
      </label>

      {ativo && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
          {/* Linha 1: nº parcelas + modo */}
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 10 }}>
            <Field label="Em quantas parcelas?">
              <input type="number" min="2" max="96" value={form.numParcelas}
                     onChange={e => setForm({ ...form, numParcelas: e.target.value })}
                     placeholder="3" />
            </Field>
            <Field label="O valor digitado é…">
              <select value={form.modoValor || "total"}
                      onChange={e => setForm({ ...form, modoValor: e.target.value })}>
                <option value="total">Total — dividir entre as parcelas</option>
                <option value="porParcela">Por parcela — multiplicar pelo nº</option>
              </select>
            </Field>
          </div>

          {/* Resumo */}
          {valorTotal > 0 && n > 1 && (
            <div style={{
              padding: 10, marginBottom: 10,
              background: `${T.gold}11`,
              border: `1px solid ${T.gold}44`,
              borderRadius: 12, fontSize: 12, color: T.ink,
              display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6,
            }}>
              <span>
                <strong className="num">{n}×</strong> de{" "}
                <strong className="num" style={{ color: T.gold }}>{fmt(valorPorPar)}</strong>
              </span>
              <span style={{ color: T.muted }}>
                Total: <strong className="num" style={{ color: T.ink }}>{fmt(totalGerado)}</strong>
              </span>
            </div>
          )}

          {/* Preview de vencimentos */}
          {preview.length > 0 && (
            <div>
              <div style={{
                fontSize: 10.5, letterSpacing: ".15em", textTransform: "uppercase",
                color: T.muted, fontWeight: 600, marginBottom: 6,
              }}>
                Vencimentos previstos
              </div>
              <div style={{
                maxHeight: 180, overflowY: "auto",
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
              }}>
                {preview.map((p, i) => (
                  <div key={p.parcela} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "7px 10px",
                    borderBottom: i < preview.length - 1 ? `1px solid ${T.border}` : "none",
                    fontSize: 12,
                  }}>
                    <span style={{ color: T.muted, fontWeight: 600, minWidth: 42 }}>{p.parcela}</span>
                    <span style={{ color: T.ink, flex: 1, marginLeft: 8 }}>{dataLbl(p.iso)}</span>
                    <span className="num" style={{ color: isReceber ? T.green : T.red, fontWeight: 500 }}>
                      {fmt(valorPorPar)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!form.vencimento && (
            <div style={{
              fontSize: 11, color: T.gold, marginTop: 8, fontStyle: "italic",
            }}>
              ⚠ Preencha o <strong>Vencimento</strong> acima pra calcular as datas das parcelas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
