import React, { useMemo } from "react";
import {
  Calendar, CheckSquare, Sparkles, ShoppingCart, Target,
  Clock, ChevronRight, CheckCircle2, Circle, Flag, Folder, MapPin,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { todayISO } from "../../lib/format.js";
import { getPerfilAtivo } from "../../lib/perfis.js";

const PRIO_COR = { alta: "#f87171", media: "#fbbf24", baixa: "#60a5fa" };
const PRIO_LBL = { alta: "Alta", media: "Média", baixa: "Baixa" };

const CAT_AGENDA = {
  compromisso: { cor: "#c9a96b", lbl: "Compromisso" },
  viagem:      { cor: "#70ad47", lbl: "Viagem" },
  lembrete:    { cor: "#5b9bd5", lbl: "Lembrete" },
  pessoal:     { cor: "#e7a3a3", lbl: "Pessoal" },
  evento:      { cor: "#d97757", lbl: "Evento" },
};

function saudar() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function dataHojeLonga() {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
  });
}

function diasAteHoje(iso) {
  if (!iso) return null;
  try {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(iso + "T00:00:00");
    return Math.round((alvo - hoje) / 86400000);
  } catch { return null; }
}

function prazoLbl(iso) {
  const d = diasAteHoje(iso);
  if (d === null) return null;
  if (d < 0) return `${-d}d atrasada`;
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d <= 7) return `em ${d}d`;
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

