import React, { useMemo, useState, useEffect } from "react";
import { Bell, Plus, Check, Edit3, Trash2, Repeat } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

function dataAmanha() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function dataFimSemana() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function gerarProximaOcorrencia(lembrete) {
  const { recorrencia, data, horario } = lembrete;
  if (!recorrencia) return null;
  const base = new Date(data + "T" + horario);
  if (recorrencia.tipo === "diario") {
    base.setDate(base.getDate() + 1);
  } else if (recorrencia.tipo === "semanal") {
    base.setDate(base.getDate() + 7);
  } else if (recorrencia.tipo === "mensal") {
    base.setMonth(base.getMonth() + 1);
  }
  return { ...lembrete, id: uid(), concluido: false, createdAt: new Date().toISOString(), data: base.toISOString().slice(0, 10) };
}

function agendarNotificacoes(lembretes) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const hoje = todayISO();
  lembretes
    .filter(l => !l.concluido && l.data === hoje && l.horario)
    .forEach(l => {
      const [h, m] = l.horario.split(":").map(Number);
      const agora = new Date();
      const alvo = new Date();
      alvo.setHours(h, m, 0, 0);
      const diff = alvo - agora;
      if (diff > 0) {
        setTimeout(() => {
          new Notification("Lembrete", { body: l.titulo, icon: "/favicon.ico" });
        }, diff);
      }
    });
}

export default function Lembretes({ lembretes = [], setLembretes }) {
  const [editando, setEditando] = useState(null);
  const hoje = todayISO();
  const amanha = dataAmanha();
  const fimSemana = dataFimSemana();

  useEffect(() => {
    agendarNotificacoes(lembretes);
  }, [lembretes]);

  const grupos = useMemo(() => {
    const ativos = lembretes.filter(l => !l.concluido).sort((a, b) =>
      (a.data || "9999").localeCompare(b.data || "9999") || (a.horario || "").localeCompare(b.horario || "")
    );
    return {
      hoje:    ativos.filter(l => l.data === hoje),
      amanha:  ativos.filter(l => l.data === amanha),
      semana:  ativos.filter(l => l.data > amanha && l.data <= fimSemana),
      depois:  ativos.filter(l => !l.data || l.data > fimSemana),
      concluidos: lembretes.filter(l => l.concluido).slice(-10),
    };
  }, [lembretes, hoje, amanha, fimSemana]);

  const concluir = (id) => {
    const lembrete = lembretes.find(l => l.id === id);
    if (!lembrete) return;
    let novo = lembretes.map(l => l.id === id ? { ...l, concluido: true } : l);
    if (lembrete.recorrencia) {
      const proxima = gerarProximaOcorrencia(lembrete);
      if (proxima) novo = [...novo, proxima];
    }
    setLembretes(novo);
    toast.success("Lembrete concluído.");
  };

  const excluir = async (id) => {
    const l = lembretes.find(x => x.id === id);
    const ok = await confirm({ title: `Excluir "${l?.titulo}"?`, confirmLabel: "Excluir", danger: true });
    if (!ok) return;
    setLembretes(lembretes.filter(x => x.id !== id));
    toast.success("Removido.");
  };

  const salvar = async (data) => {
    if (data.id) {
      setLembretes(lembretes.map(l => l.id === data.id ? { ...l, ...data } : l));
    } else {
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      setLembretes([...lembretes, { ...data, id: uid(), concluido: false, createdAt: new Date().toISOString() }]);
    }
    setEditando(null);
    toast.success("Salvo.");
  };

  const novoLembrete = () => setEditando({ id: null, titulo: "", data: hoje, horario: "09:00", recorrencia: null });

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Agenda"
        title="Lembretes"
        sub="Lembretes com notificação no horário certo."
        action={
          <button className="btn-gold" onClick={novoLembrete}>
            <Plus size={13} className="inline mr-1.5" /> Novo lembrete
          </button>
        }
      />

      {lembretes.filter(l => !l.concluido).length === 0 && (
        <div style={{ textAlign: "center", padding: "60px 24px", background: T.card, border: `1px dashed ${T.border}`, borderRadius: 18 }}>
          <Bell size={36} style={{ color: T.gold, marginBottom: 12 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
            Sem lembretes
          </h3>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
            Clique em "Novo lembrete" para adicionar.
          </p>
        </div>
      )}

      {[
        { key: "hoje",   label: "Hoje" },
        { key: "amanha", label: "Amanhã" },
        { key: "semana", label: "Esta semana" },
        { key: "depois", label: "Depois" },
      ].map(({ key, label }) => grupos[key].length > 0 && (
        <div key={key} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 8 }}>
            {label}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {grupos[key].map(l => (
              <LembreteCard key={l.id} lembrete={l} onConcluir={concluir} onEditar={setEditando} onExcluir={excluir} />
            ))}
          </div>
        </div>
      ))}

      {editando && (
        <LembreteModal lembrete={editando} onSalvar={salvar} onClose={() => setEditando(null)} />
      )}
    </div>
  );
}

