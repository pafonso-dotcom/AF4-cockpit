import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, todayISO } from "../../lib/format.js";

/**
 * Modal compacto pra dar baixa numa parcela pendente/atrasada.
 * Pergunta: conta de débito, data do pagamento e observação opcional.
 * Devolve via onConfirm({ conta, data, obs }).
 */
export default function BaixaParcelaModal({ item, contas, onConfirm, onClose }) {
  const contasFiltradas = (contas || []).filter(c => !c.arquivada);

  const [contaId, setContaId] = useState(contasFiltradas[0]?.id || "");
  const [data, setData] = useState(item?.data || todayISO());
  const [obs, setObs] = useState("");

  if (!item) return null;

  const conta = contasFiltradas.find(c => c.id === contaId);

  const confirmar = () => {
    if (!conta) return;
    onConfirm({ conta, data, obs });
  };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "grid", placeItems: "center", zIndex: 1000,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, borderRadius: 18, padding: 22,
        minWidth: 340, maxWidth: 460, border: `1px solid ${T.border}`,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 9.5, letterSpacing: ".18em", color: T.faint,
              textTransform: "uppercase", fontWeight: 600,
            }}>
              Dar baixa em parcela
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: T.ink }}>
              {item.descricao}
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
              Valor: <strong style={{ color: T.red }}>{fmt(item.valor)}</strong>
              {item.data && (
                <> · venc. {item.data.slice(8, 10)}/{item.data.slice(5, 7)}</>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: T.muted,
            fontSize: 18, cursor: "pointer", marginLeft: 8,
          }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, color: T.muted, fontWeight: 600,
            letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 4,
          }}>
            Conta de débito
          </div>
          <select value={contaId} onChange={e => setContaId(e.target.value)} style={{
            width: "100%", padding: "8px 11px", background: T.bgSoft,
            border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 11,
          }}>
            {contasFiltradas.length === 0 && <option value="">— Nenhuma conta disponível —</option>}
            {contasFiltradas.map(c => (
              <option key={c.id} value={c.id}>
                {c.nome} · saldo {fmt(c.saldo || 0)}
              </option>
            ))}
          </select>
          {conta && (Number(conta.saldo) || 0) < (Number(item.valor) || 0) && (
            <div style={{ fontSize: 10.5, color: T.red, marginTop: 4 }}>
              ⚠ Saldo insuficiente · vai ficar negativo
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 10, color: T.muted, fontWeight: 600,
            letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 4,
          }}>
            Data do pagamento
          </div>
          <input type="date" value={data} onChange={e => setData(e.target.value)} style={{
            width: "100%", padding: "8px 11px", background: T.bgSoft,
            border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 11,
          }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 10, color: T.muted, fontWeight: 600,
            letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 4,
          }}>
            Observação (opcional)
          </div>
          <input value={obs} onChange={e => setObs(e.target.value)}
                 placeholder="Ex.: pago via PIX"
                 style={{
                   width: "100%", padding: "8px 11px", background: T.bgSoft,
                   border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 11,
                 }} />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 14px", background: "transparent",
            border: `1px solid ${T.border}`, color: T.muted,
            borderRadius: 11, fontSize: 11, fontWeight: 600, cursor: "pointer",
            letterSpacing: ".05em", textTransform: "uppercase",
          }}>Cancelar</button>
          <button onClick={confirmar} disabled={!contaId} style={{
            padding: "8px 14px", background: T.green, color: "#fff",
            border: "none", borderRadius: 11, fontSize: 11, fontWeight: 600,
            cursor: contaId ? "pointer" : "not-allowed",
            letterSpacing: ".05em", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 6,
            opacity: contaId ? 1 : 0.5,
          }}>
            <Check size={13} /> Confirmar baixa
          </button>
        </div>
      </div>
    </div>
  );
}
