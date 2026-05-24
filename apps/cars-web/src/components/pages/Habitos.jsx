import React, { useMemo, useState } from "react";
import { Plus, Trash2, Edit3, Flame, Check, X } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";

const ICONES_SUGERIDOS = ["💧","🏃","📖","🧘","😴","🍎","💊","🚭","☕","🧑‍💻","🎯","🏋️","🌱","🚶","🧴"];
const CORES_SUGERIDAS = ["#5b9bd5","#70ad47","#c9a96b","#e7a3a3","#d97757","#8b5cf6","#06b6d4","#f59e0b"];

function dataMenosDias(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function calcStreak(diasFeitos) {
  if (!diasFeitos) return 0;
  let count = 0;
  // Conta dias consecutivos a partir de hoje (ou ontem se hoje não tem)
  let d = 0;
  // Se hoje não tá marcado, começa a contar a partir de ontem
  if (!diasFeitos[dataMenosDias(0)]) d = 1;
  while (diasFeitos[dataMenosDias(d)]) {
    count++;
    d++;
    if (count > 999) break; // safety
  }
  return count;
}

export default function Habitos({ habitos = [], setHabitos }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const novoHabito = () => {
    setForm({
      id: null,
      nome: "",
      icone: ICONES_SUGERIDOS[0],
      cor: CORES_SUGERIDAS[0],
      meta: "",
      diasFeitos: {},
    });
    setFormErrors({});
  };

  const editar = (h) => {
    setForm({ ...h, meta: h.meta != null ? String(h.meta) : "" });
    setFormErrors({});
  };

  const salvar = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Verifique os campos."); return; }

    const agora = new Date().toISOString();
    const data = {
      id: form.id || uid(),
      nome: form.nome.trim(),
      icone: form.icone || "🎯",
      cor: form.cor || CORES_SUGERIDAS[0],
      meta: form.meta ? parseInt(form.meta, 10) : null,
      diasFeitos: form.diasFeitos || {},
      createdAt: form.createdAt || agora,
      updatedAt: agora,
    };

    if (form.id && habitos.find(h => h.id === form.id)) {
      setHabitos(habitos.map(h => h.id === form.id ? data : h));
      toast.success(`Hábito "${data.nome}" atualizado.`);
    } else {
      setHabitos([...habitos, data]);
      toast.success(`Hábito "${data.nome}" criado.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const excluir = async (h) => {
    const ok = await confirm({
      title: `Excluir "${h.nome}"?`,
      body: "Todo histórico será perdido.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    const backup = habitos;
    setHabitos(habitos.filter(x => x.id !== h.id));
    toast.success(`"${h.nome}" excluído.`, {
      action: { label: "Desfazer", onClick: () => setHabitos(backup) },
    });
  };

  const toggleDia = (h, dataISO) => {
    const novosDias = { ...(h.diasFeitos || {}) };
    if (novosDias[dataISO]) delete novosDias[dataISO];
    else novosDias[dataISO] = true;
    setHabitos(habitos.map(x => x.id === h.id
      ? { ...x, diasFeitos: novosDias, updatedAt: new Date().toISOString() }
      : x));
  };

  // Últimos 7 dias (do mais antigo pro mais novo)
  const ultimos7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => dataMenosDias(6 - i));
  }, []);

  const labelDia = (iso) => {
    const d = new Date(iso + "T00:00:00");
    const dias = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
    return { dia: dias[d.getDay()], data: d.getDate() };
  };

  const ehHoje = (iso) => iso === todayISO();

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Hábitos"
        title="Rotina"
        sub="O que você faz todo dia molda quem você é."
        action={
          <button className="btn-gold" onClick={novoHabito}>
            <Plus size={14} className="inline mr-2" />Novo
          </button>
        }
      />

      {habitos.length === 0 ? (
        <EmptyState onCriar={novoHabito} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {habitos.map(h => {
            const streak = calcStreak(h.diasFeitos);
            const feitoHoje = h.diasFeitos?.[todayISO()];
            return (
              <div key={h.id} style={{
                background: `${h.cor}0d`,
                border: `1px solid ${h.cor}33`,
                borderLeft: `4px solid ${h.cor}`,
                borderRadius: 8,
                padding: "12px 14px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{
                    fontSize: 22, width: 38, height: 38,
                    background: `${h.cor}22`, borderRadius: "50%",
                    display: "grid", placeItems: "center", flexShrink: 0,
                  }}>
                    {h.icone}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{h.nome}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T.muted, marginTop: 2, flexWrap: "wrap" }}>
                      {streak > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: streak >= 7 ? T.red : T.gold }}>
                          <Flame size={11} />
                          <strong>{streak}</strong>{streak === 1 ? " dia" : " dias seguidos"}
                        </span>
                      )}
                      {h.meta && <span>Meta: {h.meta}/dia</span>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <IconBtn onClick={() => editar(h)} title="Editar"><Edit3 size={13} /></IconBtn>
                    <IconBtn onClick={() => excluir(h)} title="Excluir" cor={T.red}><Trash2 size={13} /></IconBtn>
                  </div>
                </div>

                {/* Grid dos últimos 7 dias */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                  {ultimos7.map(iso => {
                    const lbl = labelDia(iso);
                    const feito = !!h.diasFeitos?.[iso];
                    const hoje = ehHoje(iso);
                    return (
                      <button key={iso} onClick={() => toggleDia(h, iso)}
                        style={{
                          background: feito ? h.cor : T.bgSoft,
                          color: feito ? "#fff" : T.muted,
                          border: hoje ? `2px solid ${h.cor}` : `1px solid ${T.border}`,
                          borderRadius: 6,
                          padding: "8px 4px",
                          cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                          minHeight: 50,
                        }}>
                        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", opacity: 0.8 }}>
                          {lbl.dia}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>
                          {feito ? <Check size={14} /> : lbl.data}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar hábito" : "Novo hábito"}
               onClose={() => { setForm(null); setFormErrors({}); }}>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome}
                   onChange={e => setForm({ ...form, nome: e.target.value })}
                   placeholder="Ex.: Beber água, Caminhar, Ler..."
                   autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ícone">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ICONES_SUGERIDOS.map(i => (
                  <button key={i} onClick={() => setForm({ ...form, icone: i })}
                    style={{
                      fontSize: 18, width: 36, height: 36,
                      background: form.icone === i ? `${form.cor}33` : T.bgSoft,
                      border: `1px solid ${form.icone === i ? form.cor : T.border}`,
                      borderRadius: 6, cursor: "pointer",
                    }}>
                    {i}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Cor">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CORES_SUGERIDAS.map(c => (
                  <button key={c} onClick={() => setForm({ ...form, cor: c })}
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: c,
                      border: form.cor === c ? `3px solid ${T.ink}` : `1px solid ${T.border}`,
                      cursor: "pointer",
                    }} />
                ))}
              </div>
            </Field>
          </div>
          <Field label="Meta diária (opcional, ex.: 8 copos)">
            <input type="number" min="1" value={form.meta}
                   onChange={e => setForm({ ...form, meta: e.target.value })}
                   placeholder="Ex.: 8" />
          </Field>
          <div className="flex gap-3 mt-2 flex-wrap">
            <button className="btn-gold" onClick={salvar}>Salvar</button>
            <button className="btn-ghost" onClick={() => { setForm(null); setFormErrors({}); }}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, cor }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      style={{
        background: "transparent",
        border: `1px solid ${T.border}`,
        color: cor || T.muted,
        width: 28, height: 28, borderRadius: 5,
        cursor: "pointer", display: "grid", placeItems: "center",
        minHeight: 28,
      }}>
      {children}
    </button>
  );
}

function EmptyState({ onCriar }) {
  return (
    <div style={{
      textAlign: "center", padding: "60px 24px",
      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
    }}>
      <Flame size={36} style={{ color: T.gold, marginBottom: 12 }} />
      <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
        Construa sua rotina
      </h3>
      <p style={{ color: T.muted, fontSize: 13, margin: "0 0 20px", maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
        Crie hábitos pequenos (beber água, caminhar, ler 10 min) e acompanhe seu streak.
      </p>
      <button className="btn-gold" onClick={onCriar}>
        <Plus size={14} className="inline mr-2" />Criar primeiro hábito
      </button>
    </div>
  );
}