export default function AgendaInicio({
  agenda = [], tarefas = [], ideias = [], compras = [], metas = [],
  setTab,
}) {
  const perfil = getPerfilAtivo();
  const primeiroNome = (perfil?.nome || "Você").split(" ")[0];
  const hojeISO = todayISO();

  /* ---------- Computações ---------- */
  const { eventosHoje, eventosProximos } = useMemo(() => {
    const futuros = (agenda || [])
      .filter(e => e.status !== "feito")
      .filter(e => !e.data || e.data >= hojeISO)
      .sort((a, b) =>
        (a.data || "9999").localeCompare(b.data || "9999")
        || (a.horario || "").localeCompare(b.horario || "")
      );
    return {
      eventosHoje: futuros.filter(e => e.data === hojeISO),
      eventosProximos: futuros.slice(0, 6),
    };
  }, [agenda, hojeISO]);

  const tarefasPendentes = useMemo(() => {
    const prioRank = { alta: 0, media: 1, baixa: 2 };
    return (tarefas || [])
      .filter(t => !t.concluida)
      .sort((a, b) => {
        const pd = (prioRank[a.prioridade] ?? 1) - (prioRank[b.prioridade] ?? 1);
        if (pd !== 0) return pd;
        return (a.prazo || "9999").localeCompare(b.prazo || "9999");
      });
  }, [tarefas]);

  const tarefasHoje = useMemo(() => {
    return tarefasPendentes.filter(t => !t.prazo || t.prazo === hojeISO).slice(0, 6);
  }, [tarefasPendentes, hojeISO]);

  const focoDoDia = tarefasPendentes.find(t => t.prioridade === "alta") || tarefasPendentes[0] || null;

  const comprasPendentes = (compras || []).filter(c => !c.checked).length;
  const ideiasFixadas = (ideias || []).filter(i => i.pinned).length;
  const metasAtivas = (metas || []).filter(m => (m.atual || 0) < (m.alvo || 0)).length;

  const go = (tab) => setTab?.(tab);

  return (
    <div className="fade-up agenda-inicio">
      {/* HERO · saudação */}
      <div className="agenda-hero">
        <div>
          <h1 style={{
            fontFamily: T.serif, fontSize: "clamp(24px, 4vw, 34px)",
            color: T.ink, margin: 0, fontWeight: 600, letterSpacing: "-0.01em",
          }}>
            {saudar()}, {primeiroNome} <span style={{ filter: "grayscale(.2)" }}>👋</span>
          </h1>
          <div style={{
            color: T.muted, fontSize: 13, marginTop: 4,
            textTransform: "capitalize",
          }}>
            {dataHojeLonga()}
          </div>
        </div>
      </div>

      {/* KPIs · 4-up no mobile, 5-up no desktop */}
      <div className="agenda-kpis">
        <KpiCard icon={Calendar}     cor={T.gold}     valor={eventosHoje.length} label="Eventos hoje"     subtitle={eventosHoje.length === 0 ? "Dia livre" : "Programado"}     onClick={() => go("calendario")} />
        <KpiCard icon={CheckSquare}  cor="#60a5fa"    valor={tarefasPendentes.length} label="Tarefas"     subtitle={tarefasHoje.length === 0 ? "Nada pra hoje" : `${tarefasHoje.length} pra hoje`} onClick={() => go("tarefas")} />
        <KpiCard icon={Target}       cor="#a78bfa"    valor={metasAtivas}             label="Metas ativas" subtitle="Em progresso"           onClick={() => go("metas")} />
        <KpiCard icon={ShoppingCart} cor="#fbbf24"    valor={comprasPendentes}        label="Compras"      subtitle={comprasPendentes === 0 ? "Lista vazia" : "A comprar"} onClick={() => go("compras")} />
        <KpiCard icon={Sparkles}     cor="#34d399"    valor={(ideias || []).length}   label="Ideias"       subtitle={ideiasFixadas > 0 ? `${ideiasFixadas} fixada${ideiasFixadas > 1 ? "s" : ""}` : "Brain dump"}    onClick={() => go("ideias")} />
      </div>

      {/* FOCO DO DIA · ocupa largura toda quando tem */}
      {focoDoDia && (
        <div className="agenda-foco" onClick={() => go("tarefas")}>
          <div className="agenda-foco-icon">
            <Flag size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".15em", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 }}>
              Foco do dia
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>
              {focoDoDia.titulo}
            </div>
            {focoDoDia.projeto && (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Folder size={11} /> {focoDoDia.projeto}
              </div>
            )}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
            color: PRIO_COR[focoDoDia.prioridade] || T.gold,
            padding: "4px 9px", borderRadius: 4,
            background: `${PRIO_COR[focoDoDia.prioridade] || T.gold}1a`,
          }}>
            {PRIO_LBL[focoDoDia.prioridade] || "—"}
          </span>
          <ChevronRight size={16} style={{ color: T.muted, flexShrink: 0 }} />
        </div>
      )}

      {/* GRID PRINCIPAL · Próximos eventos + Tarefas de hoje */}
      <div className="agenda-grid-main">
        <SectionCard
          titulo="Próximos eventos"
          acao={{ lbl: "Ver agenda", onClick: () => go("calendario") }}
          vazio={eventosProximos.length === 0}
          vazioMsg="Sem eventos próximos."
          vazioIcone={Calendar}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {eventosProximos.map(ev => (
              <EventoRow key={ev.id} ev={ev} onClick={() => go("notas")} />
            ))}
          </div>
        </SectionCard>

        <SectionCard
          titulo="Tarefas de hoje"
          acao={{ lbl: "Ver todas", onClick: () => go("tarefas") }}
          vazio={tarefasHoje.length === 0}
          vazioMsg="Nenhuma tarefa pra hoje."
          vazioIcone={CheckSquare}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tarefasHoje.map(t => (
              <TarefaMiniRow key={t.id} t={t} onClick={() => go("tarefas")} />
            ))}
          </div>
        </SectionCard>
      </div>

      {/* GRID SECUNDÁRIO · Metas + Ideias fixadas · só desktop */}
      <div className="agenda-grid-bot">
        <SectionCard
          titulo="Metas em andamento"
          acao={{ lbl: "Ver metas", onClick: () => go("metas") }}
          vazio={metas.filter(m => (m.atual || 0) < (m.alvo || 0)).length === 0}
          vazioMsg="Sem metas ativas."
          vazioIcone={Target}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {metas.filter(m => (m.atual || 0) < (m.alvo || 0)).slice(0, 4).map(m => {
              const pct = Math.min(100, ((m.atual || 0) / (m.alvo || 1)) * 100);
              return (
                <div key={m.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: T.ink }}>{m.nome}</span>
                    <span className="num" style={{ fontSize: 11, color: T.gold, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, background: T.border, borderRadius: 999 }}>
                    <div style={{
                      width: `${pct}%`, height: "100%", borderRadius: 999,
                      background: T.gold, transition: "width .4s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          titulo="Ideias fixadas"
          acao={{ lbl: "Ver ideias", onClick: () => go("ideias") }}
          vazio={(ideias || []).filter(i => i.pinned).length === 0}
          vazioMsg="Nenhuma ideia fixada."
          vazioIcone={Sparkles}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(ideias || []).filter(i => i.pinned).slice(0, 4).map(i => (
              <div key={i.id} onClick={() => go("ideias")}
                   style={{
                     padding: "8px 10px", background: T.bgSoft, borderRadius: 6,
                     borderLeft: `3px solid ${T.gold}`, cursor: "pointer",
                     fontSize: 12.5, color: T.ink, lineHeight: 1.4,
                     display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                     overflow: "hidden",
                   }}>
                {i.texto}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <style>{`
        .agenda-inicio { padding: 14px 0 24px; }
        .agenda-hero { margin-bottom: 16px; }
        .agenda-kpis {
          display: grid; gap: 10px;
          grid-template-columns: repeat(5, 1fr);
          margin-bottom: 14px;
        }
        .agenda-foco {
          display: flex; align-items: center; gap: 12px;
          background: linear-gradient(135deg, ${T.card}, ${T.cardHi});
          border: 1px solid ${T.border};
          border-left: 3px solid ${T.gold};
          border-radius: 12px;
          padding: 14px 16px;
          margin-bottom: 14px;
          cursor: pointer;
          transition: border-color .15s, transform .15s;
        }
        .agenda-foco:hover { border-color: ${T.gold}; transform: translateY(-1px); }
        .agenda-foco-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: ${T.gold}22; color: ${T.gold};
          display: grid; place-items: center; flex-shrink: 0;
        }
        .agenda-grid-main {
          display: grid; gap: 12px;
          grid-template-columns: 1fr 1fr;
          margin-bottom: 12px;
        }
        .agenda-grid-bot {
          display: grid; gap: 12px;
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 1024px) {
          .agenda-kpis { grid-template-columns: repeat(3, 1fr); }
          .agenda-kpis > :first-child { grid-column: span 3; }
        }
        @media (max-width: 768px) {
          .agenda-kpis { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .agenda-kpis > :first-child { grid-column: span 2; }
          .agenda-grid-main, .agenda-grid-bot {
            grid-template-columns: 1fr;
          }
          .agenda-foco { padding: 12px 14px; gap: 10px; }
          .agenda-foco-icon { width: 36px; height: 36px; }
        }
      `}</style>
    </div>
  );
}

function KpiCard({ icon: Icon, cor, valor, label, subtitle, onClick }) {
  return (
    <button onClick={onClick}
            className="kpi-card"
            style={{
              background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
              padding: "14px 14px", textAlign: "left", cursor: "pointer",
              display: "flex", flexDirection: "column", gap: 8,
              transition: "border-color .15s, transform .15s",
            }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9,
          background: `${cor}22`, color: cor,
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          <Icon size={17} />
        </div>
      </div>
      <div>
        <div className="num" style={{ fontSize: 22, fontWeight: 700, color: T.ink, lineHeight: 1 }}>
          {valor}
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, fontWeight: 500 }}>
          {label}
        </div>
        {subtitle && (
          <div style={{ fontSize: 10, color: T.faint, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>
      <style>{`
        .kpi-card:hover { border-color: ${T.borderHi}; transform: translateY(-1px); }
      `}</style>
    </button>
  );
}

function SectionCard({ titulo, acao, vazio, vazioMsg, vazioIcone: VazioIcone, children }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{titulo}</div>
        {acao && (
          <button onClick={acao.onClick}
                  style={{
                    background: "transparent", border: "none", color: T.gold,
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: 3,
                  }}>
            {acao.lbl} <ChevronRight size={12} />
          </button>
        )}
      </div>
      {vazio ? (
        <div style={{
          textAlign: "center", padding: "26px 16px", color: T.muted, fontSize: 12.5,
        }}>
          {VazioIcone && <VazioIcone size={28} style={{ color: T.faint, marginBottom: 8, display: "inline" }} />}
          <div>{vazioMsg}</div>
        </div>
      ) : children}
    </div>
  );
}

function EventoRow({ ev, onClick }) {
  const cat = CAT_AGENDA[ev.categoria] || CAT_AGENDA.compromisso;
  const horarioLbl = ev.horario || (ev.data === todayISO() ? "hoje" : prazoLbl(ev.data));
  return (
    <div onClick={onClick}
         style={{
           display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12,
           padding: "9px 10px", borderRadius: 8,
           background: T.bgSoft, borderLeft: `3px solid ${cat.cor}`,
           cursor: "pointer",
         }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: T.ink, minWidth: 50,
        display: "flex", flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
      }}>
        <span className="num">{horarioLbl || "—"}</span>
        {ev.duracao && <span style={{ fontSize: 9.5, color: T.faint, fontWeight: 400 }}>{ev.duracao}min</span>}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {ev.titulo}
        </div>
        {(ev.local || cat.lbl) && (
          <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
            {ev.local ? <><MapPin size={10} /> {ev.local}</> : cat.lbl}
          </div>
        )}
      </div>
    </div>
  );
}

function TarefaMiniRow({ t, onClick }) {
  return (
    <div onClick={onClick}
         style={{
           display: "flex", alignItems: "center", gap: 10,
           padding: "9px 10px", borderRadius: 8,
           background: T.bgSoft,
           borderLeft: `3px solid ${PRIO_COR[t.prioridade] || T.gold}`,
           cursor: "pointer",
         }}>
      {t.concluida
        ? <CheckCircle2 size={16} style={{ color: T.green, flexShrink: 0 }} />
        : <Circle size={16} style={{ color: T.muted, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: T.ink,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          textDecoration: t.concluida ? "line-through" : "none",
        }}>
          {t.titulo}
        </div>
      </div>
      <span style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
        color: PRIO_COR[t.prioridade] || T.gold,
        padding: "2px 7px", borderRadius: 3,
        background: `${PRIO_COR[t.prioridade] || T.gold}1a`,
        flexShrink: 0,
      }}>
        {PRIO_LBL[t.prioridade] || "—"}
      </span>
    </div>
  );
}
