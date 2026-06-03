import React, { useMemo, useState, useEffect } from "react";
import {
  Plus, Trash2, Edit3, Search, Tag as TagIcon, Pin, PinOff,
  Briefcase, Plane, AlarmClock, Heart, Star, StickyNote, FileText,
  Clock, MapPin, Link2, Check, ChevronDown,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";

const CATEGORIAS = [
  { id: "compromisso", label: "Compromisso", cor: "#c9a96b", icon: Briefcase },
  { id: "viagem",      label: "Viagem",      cor: "#70ad47", icon: Plane },
  { id: "lembrete",    label: "Lembrete",    cor: "#5b9bd5", icon: AlarmClock },
  { id: "pessoal",     label: "Pessoal",     cor: "#e7a3a3", icon: Heart },
  { id: "evento",      label: "Evento",      cor: "#d97757", icon: Star },
];

const catMeta = (id) => CATEGORIAS.find(c => c.id === id) || CATEGORIAS[0];

// Migração: categorias antigas das Notas → categorias da Agenda
const MAP_CAT_LEGACY = {
  investimentos: "compromisso",
  viagens: "viagem",
  trabalho: "compromisso",
  pessoal: "pessoal",
  geral: "lembrete",
};

function formatarDataCurta(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

function formatarDataLonga(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long", year: "numeric" });
  } catch { return iso; }
}

function diasAteHoje(iso) {
  if (!iso) return Infinity;
  try {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(iso + "T00:00:00");
    return Math.round((alvo - hoje) / 86400000);
  } catch { return Infinity; }
}

function diasRelativos(iso) {
  const d = diasAteHoje(iso);
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d === -1) return "ontem";
  if (d > 1 && d <= 7) return `em ${d} dias`;
  if (d < 0 && d >= -7) return `há ${-d} dias`;
  if (d > 7 && d <= 30) return `em ${Math.round(d / 7)} sem`;
  return formatarDataCurta(iso);
}

