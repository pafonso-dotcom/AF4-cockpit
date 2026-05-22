import React, { useState, useMemo } from "react";
import { X, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Bell, AlarmClock, Repeat } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import PageHeader from "../ui/PageHeader.jsx";
import StatCard from "../ui/StatCard.jsx";
import { getDespesasDoMes, getGanhosDoMes } from "../../lib/agregador.js";

export default function Calendario({
  transacoes, setTransacoes, contas, setContas, categorias, hidden,
  fixaOcorrencias = [], fixas = [], parcelamentos = [], dividas = [], devedores = [],
  escopoAtivo = "tudo",
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);

  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  // Build calendar grid
  const grid = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startDow = first.getDay(); // 0=dom
    const totalDays = last.getDate();
    const cells = [];
    // Leading blanks
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    // Trailing to complete weeks
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  // Itens completos por dia (agregador: despesas fixas + dívidas + parcelas + transações + ganhos)
  const itensByDay = useMemo(() => {
    const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const state = { transacoes, contas, categorias, fixaOcorrencias, fixas, parcelamentos, dividas, devedores };
    const desp = getDespesasDoMes(monthStr, state, escopoAtivo);
    const ganh = getGanhosDoMes(monthStr, state, escopoAtivo);
    const map = {};
    desp.forEach(d => {
      if (!d.data) return;
      const day = parseInt(d.data.slice(8, 10), 10);
      if (!map[day]) map[day] = [];
      map[day].push({ ...d, _kind: "despesa" });
    });
    ganh.forEach(g => {
      if (!g.data) return;
      const day = parseInt(g.data.slice(8, 10), 10);
      if (!map[day]) map[day] = [];
      map[day].push({ ...g, _kind: "ganho" });
    });
    return map;
  }, [transacoes, contas, categorias, fixaOcorrencias, fixas, parcelamentos, dividas, devedores, year, month, escopoAtivo]);

  // Net por dia: derivado dos itens
  const netByDay = useMemo(() => {
    const map = {};
    Object.entries(itensByDay).forEach(([day, lista]) => {
      let net = 0;
      let atrasado = false;
      lista.forEach(i => {
        if (i._kind === "despesa") {
          net -= i.valor;
          if (i.status === "atrasada") atrasado = true;
        } else {
          net += i.valor;
        }
      });
      map[day] = { net, items: lista.length, atrasado };
    });
    return map;
  }, [itensByDay]);

  const navigate = (delta) => {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    else if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Stats for the month — derivadas do mesmo agregador usado na grade (itensByDay)
  const monthStats = useMemo(() => {
    const all = Object.values(itensByDay).flat();
    const receitas = all.filter(i => i._kind === "ganho").reduce((s, i) => s + Number(i.valor || 0), 0);
    const despesas = all.filter(i => i._kind === "despesa").reduce((s, i) => s + Number(i.valor || 0), 0);
    const pendentes = all.filter(i => i.status !== "paga").length;
    const atrasadas = all.filter(i => i.status === "atrasada").length;
    return { receitas, despesas, pendentes, atrasadas, total: all.length };
  }, [itensByDay]);

  const dayEvents = selectedDay ? (itensByDay[selectedDay] || []) : [];

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo V"
        title="Calendário"
        sub="Vencimentos do mês em vista panorâmica. Nada passa despercebido."
      />

      {/* Month navigator */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted, padding: 10, cursor: "pointer" }}>
            <ChevronLeft size={16} />
          </button>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 28, color: T.ink, fontWeight: 600, letterSpacing: "-0.02em" }}>
              {months[month]} <span style={{ color: T.gold }}>{year}</span>
            </div>
          </div>
          <button onClick={() => navigate(1)}
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.muted, padding: 10, cursor: "pointer" }}>
            <ChevronRight size={16} />
          </button>
        </div>
        <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
                className="btn-ghost">
          Hoje
        </button>
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px mb-6" style={{ background: T.border }}>
        <StatCard label="Receitas previstas" value={hidden ? "•••" : fmt(monthStats.receitas)} accent={T.green} icon={ArrowUpRight} />
        <StatCard label="Despesas previstas" value={hidden ? "•••" : fmt(monthStats.despesas)} accent={T.red} icon={ArrowDownRight} />
        <StatCard label="Pendentes" value={String(monthStats.pendentes)} accent={T.gold} icon={AlarmClock} />
        <StatCard label="Em atraso" value={String(monthStats.atrasadas)} accent={T.red} icon={Bell}
                  sub={monthStats.atrasadas > 0 ? "Atenção!" : "Tudo no prazo"} />
      </div>

      {/* Calendar grid */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 16 }}>
        <div className="grid grid-cols-7 gap-px mb-2" style={{ background: T.border }}>
          {["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map(d => (
            <div key={d} style={{ background: T.bgSoft, padding: "8px 4px", textAlign: "center",
                                   color: T.muted, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", fontWeight: 500 }}>
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px" style={{ background: T.border }}>
          {grid.map((d, idx) => {
            if (d === null) return <div key={idx} style={{ background: T.bgSoft, minHeight: 78 }} />;
            const info = netByDay[d];
            const isHoje = isToday(d);
            const isSelected = d === selectedDay;
            const cor = info?.atrasado ? T.red : (info?.net > 0 ? T.green : info?.net < 0 ? T.red : T.muted);
            return (
              <button key={idx} onClick={() => setSelectedDay(isSelected ? null : d)}
                style={{
                  background: isSelected ? T.cardHi : (isHoje ? `${T.gold}11` : T.bgSoft),
                  minHeight: 78, padding: 6, textAlign: "left", cursor: "pointer",
                  border: isHoje ? `2px solid ${T.gold}` : "none",
                  position: "relative", overflow: "hidden",
                  transition: "background 0.2s",
                }}>
                <div className="num" style={{
                  color: isHoje ? T.gold : T.ink, fontSize: 13, fontWeight: isHoje ? 700 : 500,
                  marginBottom: 2,
                }}>
                  {d}
                </div>
                {info && (
                  <div style={{ marginTop: 14, textAlign: "center" }}>
                    <div className="num" style={{
                      fontSize: 11.5, fontWeight: 600, color: cor, lineHeight: 1.1,
                    }}>
                      {info.net > 0 ? "+ " : info.net < 0 ? "− " : ""}{hidden ? "•••" : fmt(Math.abs(info.net))}
                    </div>
                    <div style={{ fontSize: 8.5, color: T.muted, marginTop: 1 }}>
                      {info.items} {info.items === 1 ? "item" : "itens"}
                      {info.atrasado && <span style={{ color: T.red, marginLeft: 3 }}>⚠</span>}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Day details */}
      {selectedDay && (
        <div className="mt-6" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <div className="label-eyebrow">Dia selecionado</div>
              <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4, fontWeight: 600 }}>
                {selectedDay} de {months[month]} de {year}
              </h3>
            </div>
            <button onClick={() => setSelectedDay(null)} style={{ color: T.muted, background: "transparent", border: "none", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
          {dayEvents.length === 0 ? (
            <div style={{ color: T.muted, fontStyle: "italic" }}>Nenhuma transação prevista para este dia.</div>
          ) : (
            <div className="space-y-2">
              {dayEvents.map((t, i) => {
                const cat = categorias.find(c => c.nome === t.categoria);
                const isReceita = t._kind === "ganho";
                const isPaga = t.status === "paga";
                const isAtrasada = t.status === "atrasada";
                const cor = isReceita ? T.green : T.red;
                const tipoBadge = {
                  fixa:     { lbl: "Fixa",     cor: T.gold },
                  variavel: { lbl: "Variável", cor: T.muted },
                  parcela:  { lbl: "Parcela",  cor: T.blue || "#60a5fa" },
                  ganho:    { lbl: "Ganho",    cor: T.green },
                }[t.tipo] || { lbl: t.tipo || "—", cor: T.muted };
                const statusCfg = isAtrasada
                  ? { bg: `${T.red}22`, fg: T.red, lbl: "Em atraso", Icon: Bell }
                  : isPaga
                    ? { bg: `${cor}22`, fg: cor, lbl: isReceita ? "Recebido" : "Pago", Icon: isReceita ? ArrowUpRight : ArrowDownRight }
                    : { bg: `${T.gold}22`, fg: T.gold, lbl: "Aguardando", Icon: AlarmClock };
                const Icon = statusCfg.Icon;
                return (
                  <div key={t.id || i} className="flex items-center gap-3 py-3" style={{
                    borderBottom: `1px solid ${T.border}`,
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%",
                      background: statusCfg.bg, color: statusCfg.fg,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>
                        {t.descricao}
                      </div>
                      <div className="flex gap-2 mt-1 flex-wrap text-xs">
                        <span style={{
                          background: `${tipoBadge.cor}22`, color: tipoBadge.cor,
                          padding: "1px 6px", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
                          borderRadius: 3,
                        }}>{tipoBadge.lbl}</span>
                        {cat && (
                          <span style={{ background: cat.cor + "22", color: cat.cor, padding: "1px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 3 }}>
                            {cat.nome}
                          </span>
                        )}
                        {!cat && t.categoria && (
                          <span style={{ background: T.bgSoft, color: T.muted, padding: "1px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase", borderRadius: 3 }}>
                            {t.categoria}
                          </span>
                        )}
                        <span style={{
                          background: statusCfg.bg, color: statusCfg.fg,
                          padding: "1px 8px", fontSize: 10, fontWeight: 500, letterSpacing: "0.08em", textTransform: "uppercase",
                          borderRadius: 3,
                        }}>
                          {statusCfg.lbl}
                        </span>
                      </div>
                    </div>
                    <div className="num text-right" style={{ color: cor, fontSize: 15, fontWeight: 600 }}>
                      {isReceita ? "+" : "−"} {hidden ? "•••" : fmt(t.valor)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-6 flex items-center gap-4 flex-wrap" style={{ color: T.muted, fontSize: 12 }}>
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.green }} /> Receita
        </div>
        <div className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: T.red }} /> Despesa
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: T.green }}>✓</span> Compensada
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: T.gold }}>○</span> Aguardando
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: T.red }}>⚠</span> Em atraso
        </div>
      </div>
    </div>
  );
}

