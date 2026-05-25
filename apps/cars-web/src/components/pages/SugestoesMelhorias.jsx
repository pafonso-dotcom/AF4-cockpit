import React, { useMemo, useState } from "react";
import { Plus, Trash2, Lightbulb, Edit3, Check, X } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";

/**
 * Sugestões de melhorias do app.
 * Cada sugestão: { id, titulo, descricao, prioridade, status, createdAt }
 *   prioridade: "alta" | "media" | "baixa"
 *   status: "nova" | "em-analise" | "implementada" | "descartada"
 */

const STATUSES = [
  { id: "nova",          label: "Nova",         cor: "muted" },
  { id: "em-analise",    label: "Em análise",   cor: "gold" },
  { id: "implementada",  label: "Implementada", cor: "green" },
  { id: "descartada",    label: "Descartada",   cor: "red" },
];
const PRIORIDADES = [
  { id: "alta",  label: "Alta",  cor: "red" },
  { id: "media", label: "Média", cor: "gold" },
  { id: "baixa", label: "Baixa", cor: "muted" },
];

const corDeStatus = (id) => {
  const s = STATUSES.find(x => x.id === id);
  return s?.cor || "muted";
};
const corDePrioridade = (id) => {
  const p = PRIORIDADES.find(x => x.id === id);
  return p?.cor || "muted";
};