function LembreteCard({ lembrete: l, onConcluir, onEditar, onExcluir }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${T.gold}`, borderRadius: 14,
      padding: "10px 14px",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <button onClick={() => onConcluir(l.id)}
        style={{ width: 24, height: 24, borderRadius: "50%", border: `2px solid ${T.gold}`, background: "transparent", cursor: "pointer", flexShrink: 0, display: "grid", placeItems: "center" }}>
        <Check size={13} style={{ color: T.gold }} />
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{l.titulo}</span>
          {l.recorrencia && <Repeat size={11} style={{ color: T.muted, flexShrink: 0 }} title="Recorrente" />}
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
          {l.horario}
          {l.recorrencia && (
            <span style={{ marginLeft: 8, color: T.gold, fontWeight: 600 }}>
              {l.recorrencia.tipo === "diario" ? "· todo dia" : l.recorrencia.tipo === "semanal" ? "· semanal" : "· mensal"}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button onClick={() => onEditar(l)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
          <Edit3 size={13} />
        </button>
        <button onClick={() => onExcluir(l.id)} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

function LembreteModal({ lembrete, onSalvar, onClose }) {
  const [form, setForm] = useState({
    id:          lembrete.id,
    titulo:      lembrete.titulo || "",
    descricao:   lembrete.descricao || "",
    data:        lembrete.data || todayISO(),
    horario:     lembrete.horario || "09:00",
    recorrencia: lembrete.recorrencia || null,
  });
  const [recAtivo, setRecAtivo] = useState(!!lembrete.recorrencia);
  const [errors, setErrors] = useState({});

  const submit = () => {
    if (!form.titulo.trim()) { setErrors({ titulo: "Obrigatório" }); return; }
    onSalvar({ ...form, titulo: form.titulo.trim(), recorrencia: recAtivo ? (form.recorrencia || { tipo: "diario" }) : null });
  };

  return (
    <Modal title={form.id ? "Editar lembrete" : "Novo lembrete"} onClose={onClose}>
      <Field label="Título" required error={errors.titulo}>
        <input value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} autoFocus placeholder="Ex.: Pagar fatura" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data">
          <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
        </Field>
        <Field label="Horário">
          <input type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} />
        </Field>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "8px 0" }}>
        <input type="checkbox" id="rec-toggle" checked={recAtivo} onChange={e => setRecAtivo(e.target.checked)} />
        <label htmlFor="rec-toggle" style={{ fontSize: 13, color: T.ink, cursor: "pointer" }}>Recorrência</label>
      </div>
      {recAtivo && (
        <Field label="Repetir">
          <select value={form.recorrencia?.tipo || "diario"}
            onChange={e => setForm({ ...form, recorrencia: { ...form.recorrencia, tipo: e.target.value } })}>
            <option value="diario">Todo dia</option>
            <option value="semanal">Toda semana (mesmo dia)</option>
            <option value="mensal">Todo mês (mesmo dia)</option>
          </select>
        </Field>
      )}
      <div className="flex gap-3 justify-end mt-6">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button className="btn-gold" onClick={submit}>Salvar</button>
      </div>
    </Modal>
  );
}
