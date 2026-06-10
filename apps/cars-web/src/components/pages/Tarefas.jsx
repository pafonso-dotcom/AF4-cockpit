import React, { useMemo, useState } from "react";
import {
  Plus, Trash2, Edit3, Check, X, Calendar, Flag, Folder,
  ChevronDown, ChevronRight, CheckCircle2, Circle,
} from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";

const PRIORIDADES = [
  { id: "urgente", label: "Urgente", cor: "#dc2626" },
  { id: "alta",    label: "Alta",    cor: "#f87171" },
  { id: "media",   label: "Média",   cor: "#fbbf24" },
  { id: "baixa",   label: "Baixa",   cor: "#60a5fa" },
];

const prioMeta = (id) => PRIORIDADES.find(p => p.id === id) || PRIORIDADES[2];
const prioOrder = { urgente: 0, alta: 1, media: 2, baixa: 3 };

function diasAteHoje(iso) {
  if (!iso) return null;
  try {
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const alvo = new Date(iso + "T00:00:00");
    return Math.round((alvo - hoje) / 86400000);
  } catch { return null; }
}

function labelPrazo(iso) {
  const d = diasAteHoje(iso);
  if (d === null) return null;
  if (d < 0) return `${-d}d atrasada`;
  if (d === 0) return "hoje";
  if (d === 1) return "amanhã";
  if (d <= 7) return `em ${d}d`;
  try {
    const dt = new Date(iso + "T00:00:00");
    return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch { return iso; }
}

export default function Tarefas({ tarefas = [], setTarefas }) {
  const [aba, setAba] = useState("todas"); // todas | hoje | projetos
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [quickAdd, setQuickAdd] = useState("");
  const [quickPrio, setQuickPrio] = useState("media");

  const hojeISO = todayISO();

  const adicionarQuick = () => {
    const t = quickAdd.trim();
    if (!t) return;
    setTarefas([
      { id: uid(), titulo: t, prioridade: quickPrio, concluida: false,
        projeto: null, prazo: null, createdAt: new Date().toISOString() },
      ...tarefas,
    ]);
    setQuickAdd("");
  };

  const toggle = (t) => {
    setTarefas(tarefas.map(x => x.id === t.id ? { ...x, concluida: !x.concluida } : x));
  };

  const excluir = async (t) => {
    const ok = await confirm({
      title: "Excluir tarefa?",
      message: t.titulo,
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    setTarefas(tarefas.filter(x => x.id !== t.id));
    toast.success("Tarefa removida.");
  };

  const salvar = () => {
    const errs = {};
    if (!form.titulo?.trim()) errs.titulo = "Título é obrigatório";
    setFormErrors(errs);
    if (Object.keys(errs).length) return;
    const data = {
      ...form,
      titulo: form.titulo.trim(),
      projeto: form.projeto?.trim() || null,
      subcategoria: form.subcategoria?.trim() || null,
      prazo: form.prazo || null,
    };
    if (form.id && tarefas.find(x => x.id === form.id)) {
      setTarefas(tarefas.map(x => x.id === form.id ? data : x));
      toast.success("Tarefa atualizada.");
    } else {
      setTarefas([{ ...data, id: uid(), createdAt: new Date().toISOString() }, ...tarefas]);
      toast.success("Tarefa criada.");
    }
    setForm(null);
    setFormErrors({});
  };

  const filtradas = useMemo(() => {
    if (aba === "hoje") return tarefas.filter(t => t.prazo === hojeISO || (!t.prazo && !t.concluida));
    if (aba === "projetos") return tarefas.filter(t => !!t.projeto);
    return tarefas;
  }, [tarefas, aba, hojeISO]);

  const pendentes = filtradas.filter(t => !t.concluida).sort((a, b) => {
    const pd = prioOrder[a.prioridade] - prioOrder[b.prioridade];
    if (pd !== 0) return pd;
    return (a.prazo || "9999").localeCompare(b.prazo || "9999");
  });
  const concluidas = filtradas.filter(t => t.concluida);

  const grupos = useMemo(() => {
    if (aba === "projetos") {
      const byProj = new Map();
      pendentes.forEach(t => {
        const k = t.projeto || "Sem projeto";
        if (!byProj.has(k)) byProj.set(k, []);
        byProj.get(k).push(t);
      });
      return [...byProj.entries()].map(([k, ts]) => ({ titulo: k, icone: Folder, cor: T.gold, tarefas: ts }));
    }
    // Por prioridade
    return PRIORIDADES.map(p => ({
      titulo: `${p.label} prioridade`,
      icone: Flag,
      cor: p.cor,
      tarefas: pendentes.filter(t => t.prioridade === p.id),
    })).filter(g => g.tarefas.length > 0);
  }, [pendentes, aba]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="To-do"
        title="Tarefas"
        sub="O que precisa sair do papel hoje."
        action={
          <button className="btn-gold" onClick={() => setForm({
            id: null, titulo: "", prioridade: "media", projeto: "", prazo: "", concluida: false,
          })}>
            <Plus size={14} className="inline mr-2" />Nova Tarefa
          </button>
        }
      />

      {/* Quick add */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: 12, marginBottom: 12,
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input value={quickAdd}
                 onChange={e => setQuickAdd(e.target.value)}
                 onKeyDown={e => { if (e.key === "Enter") adicionarQuick(); }}
                 placeholder="O que precisa fazer?"
                 style={{ flex: "1 1 240px", minWidth: 180, fontSize: 14 }} />
          <select value={quickPrio} onChange={e => setQuickPrio(e.target.value)} style={{ width: 110 }}>
            {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <button className="btn-gold" onClick={adicionarQuick} disabled={!quickAdd.trim()}>
            <Plus size={14} className="inline mr-1" />Add
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {[
          { id: "todas", label: "Todas", count: tarefas.length },
          { id: "hoje", label: "Hoje", count: tarefas.filter(t => t.prazo === hojeISO || (!t.prazo && !t.concluida)).length },
          { id: "projetos", label: "Projetos", count: tarefas.filter(t => !!t.projeto).length },
        ].map(a => {
          const ativo = aba === a.id;
          return (
            <button key={a.id} onClick={() => setAba(a.id)}
                    style={{
                      padding: "8px 14px",
                      background: ativo ? `${T.gold}1a` : "transparent",
                      color: ativo ? T.gold : T.muted,
                      border: `1px solid ${ativo ? T.gold : T.border}`,
                      borderRadius: 999, cursor: "pointer",
                      fontSize: 12, fontWeight: 600,
                      display: "inline-flex", alignItems: "center", gap: 6,
                    }}>
              {a.label}
              <span style={{ opacity: .7, fontSize: 10.5 }}>{a.count}</span>
            </button>
          );
        })}
      </div>

      {filtradas.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {grupos.map((g, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <SectionLabel cor={g.cor}>{g.titulo} · {g.tarefas.length}</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {g.tarefas.map(t => (
                  <TarefaRow key={t.id} tarefa={t}
                             onToggle={toggle} onEdit={() => setForm({ ...t })} onExcluir={excluir} />
                ))}
              </div>
            </div>
          ))}

          {concluidas.length > 0 && (
            <ConcluidasSection
              tarefas={concluidas}
              onToggle={toggle} onEdit={(t) => setForm({ ...t })} onExcluir={excluir}
            />
          )}
        </>
      )}

      {form && (
        <Modal title={form.id ? "Editar Tarefa" : "Nova Tarefa"} onClose={() => setForm(null)}>
          <Field label="Título" required error={formErrors.titulo}>
            <input value={form.titulo}
                   onChange={e => setForm({ ...form, titulo: e.target.value })}
                   placeholder="Ex.: Responder e-mail do cliente"
                   autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridade">
              <select value={form.prioridade} onChange={e => setForm({ ...form, prioridade: e.target.value })}>
                {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </Field>
            <Field label="Prazo">
              <input type="date" value={form.prazo || ""}
                     onChange={e => setForm({ ...form, prazo: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Projeto / Categoria" hint="Agrupa tarefas relacionadas.">
              <input value={form.projeto || ""}
                     onChange={e => setForm({ ...form, projeto: e.target.value })}
                     placeholder="Ex.: Site novo, Casa" />
            </Field>
            <Field label="Subcategoria (opcional)" hint="Dentro do projeto/categoria.">
              <input value={form.subcategoria || ""}
                     onChange={e => setForm({ ...form, subcategoria: e.target.value })}
                     placeholder="Ex.: Frontend, Cozinha" />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={salvar}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function SectionLabel({ cor, children }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      fontSize: 11, color: cor || T.muted, letterSpacing: ".1em",
      textTransform: "uppercase", fontWeight: 700, marginBottom: 8,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cor || T.gold }} />
      {children}
    </div>
  );
}

function TarefaRow({ tarefa, onToggle, onEdit, onExcluir }) {
  const prio = prioMeta(tarefa.prioridade);
  const prazo = labelPrazo(tarefa.prazo);
  const atrasada = tarefa.prazo && diasAteHoje(tarefa.prazo) < 0 && !tarefa.concluida;

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${atrasada ? `${T.red}55` : T.border}`,
      borderLeft: `3px solid ${tarefa.concluida ? T.green : prio.cor}`,
      borderRadius: 10,
      padding: "12px 14px",
      display: "flex", alignItems: "center", gap: 12,
      opacity: tarefa.concluida ? 0.55 : 1,
      transition: "border-color .15s, opacity .15s",
    }}>
      <button onClick={() => onToggle(tarefa)} aria-label={tarefa.concluida ? "Desmarcar" : "Marcar como feito"}
              style={{
                background: "transparent", border: "none", color: tarefa.concluida ? T.green : T.muted,
                cursor: "pointer", padding: 0, minHeight: 26, flexShrink: 0,
              }}>
        {tarefa.concluida ? <CheckCircle2 size={22} /> : <Circle size={22} />}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: T.ink, lineHeight: 1.35,
          textDecoration: tarefa.concluida ? "line-through" : "none",
        }}>
          {tarefa.titulo}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
          {tarefa.projeto && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: T.muted }}>
              <Folder size={11} /> {tarefa.projeto}{tarefa.subcategoria ? ` › ${tarefa.subcategoria}` : ""}
            </span>
          )}
          {prazo && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10.5,
              color: atrasada ? T.red : T.muted,
              fontWeight: atrasada ? 600 : 400,
            }}>
              <Calendar size={11} /> {prazo}
            </span>
          )}
        </div>
      </div>

      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
        color: prio.cor, padding: "3px 8px", borderRadius: 4,
        background: `${prio.cor}1a`,
        flexShrink: 0,
      }}>
        {prio.label}
      </span>

      <button onClick={() => onEdit(tarefa)} title="Editar"
              style={{
                background: "transparent", border: "none", color: T.muted,
                cursor: "pointer", padding: 4, minHeight: 26, flexShrink: 0,
              }}>
        <Edit3 size={14} />
      </button>
      <button onClick={() => onExcluir(tarefa)} title="Excluir"
              style={{
                background: "transparent", border: "none", color: T.muted,
                cursor: "pointer", padding: 4, minHeight: 26, flexShrink: 0,
              }}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function ConcluidasSection({ tarefas, onToggle, onEdit, onExcluir }) {
  const [aberta, setAberta] = useState(false);
  return (
    <div style={{ marginTop: 18 }}>
      <button onClick={() => setAberta(!aberta)}
              style={{
                background: "transparent", border: "none", color: T.muted,
                cursor: "pointer", padding: 0, fontSize: 11, letterSpacing: ".1em",
                textTransform: "uppercase", fontWeight: 600,
                display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8,
              }}>
        {aberta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        Concluídas · {tarefas.length}
      </button>
      {aberta && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tarefas.map(t => (
            <TarefaRow key={t.id} tarefa={t}
                       onToggle={onToggle} onEdit={onEdit} onExcluir={onExcluir} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: "center", padding: "60px 24px",
      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
    }}>
      <Check size={36} style={{ color: T.gold, marginBottom: 12 }} />
      <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
        Tudo em dia
      </h3>
      <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
        Adicione uma tarefa pra começar.
      </p>
    </div>
  );
}
