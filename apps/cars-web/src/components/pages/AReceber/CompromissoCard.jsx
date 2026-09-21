// Card de UMA LINHA para A Pagar (e compromissos em geral) — mesmo padrão dos
// cheques e do A Receber: data (pílula) · nome (+ meta) · selos · valor · ações.
// (Movido de AReceberEDividas.jsx na fatia de 2026-09-21 — código idêntico.)
import React from "react";
import { Trash2, Edit3, Check, MessageCircle, CalendarDays, Tag } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { corDoNome } from "./corDoNome.js";

export default function CompromissoCard({ item, hidden, dueLabel, corAccent, isReceber, labelAcao, showCredor, onBaixa, onWhats, onEditar, onExcluir }) {
  const due = dueLabel ? dueLabel(item.vencimento) : null;
  const isOver = due?.status === "over";
  const isWarn = due?.status === "warn";
  const cor = corDoNome(item.nome || "?");
  const sc = isOver ? T.red : isWarn ? T.gold : null;
  const corData = sc || corAccent;
  const vencStr = item.vencimento
    ? (typeof item.vencimento === "string"
        ? item.vencimento
        : (() => { try { return new Date(item.vencimento).toISOString().slice(0, 10); } catch { return ""; } })())
    : "";
  const meta = [
    showCredor && item.credor ? item.credor : "",
    item.parcela || "",
    item.obs || "",
  ].filter(Boolean).join(" · ");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "8px 12px", background: sc ? `${sc}11` : T.card,
      border: `1px solid ${sc ? `${sc}55` : T.border}`, borderLeft: `4px solid ${sc || cor}`, borderRadius: 16,
    }}>
      {/* Data — vencimento em destaque (pílula) */}
      {vencStr && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
                      background: `${corData}18`, color: corData,
                      border: `1px solid ${corData}44`, borderRadius: 8, padding: "3px 8px" }}>
          <CalendarDays size={13} />
          <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: ".01em" }}>
            {vencStr.slice(8, 10)}/{vencStr.slice(5, 7)}/{vencStr.slice(0, 4)}
          </span>
        </div>
      )}
      {/* Categoria — chip ao lado da data */}
      {item.categoria && (
        <div title={item.subcategoria ? `${item.categoria} › ${item.subcategoria}` : item.categoria}
             style={{ display: "inline-flex", alignItems: "center", gap: 4, flexShrink: 0, maxWidth: 170,
                      background: T.bgSoft, color: T.muted,
                      border: `1px solid ${T.border}`, borderRadius: 8, padding: "3px 8px" }}>
          <Tag size={11} />
          <span style={{ fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {item.subcategoria ? `${item.categoria} · ${item.subcategoria}` : item.categoria}
          </span>
        </div>
      )}
      {/* Nome + meta */}
      <div style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{ color: T.ink, fontSize: 14, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.nome}</span>
        {meta && (
          <span style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta}</span>
        )}
      </div>
      {/* Selos */}
      {isOver && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 100, background: `${T.red}22`, color: T.red, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>vencido</span>}
      {isWarn && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 100, background: `${T.gold}22`, color: T.gold, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 700, flexShrink: 0 }}>3 dias</span>}
      {/* Valor */}
      <div className="num" style={{ color: corAccent, fontFamily: T.serif, fontSize: 14.5, fontWeight: 600, minWidth: 90, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>
        {hidden ? "•••" : fmt(item.valor)}
      </div>
      {/* Ações */}
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
        <button onClick={onBaixa} title={`✓ ${labelAcao}`}
          style={{ background: corAccent, color: isReceber ? T.bg : "#fff", border: "none", borderRadius: 12,
                   padding: "6px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600 }}>
          <Check size={12} /> {labelAcao}
        </button>
        <button onClick={onWhats} title="WhatsApp"
          style={{ background: "transparent", color: "#25D366", border: `1px solid ${T.border}`, borderRadius: 12, padding: "6px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
          <MessageCircle size={13} />
        </button>
        <button onClick={onEditar} title="Editar"
          style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "6px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
          <Edit3 size={13} />
        </button>
        <button onClick={onExcluir} title="Excluir"
          style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, borderRadius: 12, padding: "6px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
