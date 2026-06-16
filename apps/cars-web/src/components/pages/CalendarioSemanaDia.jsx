import React, { useMemo, useRef } from "react";
import { T } from "../../lib/theme.js";

/**
 * Grade de horários (visão Semana ou Dia) para a Agenda.
 * Eventos com `horario` (HH:MM) são posicionados pela hora; `duracao` (min)
 * define a altura. Eventos sem horário aparecem numa faixa "dia inteiro" no topo.
 *
 * Props:
 *  - modo: "semana" | "dia"
 *  - refDate: Date (dia de referência — na semana, qualquer dia da semana)
 *  - eventos: [{ id, data, horario, duracao, titulo, categoria }]
 *  - catMeta: (categoriaId) => { cor, label }
 *  - onSlot: (dataISO, horaHH:MM) => void   (clique num horário vazio)
 *  - onEvento: (ev) => void                  (clique num evento)
 */
const HORA_INI = 6;   // mostra das 6h…
const HORA_FIM = 24;  // …até meia-noite
const PX_HORA = 44;   // altura de cada hora

const fmtISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function CalendarioSemanaDia({ modo, refDate, eventos = [], catMeta, onSlot, onEvento }) {
  // Dias visíveis: 7 (semana, começando no domingo) ou 1 (dia).
  const dias = useMemo(() => {
    if (modo === "dia") return [new Date(refDate)];
    const start = new Date(refDate);
    start.setDate(start.getDate() - start.getDay()); // volta pro domingo
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i); return d;
    });
  }, [modo, refDate]);

  const horas = [];
  for (let h = HORA_INI; h < HORA_FIM; h++) horas.push(h);

  const hojeISO = fmtISO(new Date());
  const agora = new Date();
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes();

  // Agrupa eventos por dia ISO.
  const porDia = useMemo(() => {
    const m = {};
    (eventos || []).forEach(ev => {
      if (!ev.data) return;
      (m[ev.data] = m[ev.data] || []).push(ev);
    });
    return m;
  }, [eventos]);

  const topoPx = (hhmm) => {
    const [h, min] = (hhmm || "00:00").split(":").map(Number);
    return (h - HORA_INI) * PX_HORA + (min / 60) * PX_HORA;
  };
  const alturaPx = (dur) => Math.max(22, ((Number(dur) || 60) / 60) * PX_HORA);

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
      {/* Cabeçalho dos dias */}
      <div style={{ display: "grid", gridTemplateColumns: `48px repeat(${dias.length}, 1fr)`, borderBottom: `1px solid ${T.border}` }}>
        <div style={{ background: T.bgSoft }} />
        {dias.map(d => {
          const iso = fmtISO(d);
          const isHoje = iso === hojeISO;
          return (
            <div key={iso} style={{
              padding: "8px 4px", textAlign: "center", background: T.bgSoft,
              borderLeft: `1px solid ${T.border}`,
            }}>
              <div style={{ fontSize: 9.5, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>{DOW[d.getDay()]}</div>
              <div style={{
                fontSize: 16, fontWeight: isHoje ? 700 : 500,
                color: isHoje ? T.gold : T.ink, fontFamily: T.serif,
                width: 28, height: 28, lineHeight: "28px", margin: "2px auto 0", borderRadius: "50%",
                background: isHoje ? `${T.gold}22` : "transparent",
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      {/* Faixa dia-inteiro (eventos sem horário) */}
      {(() => {
        const temAllDay = dias.some(d => (porDia[fmtISO(d)] || []).some(e => !e.horario));
        if (!temAllDay) return null;
        return (
          <div style={{ display: "grid", gridTemplateColumns: `48px repeat(${dias.length}, 1fr)`, borderBottom: `1px solid ${T.border}`, minHeight: 26 }}>
            <div style={{ fontSize: 8.5, color: T.faint, padding: "4px 4px 0", textAlign: "right", textTransform: "uppercase", letterSpacing: ".05em" }}>dia</div>
            {dias.map(d => {
              const iso = fmtISO(d);
              const all = (porDia[iso] || []).filter(e => !e.horario);
              return (
                <div key={iso} style={{ borderLeft: `1px solid ${T.border}`, padding: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                  {all.map(ev => {
                    const meta = catMeta(ev.categoria);
                    return (
                      <button key={ev.id} onClick={() => onEvento?.(ev)} title={ev.titulo}
                        style={{
                          background: `${meta.cor}26`, color: meta.cor, border: `1px solid ${meta.cor}55`,
                          borderRadius: 4, padding: "2px 5px", fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                          textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                        {ev.titulo}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Grade de horas (scroll) */}
      <div style={{ maxHeight: "62vh", overflowY: "auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: `48px repeat(${dias.length}, 1fr)`, position: "relative" }}>
          {/* Coluna de horas */}
          <div>
            {horas.map(h => (
              <div key={h} style={{ height: PX_HORA, position: "relative", borderTop: `1px solid ${T.border}` }}>
                <span style={{ position: "absolute", top: -7, right: 5, fontSize: 9.5, color: T.faint }}>
                  {String(h).padStart(2, "0")}h
                </span>
              </div>
            ))}
          </div>

          {/* Colunas dos dias */}
          {dias.map(d => {
            const iso = fmtISO(d);
            const isHoje = iso === hojeISO;
            const comHora = (porDia[iso] || []).filter(e => e.horario);
            return (
              <div key={iso} style={{ borderLeft: `1px solid ${T.border}`, position: "relative" }}>
                {/* Slots clicáveis por hora */}
                {horas.map(h => (
                  <div key={h}
                    onClick={() => onSlot?.(iso, `${String(h).padStart(2, "0")}:00`)}
                    style={{ height: PX_HORA, borderTop: `1px solid ${T.border}`, cursor: "pointer" }}
                    title={`Novo evento ${String(h).padStart(2, "0")}:00`}
                  />
                ))}

                {/* Linha do "agora" */}
                {isHoje && minutosAgora >= HORA_INI * 60 && minutosAgora < HORA_FIM * 60 && (
                  <div style={{
                    position: "absolute", left: 0, right: 0,
                    top: ((minutosAgora - HORA_INI * 60) / 60) * PX_HORA,
                    borderTop: `2px solid ${T.red}`, zIndex: 3, pointerEvents: "none",
                  }}>
                    <span style={{ position: "absolute", left: 0, top: -4, width: 7, height: 7, borderRadius: "50%", background: T.red }} />
                  </div>
                )}

                {/* Eventos posicionados */}
                {comHora.map(ev => {
                  const meta = catMeta(ev.categoria);
                  return (
                    <button key={ev.id} onClick={(e) => { e.stopPropagation(); onEvento?.(ev); }}
                      title={`${ev.titulo} · ${ev.horario}${ev.duracao ? ` · ${ev.duracao}min` : ""}`}
                      style={{
                        position: "absolute", left: 3, right: 3,
                        top: topoPx(ev.horario), height: alturaPx(ev.duracao),
                        background: `${meta.cor}26`, borderLeft: `3px solid ${meta.cor}`,
                        border: `1px solid ${meta.cor}55`, borderLeftWidth: 3,
                        borderRadius: 5, padding: "2px 6px", cursor: "pointer", zIndex: 2,
                        textAlign: "left", overflow: "hidden",
                        display: "flex", flexDirection: "column",
                      }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.titulo}</span>
                      <span style={{ fontSize: 9.5, color: meta.cor }}>{ev.horario}{ev.duracao ? ` · ${ev.duracao}min` : ""}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
