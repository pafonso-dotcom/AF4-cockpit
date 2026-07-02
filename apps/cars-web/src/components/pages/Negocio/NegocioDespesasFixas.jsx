import React, { useState } from "react";
import { Plus, Trash2, Edit3, Repeat } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";
import { filtrarPorLoja, LOJA_TODAS } from "../../../lib/negocioLojas.js";
import { ordenarPorNome } from "../../../lib/categoriaSort.js";

/**
 * NegocioDespesasFixas — despesas recorrentes mensais do Negócio (dados
 * próprios), por loja. Campos: { id, descricao, valor, categoria, diaVencimento, lojaId }.
 * Mostra o total mensal somado.
 */
export default function NegocioDespesasFixas({ despesas = [], setDespesas, categorias = [], lojaAtiva, lojas = [], hidden }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const ehTodas = lojaAtiva === LOJA_TODAS;
  const lojaPadrao = lojas[0]?.id || "";
  const nomeLoja = (id) => (lojas.find((l) => l.id === id)?.nome || "—");

  const catsDespesa = ordenarPorNome((categorias || []).filter(c => c.tipo === "despesa"));
  const daLoja = filtrarPorLoja(despesas, lojaAtiva);
  const totalMensal = daLoja.reduce((s, d) => s + (Number(d.valor) || 0), 0);

  const novo = () =>
    setForm({ id: null, descricao: "", valor: "", categoria: "", diaVencimento: 1, lojaId: ehTodas ? lojaPadrao : lojaAtiva });

  const save = () => {
    const errs = {};
    if (!form.descricao?.trim()) errs.descricao = "Descrição é obrigatória";
    const valorNum = Number(String(form.valor).replace(/\./g, "").replace(",", "."));
    if (form.valor === "" || form.valor == null || isNaN(valorNum) || valorNum <= 0) {
      errs.valor = "Valor inválido (ex.: 1500 ou 1.500,00)";
    }
    const dia = parseInt(form.diaVencimento, 10);
    if (isNaN(dia) || dia < 1 || dia > 31) errs.diaVencimento = "Dia entre 1 e 31";
    if (!form.lojaId) errs.lojaId = "Escolha a loja";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }
    const normalizado = { ...form, valor: valorNum, diaVencimento: dia };
    if (form.id && despesas.find(d => d.id === form.id)) {
      setDespesas(despesas.map(d => d.id === form.id ? normalizado : d));
      toast.success("Despesa fixa atualizada.");
    } else {
      setDespesas([...despesas, { ...normalizado, id: uid() }]);
      toast.success(`Despesa fixa "${form.descricao}" criada.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const excluir = async (d) => {
    const ok = await confirm({
      title: `Excluir "${d.descricao}"?`,
      body: "A despesa fixa do Negócio será removida.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setDespesas(despesas.filter(x => x.id !== d.id));
    toast.success(`${d.descricao} excluída.`);
  };

  const corCat = (nome) => (categorias || []).find(c => c.nome === nome)?.cor || T.muted;

  const ordenadas = [...daLoja].sort((a, b) => (a.diaVencimento || 0) - (b.diaVencimento || 0));

  return (
    <div className="fade-up py-8">
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="label-eyebrow">Negócio</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Despesas fixas
          </h2>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
            Obrigações recorrentes mensais do Negócio.
          </div>
        </div>
        <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }} onClick={novo}>
          <Plus size={13} className="inline mr-1.5" />Nova fixa
        </button>
      </div>

      {/* Total mensal */}
      <div style={{
        marginBottom: 10, padding: "8px 12px",
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
        display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 9, letterSpacing: ".15em", color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>
          Total mensal
        </span>
        <span className="num" style={{ fontFamily: T.serif, fontSize: 22, color: T.gold, lineHeight: 1 }}>
          {hidden ? "R$ •••••" : fmt(totalMensal)}
        </span>
        <span className="num" style={{ fontSize: 10.5, color: T.faint }}>
          · {daLoja.length} {daLoja.length === 1 ? "despesa" : "despesas"}
        </span>
      </div>

      {ordenadas.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic",
                      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhuma despesa fixa do Negócio ainda. Comece com o botão <strong>Nova fixa</strong>.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {ordenadas.map(d => (
            <div key={d.id} style={{
              background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${corCat(d.categoria)}`,
              borderRadius: 16, padding: "8px 12px",
              display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            }}>
              <div style={{ width: 26, height: 26, borderRadius: 12, background: `${corCat(d.categoria)}22`,
                            color: corCat(d.categoria), display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Repeat size={13} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>{d.descricao}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1, fontSize: 11, color: T.muted, flexWrap: "wrap" }}>
                  {ehTodas && <span style={{ padding: "1px 7px", background: `${T.gold}22`, color: T.gold, borderRadius: 4, fontWeight: 600, fontSize: 9.5 }}>{nomeLoja(d.lojaId)}</span>}
                  {d.categoria && (
                    <span style={{ padding: "1px 7px", background: `${corCat(d.categoria)}22`, color: corCat(d.categoria),
                                   borderRadius: 4, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", fontSize: 9.5 }}>
                      {d.categoria}
                    </span>
                  )}
                  <span>Todo dia {d.diaVencimento}</span>
                </div>
              </div>
              <div className="num" style={{ color: T.red, fontFamily: T.serif, fontSize: 14.5, fontWeight: 600, minWidth: 100, textAlign: "right" }}>
                {hidden ? "•••" : fmt(d.valor)}
              </div>
              <button onClick={() => setForm({ ...d })} title="Editar"
                      style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, padding: "5px 8px", borderRadius: 11, cursor: "pointer" }}>
                <Edit3 size={12} />
              </button>
              <button onClick={() => excluir(d)} title="Excluir"
                      style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, padding: "5px 8px", borderRadius: 11, cursor: "pointer" }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar despesa fixa" : "Nova despesa fixa"} onClose={() => setForm(null)}>
          <Field label="Descrição" required error={formErrors.descricao}>
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Aluguel da loja" />
          </Field>
          <Field label="Valor (R$)" required error={formErrors.valor} hint="Ex.: 1500 ou 1.500,00">
            <input type="text" inputMode="decimal" autoComplete="off"
                   value={form.valor == null ? "" : String(form.valor)}
                   onChange={e => setForm({ ...form, valor: e.target.value })}
                   placeholder="Ex.: 1.500,00" />
          </Field>
          {(ehTodas || !lojaAtiva) && (
            <Field label="Loja" required error={formErrors.lojaId}>
              <select value={form.lojaId || ""} onChange={e => setForm({ ...form, lojaId: e.target.value })}>
                <option value="">— Escolha —</option>
                {lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </Field>
          )}
          <Field label="Categoria">
            <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
              <option value="">— Sem categoria —</option>
              {catsDespesa.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Dia de vencimento" required error={formErrors.diaVencimento} hint="1 a 31">
            <input type="number" min="1" max="31" value={form.diaVencimento}
                   onChange={e => setForm({ ...form, diaVencimento: e.target.value })} />
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