export default function SugestoesMelhorias({ sugestoes = [], setSugestoes }) {
  const [form, setForm] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("todas");

  const filtradas = useMemo(() => {
    const lista = filtroStatus === "todas"
      ? sugestoes
      : sugestoes.filter(s => s.status === filtroStatus);
    return [...lista].sort((a, b) => {
      // implementadas e descartadas pro final
      const ativaA = a.status === "nova" || a.status === "em-analise";
      const ativaB = b.status === "nova" || b.status === "em-analise";
      if (ativaA !== ativaB) return ativaA ? -1 : 1;
      // depois por prioridade (alta > media > baixa)
      const ordemP = { alta: 0, media: 1, baixa: 2 };
      const pa = ordemP[a.prioridade] ?? 1;
      const pb = ordemP[b.prioridade] ?? 1;
      if (pa !== pb) return pa - pb;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [sugestoes, filtroStatus]);

  const contagem = useMemo(() => {
    const m = { todas: sugestoes.length };
    STATUSES.forEach(s => { m[s.id] = sugestoes.filter(x => x.status === s.id).length; });
    return m;
  }, [sugestoes]);

  const abrirNovo = () => {
    setForm({
      id: null,
      titulo: "",
      descricao: "",
      prioridade: "media",
      status: "nova",
    });
  };

  const abrirEditar = (s) => {
    setForm({ ...s });
  };

  const salvar = () => {
    const titulo = (form.titulo || "").trim();
    if (!titulo) { toast.error("Informe um título."); return; }
    const dados = {
      ...form,
      titulo,
      descricao: (form.descricao || "").trim(),
    };
    if (form.id) {
      setSugestoes(sugestoes.map(s => s.id === form.id ? dados : s));
      toast.success("Sugestão atualizada.");
    } else {
      setSugestoes([{ ...dados, id: uid(), createdAt: new Date().toISOString() }, ...sugestoes]);
      toast.success("Sugestão registrada.");
    }
    setForm(null);
  };

  const excluir = async (s) => {
    const ok = await confirm({
      title: "Excluir sugestão?",
      body: s.titulo,
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setSugestoes(sugestoes.filter(x => x.id !== s.id));
    toast.success("Sugestão removida.");
  };

  const mudarStatus = (s, status) => {
    setSugestoes(sugestoes.map(x => x.id === s.id ? { ...x, status } : x));
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Agenda · Sugestões"
        title="Melhorias do projeto"
        sub="Anote ideias de melhoria conforme aparecem. Marque o status pra acompanhar o que já foi pensado, implementado ou descartado."
        action={
          <button onClick={abrirNovo} className="btn-gold">
            <Plus size={14} className="inline mr-1.5" /> Nova sugestão
          </button>
        }
      />

      {/* Filtros por status */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FiltroChip ativo={filtroStatus === "todas"} onClick={() => setFiltroStatus("todas")}
                    label="Todas" count={contagem.todas} />
        {STATUSES.map(s => (
          <FiltroChip key={s.id} ativo={filtroStatus === s.id} onClick={() => setFiltroStatus(s.id)}
                      label={s.label} count={contagem[s.id]} cor={s.cor} />
        ))}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
        }}>
          <Lightbulb size={28} style={{ color: T.muted, marginBottom: 10 }} />
          <div>
            {sugestoes.length === 0
              ? "Nenhuma sugestão ainda. Clique em \"Nova sugestão\" pra começar."
              : "Nada com esse filtro."}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {filtradas.map(s => (
            <Card key={s.id} sugestao={s}
                  onEditar={() => abrirEditar(s)}
                  onExcluir={() => excluir(s)}
                  onMudarStatus={(st) => mudarStatus(s, st)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {form && (
        <FormModal form={form} setForm={setForm} onSalvar={salvar} onCancelar={() => setForm(null)} />
      )}
    </div>
  );
}

function FiltroChip({ ativo, onClick, label, count, cor = "muted" }) {
  const corHex = T[cor] || T.muted;
  return (
    <button onClick={onClick} style={{
      padding: "8px 14px", borderRadius: 6, cursor: "pointer",
      background: ativo ? `${corHex}22` : "transparent",
      border: `1px solid ${ativo ? corHex : T.border}`,
      color: ativo ? corHex : T.muted,
      fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase",
      fontWeight: ativo ? 600 : 500,
      display: "inline-flex", alignItems: "center", gap: 7,
    }}>
      {label}
      <span style={{
        fontSize: 9.5, padding: "1px 6px", borderRadius: 100,
        background: ativo ? corHex : T.border, color: ativo ? T.bg : T.muted, fontWeight: 700,
      }}>{count || 0}</span>
    </button>
  );
}

function Card({ sugestao, onEditar, onExcluir, onMudarStatus }) {
  const corP = T[corDePrioridade(sugestao.prioridade)] || T.muted;
  const corS = T[corDeStatus(sugestao.status)] || T.muted;
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${corP}`,
      borderRadius: 8, padding: 16,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 9, padding: "2px 7px", borderRadius: 4,
              background: `${corP}22`, color: corP,
              letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
            }}>
              {sugestao.prioridade || "media"}
            </span>
            <span style={{
              fontSize: 9, padding: "2px 7px", borderRadius: 4,
              background: `${corS}22`, color: corS,
              letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 700,
            }}>
              {STATUSES.find(x => x.id === sugestao.status)?.label || sugestao.status}
            </span>
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.3 }}>
            {sugestao.titulo}
          </div>
          {sugestao.descricao && (
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {sugestao.descricao}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={onEditar} title="Editar"
                  style={{
                    background: "transparent", border: `1px solid ${T.border}`,
                    color: T.muted, padding: 8, borderRadius: 4, cursor: "pointer",
                    minWidth: 36, minHeight: 36, display: "grid", placeItems: "center",
                  }}>
            <Edit3 size={14} />
          </button>
          <button onClick={onExcluir} title="Excluir"
                  style={{
                    background: "transparent", border: `1px solid ${T.border}`,
                    color: T.red, padding: 8, borderRadius: 4, cursor: "pointer",
                    minWidth: 36, minHeight: 36, display: "grid", placeItems: "center",
                  }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Quick status switch */}
      <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {STATUSES.map(st => {
          const ativo = sugestao.status === st.id;
          const cor = T[st.cor] || T.muted;
          return (
            <button key={st.id} onClick={() => onMudarStatus(st.id)}
                    disabled={ativo}
                    style={{
                      padding: "4px 10px", borderRadius: 4,
                      background: ativo ? `${cor}22` : "transparent",
                      border: `1px solid ${ativo ? cor : T.border}`,
                      color: ativo ? cor : T.faint,
                      fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
                      fontWeight: 600, cursor: ativo ? "default" : "pointer",
                      opacity: ativo ? 1 : 0.7,
                    }}>
              {ativo && "● "}{st.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormModal({ form, setForm, onSalvar, onCancelar }) {
  return (
    <div onClick={onCancelar}
         style={{
           position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
           zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
           padding: 16,
         }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.card, border: `1px solid ${T.borderHi}`, maxWidth: 520, width: "100%",
        maxHeight: "92vh", overflowY: "auto", padding: 24, position: "relative",
        borderRadius: 12, boxShadow: "0 24px 60px rgba(0,0,0,.6)",
      }}>
        <button onClick={onCancelar}
                style={{
                  position: "absolute", top: 12, right: 12,
                  color: T.muted, background: "transparent", border: "none", cursor: "pointer",
                  padding: 6, minWidth: 44, minHeight: 44, display: "grid", placeItems: "center",
                }}>
          <X size={20} />
        </button>
        <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginBottom: 16 }}>
          {form.id ? "Editar sugestão" : "Nova sugestão"}
        </h3>

        <label style={labelStyle}>Título</label>
        <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })}
               placeholder="Ex.: Adicionar filtro por categoria nas transações"
               autoFocus style={inputStyle} />

        <label style={{ ...labelStyle, marginTop: 14 }}>Descrição (opcional)</label>
        <textarea value={form.descricao}
                  onChange={e => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Mais detalhes — contexto, impacto, exemplo de uso..."
                  rows={4}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div>
            <label style={labelStyle}>Prioridade</label>
            <select value={form.prioridade}
                    onChange={e => setForm({ ...form, prioridade: e.target.value })}
                    style={inputStyle}>
              {PRIORIDADES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status}
                    onChange={e => setForm({ ...form, status: e.target.value })}
                    style={inputStyle}>
              {STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button className="btn-ghost" onClick={onCancelar}>Cancelar</button>
          <button className="btn-gold" onClick={onSalvar}>
            <Check size={14} className="inline mr-1" />
            {form.id ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: "block", fontSize: 10, letterSpacing: ".15em",
  textTransform: "uppercase", color: "var(--td)", marginBottom: 6, fontWeight: 500,
};
const inputStyle = {
  width: "100%", padding: "10px 12px",
  background: "var(--be)", color: "var(--tx)",
  border: "1px solid var(--bd)", borderRadius: 8,
  fontSize: 14, fontFamily: "inherit", outline: "none",
};
