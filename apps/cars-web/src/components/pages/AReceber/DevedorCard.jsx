// Card de UMA LINHA do devedor (A Receber), com recebimento parcial e
// empréstimo. (Movido de AReceberEDividas.jsx na fatia de 2026-09-21 —
// código idêntico, só mudou de arquivo.)
import React from "react";
import { Trash2, Edit3, Check, RotateCcw, CalendarDays } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { corDoNome } from "./corDoNome.js";

export function DevedorCard({ d, onBaixa, onWhats, onEditar, onExcluir, onVerRecebimentos, onReceberJuros, onQuitar, hidden, dueLabel }) {
  const due = dueLabel ? dueLabel(d.vencimento) : null;
  const isOver = due?.status === "over";
  const isWarn = due?.status === "warn";
  const inicial = (d.nome || "?").trim().charAt(0).toUpperCase();
  const cor = corDoNome(d.nome || "?");
  const borderL = isOver ? `3px solid ${T.red}` : isWarn ? `3px solid ${T.gold}` : `3px solid ${cor}`;
  // Recebimento parcial (backward-compat: valorRecebido undefined → 0)
  const valorTotal = parseFloat(d.valor) || 0;
  const jaRecebido = parseFloat(d.valorRecebido) || 0;
  const temParcial = jaRecebido > 0 && jaRecebido < valorTotal;
  const faltaReceber = Math.max(0, valorTotal - jaRecebido);
  const pctRecebido = valorTotal > 0 ? Math.min(100, (jaRecebido / valorTotal) * 100) : 0;
  const meta = [due && d.vencimento ? due.txt : "", d.combinado || d.obs || ""].filter(Boolean).join(" · ");
  const itemMenu = { background: "transparent", border: "none", cursor: "pointer", padding: "9px 12px", display: "flex", alignItems: "center", gap: 9, width: "100%", fontSize: 12.5, textAlign: "left", color: T.ink };
  // Cor de status: vencido=vermelho, 3 dias=ouro, no prazo=sem cor (neutro, sem verde).
  const sc = isOver ? T.red : isWarn ? T.gold : null;
  // Cor da pílula de data: vencido=vermelho, 3 dias=ouro, no prazo=ouro neutro.
  const corData = sc || T.gold;
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "8px 12px", background: sc ? `${sc}11` : T.card,
      border: `1px solid ${sc ? `${sc}55` : T.border}`, borderLeft: `4px solid ${sc || cor}`, borderRadius: 16,
    }}>
      {/* Data — vencimento em destaque (pílula) */}
      {d.vencimento && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                      background: `${corData}18`, color: corData,
                      border: `1px solid ${corData}44`, borderRadius: 8, padding: "3px 8px" }}>
          <CalendarDays size={13} />
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".01em" }}>
            {d.vencimento.slice(8, 10)}/{d.vencimento.slice(5, 7)}/{d.vencimento.slice(0, 4)}
          </span>
        </div>
      )}
      {/* Nome + meta */}
      <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{ color: T.ink, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nome}</span>
        {meta && (
          <span style={{ fontSize: 10, color: (due && d.vencimento) ? due.cor : T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
        )}
        {temParcial && (
          <div style={{ height: 4, borderRadius: 100, background: `${T.green}22`, overflow: "hidden", marginTop: 4 }}>
            <div style={{ width: `${pctRecebido}%`, height: "100%", background: T.green, transition: "width .25s ease" }} />
          </div>
        )}
      </div>

      {/* Selos */}
      {isOver && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 100, background: `${T.red}22`, color: T.red, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>vencido</span>}
      {isWarn && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 100, background: `${T.gold}22`, color: T.gold, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>3 dias</span>}
      {d.emprestimo && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 100, background: `${T.gold}22`, color: T.gold, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>empréstimo</span>}

      {/* Valor */}
      <div style={{ textAlign: "right", flexShrink: 0, minWidth: 90 }}>
        <div className="num" style={{ color: T.green, fontFamily: T.serif, fontSize: 14.5, fontWeight: 600, lineHeight: 1.1, whiteSpace: "nowrap" }}>
          {hidden ? "•••" : fmt(temParcial ? faltaReceber : d.valor)}
        </div>
        {temParcial && <div style={{ fontSize: 10, color: T.muted }}>falta · de {hidden ? "•••" : fmt(valorTotal)}</div>}
        {d.emprestimo && !temParcial && (Number(d.juros) || 0) > 0 && (
          <div style={{ fontSize: 10, color: T.muted }}>
            princ. {hidden ? "•••" : fmt(d.principal)} + juros {hidden ? "•••" : fmt(d.juros)}
            {!hidden && (Number(d.jurosMensal) || 0) > 0 ? ` (${fmt(d.jurosMensal)}/mês × ${d.meses || 1})` : ""}
          </div>
        )}
      </div>

      {/* Ações */}
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          {d.emprestimo ? (
            <>
              {(Number(d.jurosMensal) || Number(d.juros) || 0) > 0 && onReceberJuros && (
                <button onClick={() => onReceberJuros(d)} title="Receber o juros do mês"
                  style={{ background: "transparent", color: T.gold, border: `1px solid ${T.gold}88`, borderRadius: 12, padding: "6px 10px",
                           cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600 }}>
                  Juros
                </button>
              )}
              {onQuitar && (
                <button onClick={() => onQuitar(d)} title="Receber o principal (quitar)"
                  style={{ background: T.gold, color: T.bg, border: "none", borderRadius: 12, padding: "6px 10px",
                           cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600 }}>
                  <Check size={12} /> Quitar
                </button>
              )}
            </>
          ) : (
            <button onClick={() => onBaixa(d)} title="Receber"
              style={{ background: T.gold, color: T.bg, border: "none", borderRadius: 12, padding: "6px 10px",
                       cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600 }}>
              <Check size={12} /> Receber
            </button>
          )}
          {(d.recebimentos?.length || 0) > 0 && onVerRecebimentos && (
            <button onClick={() => onVerRecebimentos(d)} title="Ver / estornar recebimentos"
              style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "6px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
              <RotateCcw size={13} />
            </button>
          )}
          <button onClick={() => onEditar(d)} title="Editar"
            style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "6px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            <Edit3 size={13} />
          </button>
          <button onClick={() => onExcluir(d)} title="Excluir"
            style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, borderRadius: 12, padding: "6px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            <Trash2 size={13} />
          </button>
        </div>
    </div>
  );
}
