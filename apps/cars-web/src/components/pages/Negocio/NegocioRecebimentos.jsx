import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit3 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";
import { filtrarPorLoja, LOJA_TODAS } from "../../../lib/negocioLojas.js";

/**
 * NegocioRecebimentos — entradas (recebimentos) do Negócio, por loja.
 * Campos: { id, descricao, valor, categoria, data, conta, lojaId }.
 */
export default function NegocioRecebimentos({ recebimentos = [], setRecebimentos, categorias = [], contas = [], lojaAtiva, lojas = [], hidden }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [mesFiltro, setMesFiltro] = useState("");
  const ehTodas = lojaAtiva === LOJA_TODAS;
  const lojaPadrao = lojas[0]?.id || "";
  const nomeLoja = (id) => (lojas.find((l) => l.id === id)?.nome || "—");

  const catsReceita = (categorias || []).filter(c => c.tipo === "receita");
  const daLoja = useMemo(() => filtrarPorLoja(recebimentos, lojaAtiva), [recebimentos, lojaAtiva]);
  const mesesDisponiveis = useMemo(() => {
    const set = new Set();
    daLoja.forEach(d => { if (d.data) set.add(d.data.slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [daLoja]);
  const filtradas = useMemo(() => {
    const arr = !mesFiltro ? daLoja : daLoja.filter(d => (d.data || "").startsWith(mesFiltro));
    return [...arr].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [daLoja, mesFiltro]);
  const total = filtradas.reduce((s, d) => s + (Number(d.valor) || 0), 0);

  const novo = () => setForm({ id: null, descricao: "", valor: "", categoria: "", data: todayISO(), conta: "", lojaId: ehTodas ? lojaPadrao : lojaAtiva });

  const save = () => {
    const errs = {};
    if (!form.descricao?.trim()) errs.descricao = "Descrição é obrigatória";
    const valorNum = Number(String(form.valor).replace(/\./g, "").replace(",", "."));
    if (form.valor === "" || form.valor == null || isNaN(valorNum) || valorNum <= 0) errs.valor = "Valor inválido";
    if (!form.data) errs.data = "Data é obrigatória";
    if (!form.lojaId) errs.lojaId = "Escolha a loja";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) { toast.error("Verifique os campos destacados."); return; }
    const normalizado = { ...form, valor: valorNum };
    if (form.id && recebimentos.find(d => d.id === form.id)) {
      setRecebimentos(recebimentos.map(d => d.id === form.id ? normalizado : d));
      toast.success("Recebimento atualizado.");
    } else {
      setRecebimentos([...recebimentos, { ...normalizado, id: uid() }]);
      toast.success(`Recebimento "${form.descricao}" criado.`);
    }
    setForm(null); setFormErrors({});
  };
  const excluir = async (d) => {
    const ok = await confirm({ title: `Excluir "${d.descricao}"?`, body: "O recebimento será removido.", danger: true, confirmLabel: "Excluir" });
    if (!ok) return;
    setRecebimentos(recebimentos.filter(x => x.id !== d.id));
    toast.success(`${d.descricao} excluído.`);
  };
  const corCat = (nome) => (categorias || []).find(c => c.nome === nome)?.cor || T.green;
  const mesLabel = (iso) => { const [y, m] = iso.split("-"); const n = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]; return `${n[Number(m)-1]}/${y}`; };

  return (
    <div className="fade-up py-8">
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="label-eyebrow">Negócio</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>Recebimentos</h2>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>Entradas do Negócio por loja.</div>
        </div>
        <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }} onClick={novo}><Plus size={13} className="inline mr-1.5" />Novo recebimento</button>
      </div>

      <div style={{ marginBottom: 10, padding: "8px 12px", background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 9, letterSpacing: ".15em", color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>Total</span>
          <span className="num" style={{ fontFamily: T.serif, fontSize: 22, color: T.green, lineHeight: 1 }}>{hidden ? "R$ •••••" : fmt(total)}</span>
          <span className="num" style={{ fontSize: 10.5, color: T.faint }}>· {filtradas.length} {filtradas.length === 1 ? "lançamento" : "lançamentos"}</span>
        </div>
        <select value={mesFiltro} onChange={e => setMesFiltro(e.target.value)} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, borderRadius: 8, padding: "5px 10px", fontSize: 11.5, cursor: "pointer" }}>
          <option value="">Todos os meses</option>
          {mesesDisponiveis.map(m => <option key={m} value={m}>{mesLabel(m)}</option>)}
        </select>
      </div>

      {filtradas.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic", background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhum recebimento {mesFiltro ? `em ${mesLabel(mesFiltro)}` : "ainda"}.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {filtradas.map(d => (
            <div key={d.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${corCat(d.categoria)}`, borderRadius: 16, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>{d.descricao}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 1, fontSize: 11, color: T.muted, flexWrap: "wrap" }}>
                  {ehTodas && <span style={{ padding: "1px 7px", background: `${T.gold}22`, color: T.gold, borderRadius: 4, fontWeight: 600, fontSize: 9.5 }}>{nomeLoja(d.lojaId)}</span>}
                  {d.categoria && <span style={{ padding: "1px 7px", background: `${corCat(d.categoria)}22`, color: corCat(d.categoria), borderRadius: 4, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", fontSize: 9.5 }}>{d.categoria}</span>}
                  {d.data && <span>{d.data.slice(8, 10)}/{d.data.slice(5, 7)}/{d.data.slice(0, 4)}</span>}
                  {d.conta && <span style={{ fontStyle: "italic" }}>· {d.conta}</span>}
                </div>
              </div>
              <div className="num" style={{ color: T.green, fontFamily: T.serif, fontSize: 14.5, fontWeight: 600, minWidth: 100, textAlign: "right" }}>{hidden ? "•••" : fmt(d.valor)}</div>
              <button onClick={() => setForm({ ...d })} title="Editar" style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, padding: "5px 8px", borderRadius: 11, cursor: "pointer" }}><Edit3 size={12} /></button>
              <button onClick={() => excluir(d)} title="Excluir" style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, padding: "5px 8px", borderRadius: 11, cursor: "pointer" }}><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar recebimento" : "Novo recebimento"} onClose={() => setForm(null)}>
          <Field label="Descrição" required error={formErrors.descricao}>
            <input value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: Venda balcão" />
          </Field>
          <Field label="Valor (R$)" required error={formErrors.valor} hint="Ex.: 1500 ou 1.500,00">
            <input type="text" inputMode="decimal" autoComplete="off" value={form.valor == null ? "" : String(form.valor)} onChange={e => setForm({ ...form, valor: e.target.value })} placeholder="Ex.: 250,00" />
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
              {catsReceita.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </Field>
          <Field label="Data" required error={formErrors.data}>
            <input type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} />
          </Field>
          <Field label="Conta">
            <select value={form.conta} onChange={e => setForm({ ...form, conta: e.target.value })}>
              <option value="">— Sem conta —</option>
              {(contas || []).map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
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
