import React, { useState, useMemo } from "react";
import { Plus, Trash2, Phone, MapPin, Calendar } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Modal from "../../ui/Modal.jsx";
import Field from "../../ui/Field.jsx";

const ESTAGIOS = [
  { id: "novo",       label: "Novo",            cor: "#60a5fa" },
  { id: "atendimento",label: "Atendimento",     cor: "#a78bfa" },
  { id: "negociacao", label: "Negociação",      cor: "#fbbf24" },
  { id: "aprov",      label: "Aprov. Financ.",  cor: "#c9a961" },
  { id: "fechado",    label: "Fechado",         cor: "#4ade80" },
];

export default function Funil({ leads = [], setLeads, veiculos = [] }) {
  const [form, setForm] = useState(null);
  const [dragId, setDragId] = useState(null);

  const grupos = useMemo(() => {
    const g = {};
    ESTAGIOS.forEach(e => { g[e.id] = []; });
    leads.forEach(l => {
      const id = ESTAGIOS.find(e => e.id === l.estagio) ? l.estagio : "novo";
      g[id].push(l);
    });
    return g;
  }, [leads]);

  const totaisCol = useMemo(() => {
    const t = {};
    ESTAGIOS.forEach(e => {
      t[e.id] = grupos[e.id].reduce((s, l) => s + (parseFloat(l.valorEstimado) || 0), 0);
    });
    return t;
  }, [grupos]);

  const pipelineTotal = useMemo(
    () => leads.reduce((s, l) => s + (parseFloat(l.valorEstimado) || 0), 0),
    [leads]
  );

  const moveTo = (leadId, estagioId) => {
    setLeads(leads.map(l => l.id === leadId ? { ...l, estagio: estagioId } : l));
    setDragId(null);
  };

  const save = () => {
    if (!form.nome?.trim()) { toast.error("Nome do lead é obrigatório."); return; }
    if (form.id) {
      setLeads(leads.map(l => l.id === form.id ? form : l));
    } else {
      setLeads([{ ...form, id: uid() }, ...leads]);
    }
    setForm(null);
  };

  const del = (id) => {
    if (!confirm("Excluir este lead?")) return;
    setLeads(leads.filter(l => l.id !== id));
  };

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Loja AF4 · CRM"
        title={<>Funil de <em>vendas.</em></>}
        sub="Kanban com 5 estágios · arraste cards entre colunas · valor estimado por etapa."
        action={
          <div className="flex gap-2 flex-wrap items-center">
            <div style={{ fontSize: 11, color: T.muted }}>
              🎯 {leads.length} leads · pipeline: <strong style={{ color: T.gold }}>{fmt(pipelineTotal)}</strong>
            </div>
            <button className="btn-gold" onClick={() => setForm({
              id: null, nome: "", telefone: "", cidade: "", origem: "WhatsApp",
              valorEstimado: "", veiculoInteresse: "", estagio: "novo",
              proximoContato: "", obs: "", criadoEm: todayISO(),
            })}>
              <Plus size={14} className="inline mr-1.5" /> Novo Lead
            </button>
          </div>
        }
      />

      <div style={{
        display: "flex", gap: 12, overflowX: "auto", paddingBottom: 12,
      }}>
        {ESTAGIOS.map(est => (
          <div key={est.id} style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: 8 }}
               onDragOver={e => e.preventDefault()}
               onDrop={() => dragId && moveTo(dragId, est.id)}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: est.cor }}></div>
              <div style={{ fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 500 }}>{est.label}</div>
              <div style={{ marginLeft: "auto", fontSize: 10, color: T.faint }}>{grupos[est.id].length}</div>
            </div>
            <div style={{ fontSize: 9, color: T.faint, padding: "0 8px 6px", fontStyle: "italic" }}>
              ≈ {fmt(totaisCol[est.id])} estimado
            </div>

            {grupos[est.id].length === 0 && (
              <div style={{ padding: 18, textAlign: "center", color: T.faint, fontSize: 11, fontStyle: "italic", border: `1px dashed ${T.border}`, borderRadius: 9 }}>
                Arraste um card aqui
              </div>
            )}

            {grupos[est.id].map(l => (
              <div key={l.id}
                   draggable
                   onDragStart={() => setDragId(l.id)}
                   onClick={() => setForm(l)}
                   style={{
                     background: T.card, border: `1px solid ${T.border}`,
                     borderLeft: `3px solid ${est.cor}`,
                     borderRadius: 9, padding: 12,
                     cursor: "grab", transition: "all .15s",
                     opacity: dragId === l.id ? 0.5 : 1,
                   }}
                   onMouseEnter={e => e.currentTarget.style.borderColor = T.gold}
                   onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.borderLeftColor = est.cor; }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.ink }}>{l.nome}</div>
                {l.telefone && (
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                    <Phone size={9} /> {l.telefone}
                  </div>
                )}
                <div style={{ fontSize: 10, color: T.faint, marginTop: 5, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {l.cidade && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={9} /> {l.cidade}</span>}
                  {l.proximoContato && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Calendar size={9} /> {l.proximoContato}</span>}
                </div>
                {l.origem && (
                  <span style={{ display: "inline-block", fontSize: 9, padding: "2px 7px", background: T.bgSoft, borderRadius: 4, marginTop: 7, color: T.muted, letterSpacing: ".05em", textTransform: "uppercase" }}>
                    {l.origem}
                  </span>
                )}
                {l.valorEstimado && (
                  <div style={{ fontSize: 11, color: T.gold, fontWeight: 500, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
                    {fmt(parseFloat(l.valorEstimado) || 0)}
                  </div>
                )}
                {l.veiculoInteresse && (
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 2, fontStyle: "italic" }}>
                    🚗 {l.veiculoInteresse}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {form && (
        <Modal title={form.id ? "Editar Lead" : "Novo Lead"} onClose={() => setForm(null)}>
          <Field label="Nome do cliente" required>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: João Silva" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} placeholder="(15) 99999-9999" />
            </Field>
            <Field label="Cidade">
              <input value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} placeholder="Tatuí-SP" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estágio">
              <select value={form.estagio} onChange={e => setForm({ ...form, estagio: e.target.value })}>
                {ESTAGIOS.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
              </select>
            </Field>
            <Field label="Origem">
              <select value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })}>
                <option>WhatsApp</option>
                <option>Instagram</option>
                <option>Webmotors</option>
                <option>OLX</option>
                <option>Indicação</option>
                <option>Loja física</option>
                <option>Outros</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor estimado (R$)">
              <input type="number" step="0.01" value={form.valorEstimado} onChange={e => setForm({ ...form, valorEstimado: e.target.value })} placeholder="65000" />
            </Field>
            <Field label="Próximo contato">
              <input type="date" value={form.proximoContato} onChange={e => setForm({ ...form, proximoContato: e.target.value })} />
            </Field>
          </div>
          <Field label="Veículo de interesse">
            <input value={form.veiculoInteresse} onChange={e => setForm({ ...form, veiculoInteresse: e.target.value })} placeholder="Ex.: Hyundai Creta 2022" />
          </Field>
          <Field label="Observações">
            <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} rows={3} placeholder="Histórico de conversa, preferências…" />
          </Field>
          <div className="flex gap-2 justify-between mt-4">
            {form.id ? (
              <button className="btn-ghost" onClick={() => { del(form.id); setForm(null); }} style={{ color: T.red, borderColor: T.red }}>
                <Trash2 size={12} className="inline mr-1" /> Excluir
              </button>
            ) : <div />}
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn-gold" onClick={save}>Salvar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
