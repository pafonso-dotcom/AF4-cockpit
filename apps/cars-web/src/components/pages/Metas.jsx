import React, { useState } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";

export default function Metas({ metas, setMetas, hidden }) {
  const [form, setForm] = useState(null);

  const calc = (m) => {
    // tempo necessário com juros compostos para atingir alvo
    const r = m.taxa / 100;
    const PV = m.atual;
    const PMT = m.aporte;
    const FV = m.alvo;
    if (PMT <= 0 && PV >= FV) return { mesesNecessarios: 0, projetado: PV };
    let saldo = PV;
    let n = 0;
    while (saldo < FV && n < 1200) {
      saldo = saldo * (1 + r) + PMT;
      n++;
    }
    // projetado no prazo
    let proj = PV;
    for (let i = 0; i < m.prazo; i++) proj = proj * (1 + r) + PMT;
    return { mesesNecessarios: n, projetado: proj };
  };

  const [formErrors, setFormErrors] = useState({});

  const save = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    if (!form.alvo || parseFloat(form.alvo) <= 0) errs.alvo = "Valor alvo deve ser positivo";

    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }

    const data = {
      ...form,
      alvo: parseFloat(form.alvo),
      atual: parseFloat(form.atual),
      prazo: parseInt(form.prazo),
      aporte: parseFloat(form.aporte),
      taxa: parseFloat(form.taxa),
    };
    if (form.id && metas.find(m => m.id === form.id)) {
      setMetas(metas.map(m => m.id === form.id ? data : m));
      toast.success("Meta atualizada.");
    } else {
      setMetas([...metas, { ...data, id: uid() }]);
      toast.success(`Meta "${data.nome}" criada.`);
    }
    setForm(null);
    setFormErrors({});
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VII"
        title="Metas"
        sub="Promessas que viram patrimônio. Calcule, projete, persiga."
        action={<button className="btn-gold" onClick={() => setForm({ id: null, nome: "", alvo: "", atual: 0, prazo: 12, aporte: 500, taxa: 0.85 })}>
          <Plus size={14} className="inline mr-2" />Nova Meta
        </button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {metas.length === 0 && (
          <div className="md:col-span-2 text-center py-12" style={{ color: T.muted, fontStyle: "italic" }}>
            Nenhuma meta cadastrada.
          </div>
        )}
        {metas.map(m => {
          const { mesesNecessarios, projetado } = calc(m);
          const pct = Math.min(100, (m.atual / m.alvo) * 100);
          const ok = projetado >= m.alvo;
          return (
            <div key={m.id} style={{ background: T.card, border: `1px solid ${T.border}`, padding: 28 }}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="label-eyebrow">{ok ? "No ritmo certo" : "Acelerar aporte"}</div>
                <div className="flex gap-2">
                  <button onClick={() => setForm(m)} aria-label={`Editar meta ${m.nome}`} style={{ color: T.muted }}><Edit3 size={14} /></button>
                  <button onClick={async () => {
                            const ok = await confirm({
                              title: `Excluir meta "${m.nome}"?`,
                              danger: true, confirmLabel: "Excluir",
                            });
                            if (!ok) return;
                            const backup = metas;
                            setMetas(metas.filter(x => x.id !== m.id));
                            toast.success(`Meta "${m.nome}" excluída.`, {
                              action: { label: "Desfazer", onClick: () => setMetas(backup) },
                            });
                          }}
                          style={{ color: T.red }}><Trash2 size={14} /></button>
                </div>
              </div>
              <h3 style={{ fontFamily: T.serif, fontSize: 28, color: T.ink, lineHeight: 1.1 }}>{m.nome}</h3>
              <div className="num text-sm mt-2" style={{ color: T.muted }}>
                {hidden ? "•••" : fmt(m.atual)} <span style={{ color: T.faint }}>de</span> {hidden ? "•••" : fmt(m.alvo)}
              </div>
              <div className="mt-4" style={{ background: T.border, height: 8 }}>
                <div style={{ width: `${pct}%`, background: T.gold, height: "100%", transition: "width 0.6s" }} />
              </div>
              <div className="num text-right text-xs mt-1" style={{ color: T.gold }}>{fmtN(pct, 1)}%</div>

              <div className="grid grid-cols-2 gap-4 mt-6 pt-6" style={{ borderTop: `1px solid ${T.border}` }}>
                <div>
                  <div className="label-eyebrow">Aporte/mês</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: T.ink }}>{hidden ? "•••" : fmt(m.aporte)}</div>
                </div>
                <div>
                  <div className="label-eyebrow">Taxa a.m.</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: T.ink }}>{fmtN(m.taxa, 2)}%</div>
                </div>
                <div>
                  <div className="label-eyebrow">Tempo necessário</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: ok ? T.green : T.gold }}>
                    {mesesNecessarios >= 1200 ? "—" : `${mesesNecessarios} meses`}
                  </div>
                </div>
                <div>
                  <div className="label-eyebrow">No prazo ({m.prazo}m)</div>
                  <div className="num mt-1" style={{ fontSize: 16, color: ok ? T.green : T.red }}>
                    {hidden ? "•••" : fmt(projetado)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <Modal title={form.id ? "Editar Meta" : "Nova Meta"} onClose={() => setForm(null)}>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Reserva de emergência" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor alvo (R$)" required error={formErrors.alvo}>
              <input type="number" value={form.alvo} onChange={e => setForm({ ...form, alvo: e.target.value })} />
            </Field>
            <Field label="Valor atual (R$)">
              <input type="number" value={form.atual} onChange={e => setForm({ ...form, atual: e.target.value })} />
            </Field>
            <Field label="Prazo (meses)">
              <input type="number" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} />
            </Field>
            <Field label="Aporte mensal (R$)">
              <input type="number" value={form.aporte} onChange={e => setForm({ ...form, aporte: e.target.value })} />
            </Field>
            <Field label="Taxa juros (% a.m.)">
              <input type="number" step="0.01" value={form.taxa} onChange={e => setForm({ ...form, taxa: e.target.value })} />
            </Field>
          </div>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