export default function Notas({ agenda = [], setAgenda, notasLegacy = [], setNotasLegacy }) {
  const [form, setForm] = useState(null);
  const [filtroCat, setFiltroCat] = useState("todas");
  const [busca, setBusca] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [quickAdd, setQuickAdd] = useState("");
  const [mostrarPassados, setMostrarPassados] = useState(false);

  // Migração de Notas legadas → Agenda (uma vez)
  useEffect(() => {
    if (!notasLegacy || notasLegacy.length === 0) return;
    const migrados = notasLegacy.map(n => ({
      id: n.id || uid(),
      titulo: n.titulo || "(sem título)",
      descricao: n.conteudo || "",
      data: (n.createdAt || todayISO()).slice(0, 10),
      horario: null,
      duracao: null,
      categoria: MAP_CAT_LEGACY[n.categoria] || "lembrete",
      local: "",
      link: "",
      status: "agendado",
      pinned: !!n.pinned,
      createdAt: n.createdAt || new Date().toISOString(),
      updatedAt: n.updatedAt || new Date().toISOString(),
      // marca pra debug
      _migrado: true,
    }));
    setAgenda([...(agenda || []), ...migrados]);
    setNotasLegacy([]);
    toast.success(`${migrados.length} ${migrados.length === 1 ? "nota migrada" : "notas migradas"} pra Agenda Pessoal.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notasLegacy?.length]);

  const eventosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (agenda || [])
      .filter(e => filtroCat === "todas" || e.categoria === filtroCat)
      .filter(e => !q
        || (e.titulo || "").toLowerCase().includes(q)
        || (e.descricao || "").toLowerCase().includes(q)
        || (e.local || "").toLowerCase().includes(q));
  }, [agenda, filtroCat, busca]);

  // Separa em: pinned, futuros (próximos), passados
  const { pinned, futuros, passados } = useMemo(() => {
    const hojeISO = todayISO();
    const p = [];
    const f = [];
    const pas = [];
    eventosFiltrados.forEach(e => {
      if (e.pinned) p.push(e);
      else if (!e.data || e.data >= hojeISO) f.push(e);
      else pas.push(e);
    });
    p.sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999") || (a.horario || "").localeCompare(b.horario || ""));
    f.sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999") || (a.horario || "").localeCompare(b.horario || ""));
    pas.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    return { pinned: p, futuros: f, passados: pas };
  }, [eventosFiltrados]);

  const novoEvento = (preset = {}) => {
    setForm({
      id: null,
      titulo: "",
      descricao: "",
      data: todayISO(),
      horario: "",
      duracao: "",
      categoria: "compromisso",
      local: "",
      link: "",
      status: "agendado",
      pinned: false,
      ...preset,
    });
    setFormErrors({});
  };

  const editarEvento = (ev) => {
    setForm({
      ...ev,
      horario: ev.horario || "",
      duracao: ev.duracao != null ? String(ev.duracao) : "",
      local: ev.local || "",
      link: ev.link || "",
      descricao: ev.descricao || "",
    });
    setFormErrors({});
  };

  const togglePin = (ev) => {
    setAgenda(agenda.map(e => e.id === ev.id ? { ...e, pinned: !e.pinned, updatedAt: new Date().toISOString() } : e));
  };

  const toggleFeito = (ev) => {
    setAgenda(agenda.map(e => e.id === ev.id
      ? { ...e, status: e.status === "feito" ? "agendado" : "feito", updatedAt: new Date().toISOString() }
      : e));
  };

  const salvar = () => {
    const errs = {};
    if (!form.titulo?.trim()) errs.titulo = "Título é obrigatório";
    if (!form.data) errs.data = "Data é obrigatória";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Verifique os campos."); return; }

    const agora = new Date().toISOString();
    const data = {
      id: form.id || uid(),
      titulo: form.titulo.trim(),
      descricao: form.descricao || "",
      data: form.data,
      horario: form.horario || null,
      duracao: form.duracao ? parseInt(form.duracao, 10) : null,
      categoria: form.categoria || "compromisso",
      local: form.local || "",
      link: form.link || "",
      status: form.status || "agendado",
      pinned: !!form.pinned,
      createdAt: form.createdAt || agora,
      updatedAt: agora,
    };

    if (form.id && agenda.find(e => e.id === form.id)) {
      setAgenda(agenda.map(e => e.id === form.id ? data : e));
      toast.success("Evento atualizado.");
    } else {
      setAgenda([...agenda, data]);
      toast.success(`"${data.titulo}" agendado.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const excluir = async (ev) => {
    const ok = await confirm({
      title: `Excluir "${ev.titulo}"?`,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    const backup = agenda;
    setAgenda(agenda.filter(x => x.id !== ev.id));
    toast.success(`"${ev.titulo}" excluído.`, {
      action: { label: "Desfazer", onClick: () => setAgenda(backup) },
    });
  };

  const handleQuickAdd = () => {
    const t = quickAdd.trim();
    if (!t) return;
    novoEvento({ titulo: t });
    setQuickAdd("");
  };

  const contagemPorCat = useMemo(() => {
    const m = { todas: agenda.length };
    for (const c of CATEGORIAS) m[c.id] = 0;
    for (const e of agenda) m[e.categoria] = (m[e.categoria] || 0) + 1;
    return m;
  }, [agenda]);

  const stats = useMemo(() => {
    const total = agenda.length;
    const hoje = agenda.filter(e => e.data === todayISO() && e.status !== "feito").length;
    const proximos7 = agenda.filter(e => {
      const d = diasAteHoje(e.data);
      return d >= 0 && d <= 7 && e.status !== "feito";
    }).length;
    const atrasados = agenda.filter(e => {
      const d = diasAteHoje(e.data);
      return d < 0 && e.status !== "feito";
    }).length;
    return { total, hoje, proximos7, atrasados };
  }, [agenda]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Agenda Pessoal"
        title="Compromissos"
        sub="Lista detalhada dos seus eventos pessoais — também aparecem no Calendário."
        action={
          <button className="btn-gold" onClick={() => novoEvento()}>
            <Plus size={14} className="inline mr-2" />Novo
          </button>
        }
      />

      {/* Stats */}
      <div className="notas-stats" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16,
      }}>
        <StatBox label="Total" value={stats.total} cor={T.muted} />
        <StatBox label="Hoje" value={stats.hoje} cor={T.gold} destaque={stats.hoje > 0} />
        <StatBox label="Próx. 7d" value={stats.proximos7} cor={T.green} />
        <StatBox label="Atrasados" value={stats.atrasados} cor={T.red} destaque={stats.atrasados > 0} />
      </div>
      <style>{`
        @media (max-width: 480px) {
          .notas-stats { grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
        }
      `}</style>

      {/* Quick add */}
      <div className="agenda-quick">
        <StickyNote size={16} style={{ color: T.gold, flexShrink: 0 }} />
        <input
          value={quickAdd}
          onChange={e => setQuickAdd(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(); }}
          placeholder="Anotar rápido... (Enter abre o editor)"
        />
        {quickAdd && (
          <button onClick={handleQuickAdd}
            style={{
              background: T.gold, color: T.bg, border: "none",
              padding: "6px 14px", borderRadius: 4, fontSize: 11, fontWeight: 700,
              cursor: "pointer", letterSpacing: ".05em", textTransform: "uppercase",
            }}>
            Criar
          </button>
        )}
      </div>

      {/* Busca + filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 18 }}>
        <div style={{ position: "relative", flex: "1 1 240px", minWidth: 200 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: T.muted, pointerEvents: "none" }} />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por título, descrição ou local..."
            style={{
              width: "100%", padding: "9px 10px 9px 32px",
              background: T.card, border: `1px solid ${T.border}`,
              color: T.ink, fontSize: 13, borderRadius: 6,
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[{ id: "todas", label: "Todas", icon: FileText }, ...CATEGORIAS].map(c => {
            const ativo = filtroCat === c.id;
            const cor = c.id === "todas" ? T.gold : c.cor;
            const Icon = c.icon;
            return (
              <button key={c.id} onClick={() => setFiltroCat(c.id)}
                style={{
                  padding: "7px 13px",
                  background: ativo ? `${cor}22` : T.card,
                  border: `1px solid ${ativo ? cor : T.border}`,
                  color: ativo ? cor : T.muted,
                  fontSize: 11, fontWeight: 600, borderRadius: 100,
                  cursor: "pointer", letterSpacing: ".03em",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <Icon size={11} />
                {c.label}
                <span style={{
                  opacity: 0.7, fontSize: 10,
                  padding: "1px 6px", borderRadius: 100,
                  background: ativo ? `${cor}33` : T.bgSoft,
                }}>{contagemPorCat[c.id] || 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lista de eventos agrupada */}
      {pinned.length === 0 && futuros.length === 0 && passados.length === 0 ? (
        <EmptyState onCriar={() => novoEvento()} temEventos={agenda.length > 0} />
      ) : (
        <>
          {pinned.length > 0 && (
            <SectionList title="📌 Fixados" eventos={pinned}
                         onEdit={editarEvento} onPin={togglePin} onFeito={toggleFeito} onExcluir={excluir} />
          )}
          {futuros.length > 0 && (
            <SectionList title="Próximos" eventos={futuros}
                         onEdit={editarEvento} onPin={togglePin} onFeito={toggleFeito} onExcluir={excluir} />
          )}
          {passados.length > 0 && (
            <>
              <button
                onClick={() => setMostrarPassados(!mostrarPassados)}
                style={{
                  background: "transparent", border: "none", color: T.muted,
                  fontSize: 12, fontWeight: 600, letterSpacing: ".05em",
                  textTransform: "uppercase", cursor: "pointer",
                  margin: "20px 0 10px", padding: "8px 0",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <ChevronDown size={14} style={{ transform: mostrarPassados ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform .2s" }} />
                Passados ({passados.length})
              </button>
              {mostrarPassados && (
                <SectionList title="" eventos={passados}
                             onEdit={editarEvento} onPin={togglePin} onFeito={toggleFeito} onExcluir={excluir}
                             dimmed />
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      {form && (
        <Modal title={form.id ? "Editar evento" : "Novo evento"}
               onClose={() => { setForm(null); setFormErrors({}); }}>
          <Field label="Título" required error={formErrors.titulo}>
            <input value={form.titulo}
                   onChange={e => setForm({ ...form, titulo: e.target.value })}
                   placeholder="Ex.: Reunião com cliente, Voo São Paulo..."
                   autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" required error={formErrors.data}>
              <input type="date" value={form.data}
                     onChange={e => setForm({ ...form, data: e.target.value })} />
            </Field>
            <Field label="Horário (opcional)">
              <input type="time" value={form.horario}
                     onChange={e => setForm({ ...form, horario: e.target.value })} />
            </Field>
            <Field label="Categoria">
              <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                {CATEGORIAS.map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Duração (min, opcional)">
              <input type="number" min="0" value={form.duracao}
                     onChange={e => setForm({ ...form, duracao: e.target.value })}
                     placeholder="ex.: 60" />
            </Field>
          </div>
          <Field label="Local (opcional)">
            <input value={form.local}
                   onChange={e => setForm({ ...form, local: e.target.value })}
                   placeholder="Endereço, sala, link da call..." />
          </Field>
          <Field label="Link (opcional)">
            <input type="url" value={form.link}
                   onChange={e => setForm({ ...form, link: e.target.value })}
                   placeholder="https://..." />
          </Field>
          <Field label="Descrição">
            <textarea value={form.descricao}
                      onChange={e => setForm({ ...form, descricao: e.target.value })}
                      placeholder="Detalhes, agenda, anotações..."
                      rows={4}
                      style={{ resize: "vertical", fontFamily: "inherit" }} />
          </Field>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.muted, marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={!!form.pinned}
                   onChange={e => setForm({ ...form, pinned: e.target.checked })}
                   style={{ accentColor: T.gold, width: 14, height: 14 }} />
            <Pin size={12} style={{ color: T.gold }} />
            Fixar este compromisso no topo
          </label>
          <div className="flex gap-3 mt-2 flex-wrap">
            <button className="btn-gold" onClick={salvar}>Salvar</button>
            <button className="btn-ghost" onClick={() => { setForm(null); setFormErrors({}); }}>Cancelar</button>
            {form.id && (
              <button onClick={() => { excluir(form); setForm(null); }}
                style={{ marginLeft: "auto", background: "transparent", color: T.red, border: `1px solid ${T.red}`, padding: "10px 16px", fontSize: 11, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={12} /> Excluir
              </button>
            )}
          </div>
        </Modal>
      )}

      <style>{`
        .agenda-quick {
          background: ${T.bgSoft};
          border: 1px dashed ${T.border};
          padding: 12px 14px;
          border-radius: 10px;
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 16px;
          transition: border-color .15s ease, background .15s ease;
        }
        .agenda-quick:focus-within {
          border-color: ${T.gold};
          background: ${T.card};
        }
        .agenda-quick input {
          flex: 1; background: transparent; border: none; outline: none;
          color: ${T.ink}; font-size: 14px; font-family: inherit;
        }
        .agenda-quick input::placeholder { color: ${T.faint}; }
      `}</style>
    </div>
  );
}

/* ============ subcomponentes ============ */

function StatBox({ label, value, cor, destaque }) {
  return (
    <div style={{
      background: destaque ? `${cor}15` : T.card,
      border: `1px solid ${destaque ? `${cor}55` : T.border}`,
      borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: T.muted, letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: 20, fontWeight: 700, color: destaque ? cor : T.ink, marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}

function SectionList({ title, eventos, onEdit, onPin, onFeito, onExcluir, dimmed }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {title && (
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600, marginBottom: 8 }}>
          {title}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {eventos.map(ev => (
          <EventoCard key={ev.id} ev={ev}
                      onEdit={onEdit} onPin={onPin} onFeito={onFeito} onExcluir={onExcluir}
                      dimmed={dimmed} />
        ))}
      </div>
    </div>
  );
}

function EventoCard({ ev, onEdit, onPin, onFeito, onExcluir, dimmed }) {
  const meta = catMeta(ev.categoria);
  const Icon = meta.icon;
  const feito = ev.status === "feito";
  const dias = diasAteHoje(ev.data);
  const atrasado = !feito && dias < 0;

  return (
    <div style={{
      background: `${meta.cor}0d`,
      border: `1px solid ${meta.cor}33`,
      borderLeft: `4px solid ${meta.cor}`,
      borderRadius: 8,
      padding: "12px 14px",
      display: "grid",
      gridTemplateColumns: "auto 1fr auto",
      gap: 12,
      opacity: feito || dimmed ? 0.55 : 1,
      transition: "opacity .15s",
    }}>
      {/* Coluna 1 — data + ícone */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 56 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: atrasado ? T.red : T.ink, lineHeight: 1 }}>
          {formatarDataCurta(ev.data)?.split(" ")[0]}
        </div>
        <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".1em", textTransform: "uppercase", marginTop: 2 }}>
          {formatarDataCurta(ev.data)?.split(" ")[1] || ""}
        </div>
        <div style={{
          background: `${meta.cor}22`, color: meta.cor,
          width: 22, height: 22, borderRadius: "50%",
          display: "grid", placeItems: "center", marginTop: 6,
        }}>
          <Icon size={11} />
        </div>
      </div>

      {/* Coluna 2 — conteúdo */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {ev.pinned && <Pin size={11} style={{ color: T.gold }} />}
          <strong style={{
            fontSize: 14, color: T.ink,
            textDecoration: feito ? "line-through" : "none",
          }}>
            {ev.titulo}
          </strong>
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: ".08em",
            textTransform: "uppercase", color: meta.cor,
            padding: "1px 6px", borderRadius: 3, background: `${meta.cor}22`,
          }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 10.5, color: atrasado ? T.red : T.muted, fontStyle: "italic" }}>
            · {diasRelativos(ev.data)}
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 11, color: T.muted, marginTop: 4 }}>
          {ev.horario && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Clock size={10} />{ev.horario}{ev.duracao ? ` · ${ev.duracao}min` : ""}
            </span>
          )}
          {ev.local && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
              <MapPin size={10} />{ev.local}
            </span>
          )}
          {ev.link && (
            <a href={ev.link} target="_blank" rel="noopener noreferrer"
               style={{ color: T.gold, display: "inline-flex", alignItems: "center", gap: 3 }}>
              <Link2 size={10} />Link
            </a>
          )}
        </div>
        {ev.descricao && (
          <div style={{
            fontSize: 12, color: T.muted, marginTop: 6, lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {ev.descricao}
          </div>
        )}
      </div>

      {/* Coluna 3 — ações */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <IconBtn onClick={() => onFeito(ev)} title={feito ? "Desmarcar" : "Marcar feito"} cor={feito ? T.green : T.muted} bg={feito ? `${T.green}22` : "transparent"}>
          <Check size={13} />
        </IconBtn>
        <IconBtn onClick={() => onPin(ev)} title={ev.pinned ? "Desafixar" : "Fixar"} cor={ev.pinned ? T.gold : T.muted}>
          {ev.pinned ? <PinOff size={13} /> : <Pin size={13} />}
        </IconBtn>
        <IconBtn onClick={() => onEdit(ev)} title="Editar" cor={T.muted}>
          <Edit3 size={13} />
        </IconBtn>
        <IconBtn onClick={() => onExcluir(ev)} title="Excluir" cor={T.red}>
          <Trash2 size={13} />
        </IconBtn>
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title, cor, bg }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      style={{
        background: bg || "transparent",
        border: `1px solid ${T.border}`,
        color: cor,
        width: 26, height: 26, borderRadius: 5,
        cursor: "pointer", display: "grid", placeItems: "center",
        transition: "all .15s ease",
        minHeight: 26,
      }}>
      {children}
    </button>
  );
}

function EmptyState({ onCriar, temEventos }) {
  return (
    <div style={{
      textAlign: "center", padding: "64px 24px",
      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
    }}>
      <div style={{
        width: 60, height: 60, margin: "0 auto 16px",
        borderRadius: 14, background: `${T.gold}15`,
        display: "grid", placeItems: "center", color: T.gold,
      }}>
        <StickyNote size={28} />
      </div>
      <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
        {temEventos ? "Nada por aqui" : "Comece sua agenda"}
      </h3>
      <p style={{ color: T.muted, fontSize: 13, margin: "0 0 20px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
        {temEventos
          ? "Nenhum evento corresponde à busca ou ao filtro selecionado."
          : "Cadastre compromissos, viagens, lembretes ou eventos importantes. Tudo também aparece no Calendário."}
      </p>
      {!temEventos && (
        <button className="btn-gold" onClick={onCriar}>
          <Plus size={14} className="inline mr-2" />
          Criar primeiro evento
        </button>
      )}
    </div>
  );
}
