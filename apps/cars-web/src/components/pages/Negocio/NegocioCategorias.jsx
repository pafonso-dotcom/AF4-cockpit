import React, { useState } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";

/**
 * NegocioCategorias — categorias do Negócio (dados próprios, independentes do
 * financeiro pessoal). Campos: { id, nome, tipo: "despesa"|"receita", cor }.
 */
export default function NegocioCategorias({ categorias = [], setCategorias }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [vista, setVista] = useState("despesa");

  const receitas = (categorias || []).filter(c => c.tipo === "receita");
  const despesas = (categorias || []).filter(c => c.tipo === "despesa");
  const lista = vista === "receita" ? receitas : despesas;

  const novo = () =>
    setForm({ id: null, nome: "", tipo: vista, cor: T.gold });

  const save = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    else if (categorias.find(c => c.nome === form.nome && c.id !== form.id)) {
      errs.nome = "Já existe uma categoria com esse nome";
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }
    if (form.id && categorias.find(c => c.id === form.id)) {
      setCategorias(categorias.map(c => c.id === form.id ? form : c));
      toast.success("Categoria atualizada.");
    } else {
      setCategorias([...categorias, { ...form, id: uid() }]);
      toast.success(`Categoria "${form.nome}" criada.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const excluir = async (c) => {
    const ok = await confirm({
      title: `Excluir "${c.nome}"?`,
      body: "A categoria do Negócio será removida.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setCategorias(categorias.filter(x => x.id !== c.id));
    toast.success(`${c.nome} excluída.`);
  };

  return (
    <div className="fade-up py-8">
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="label-eyebrow">Negócio</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Categorias
          </h2>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
            Categorias próprias do Negócio.
          </div>
        </div>
        <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }} onClick={novo}>
          <Plus size={13} className="inline mr-1.5" />Nova Categoria
        </button>
      </div>

      {/* Toggle Receitas | Despesas */}
      <div style={{
        display: "inline-flex", gap: 0, marginBottom: 12,
        background: T.bgSoft, padding: 3, borderRadius: 14, border: `1px solid ${T.border}`,
      }}>
        {[
          { id: "receita", label: `Receitas (${receitas.length})`, cor: T.green },
          { id: "despesa", label: `Despesas (${despesas.length})`, cor: T.red },
        ].map(t => {
          const ativo = vista === t.id;
          return (
            <button key={t.id} onClick={() => setVista(t.id)}
              style={{
                padding: "6px 14px", fontSize: 11.5, fontWeight: ativo ? 700 : 500,
                background: ativo ? T.card : "transparent",
                color: ativo ? t.cor : T.muted,
                border: ativo ? `1px solid ${t.cor}55` : `1px solid transparent`,
                borderRadius: 11, cursor: "pointer",
              }}>
              {t.label}
            </button>
          );
        })}
      </div>

      {lista.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic",
                      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhuma categoria de {vista} ainda. Comece com o botão <strong>Nova Categoria</strong>.
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 14, borderRadius: 14 }}>
          <div className="space-y-1">
            {lista.map(c => (
              <div key={c.id} className="flex items-center gap-2.5" style={{ padding: "7px 0", borderBottom: `1px solid ${T.border}` }}>
                <div style={{ width: 14, height: 14, background: c.cor || T.gold, borderRadius: 4, flexShrink: 0 }} />
                <span style={{ flex: 1, color: T.ink, fontSize: 12.5, fontWeight: 600 }}>{c.nome}</span>
                <span style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: c.tipo === "receita" ? T.green : T.red }}>
                  {c.tipo}
                </span>
                <button onClick={() => setForm({ ...c })} aria-label={`Editar ${c.nome}`}
                        style={{ color: T.muted, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                  <Edit3 size={12} />
                </button>
                <button onClick={() => excluir(c)} aria-label={`Excluir ${c.nome}`}
                        style={{ color: T.red, padding: 4, background: "transparent", border: "none", cursor: "pointer" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar Categoria" : "Nova Categoria"} onClose={() => setForm(null)}>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {["receita", "despesa"].map(t => (
              <button key={t} onClick={() => setForm({ ...form, tipo: t })}
                style={{
                  padding: "12px", border: `1px solid ${form.tipo === t ? (t === "receita" ? T.green : T.red) : T.border}`,
                  background: form.tipo === t ? (t === "receita" ? `${T.green}22` : `${T.red}22`) : "transparent",
                  color: form.tipo === t ? (t === "receita" ? T.green : T.red) : T.muted,
                  fontFamily: T.sans, fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase",
                }}>
                {t === "receita" ? "Receita" : "Despesa"}
              </button>
            ))}
          </div>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} />
          </Field>
          <Field label="Cor">
            <input type="color" value={form.cor || T.gold}
                   onChange={e => setForm({ ...form, cor: e.target.value })}
                   style={{ width: 60, height: 36, border: `1px solid ${T.border}`, borderRadius: 8, background: "transparent", cursor: "pointer" }} />
          </Field>
          <div className="flex gap-3 mt-6">
            <button className="btn-gold" onClick={save}>Salvar</button>
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
