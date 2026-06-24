import React, { useState } from "react";
import { Plus, Trash2, Edit3, Building2 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Field from "../../ui/Field.jsx";
import Modal from "../../ui/Modal.jsx";
import { filtrarPorLoja, LOJA_TODAS } from "../../../lib/negocioLojas.js";

/**
 * NegocioBanco — contas/bancos do Negócio (dados próprios, independentes do
 * financeiro pessoal). CRUD simples com lista + total somado.
 * Campos por conta: { id, nome, instituicao, saldo, cor }.
 */
export default function NegocioBanco({ contas = [], setContas, lojaAtiva, lojas = [], hidden }) {
  const [form, setForm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const ehTodas = lojaAtiva === LOJA_TODAS;
  const lojaPadrao = lojas[0]?.id || "";
  const nomeLoja = (id) => (lojas.find((l) => l.id === id)?.nome || "—");

  const daLoja = filtrarPorLoja(contas, lojaAtiva);
  const total = daLoja.reduce((s, c) => s + (Number(c.saldo) || 0), 0);

  const novo = () =>
    setForm({ id: null, nome: "", instituicao: "", saldo: "", cor: T.gold, lojaId: ehTodas ? lojaPadrao : lojaAtiva });

  const save = () => {
    const errs = {};
    if (!form.nome?.trim()) errs.nome = "Nome é obrigatório";
    const saldoNum = Number(String(form.saldo).replace(/\./g, "").replace(",", "."));
    if (form.saldo === "" || form.saldo == null || isNaN(saldoNum)) {
      errs.saldo = "Saldo inválido (ex.: 1500 ou 1.500,00)";
    }
    if (!form.lojaId) errs.lojaId = "Escolha a loja";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      toast.error("Verifique os campos destacados.");
      return;
    }
    const normalizado = { ...form, saldo: saldoNum };
    if (form.id && contas.find(c => c.id === form.id)) {
      setContas(contas.map(c => c.id === form.id ? normalizado : c));
      toast.success("Conta atualizada.");
    } else {
      setContas([...contas, { ...normalizado, id: uid() }]);
      toast.success(`Conta "${form.nome}" criada.`);
    }
    setForm(null);
    setFormErrors({});
  };

  const excluir = async (c) => {
    const ok = await confirm({
      title: `Excluir "${c.nome}"?`,
      body: "A conta do Negócio será removida.",
      danger: true, confirmLabel: "Excluir",
    });
    if (!ok) return;
    setContas(contas.filter(x => x.id !== c.id));
    toast.success(`${c.nome} excluída.`);
  };

  return (
    <div className="fade-up py-8">
      <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${T.border}`,
                    display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flexShrink: 0 }}>
          <div className="label-eyebrow">Negócio</div>
          <h2 style={{ fontFamily: T.serif, fontSize: 26, color: T.ink, marginTop: 4, lineHeight: 1.05, letterSpacing: "-0.02em" }}>
            Banco
          </h2>
          <div style={{ color: T.muted, fontSize: 12, marginTop: 4, fontStyle: "italic" }}>
            Contas e bancos do Negócio — separados do financeiro pessoal.
          </div>
        </div>
        <button className="btn-gold" style={{ padding: "7px 12px", fontSize: 11 }} onClick={novo}>
          <Plus size={13} className="inline mr-1.5" />Nova Conta
        </button>
      </div>

      {/* Total */}
      <div style={{
        marginBottom: 10, padding: "8px 12px",
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
        display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
      }}>
        <span style={{ fontSize: 9, letterSpacing: ".15em", color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>
          Total
        </span>
        <span className="num" style={{ fontFamily: T.serif, fontSize: 22, color: T.gold, lineHeight: 1 }}>
          {hidden ? "R$ •••••" : fmt(total)}
        </span>
        <span className="num" style={{ fontSize: 10.5, color: T.faint }}>
          · {daLoja.length} {daLoja.length === 1 ? "conta" : "contas"}
        </span>
      </div>

      {/* Lista */}
      {daLoja.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic",
                      background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhuma conta do Negócio ainda. Comece com o botão <strong>Nova Conta</strong>.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {daLoja.map(c => (
            <div key={c.id} style={{
              background: T.card, border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${c.cor || T.gold}`, borderRadius: 11,
              display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            }}>
              <Building2 size={15} style={{ color: T.faint, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {ehTodas && <span style={{ padding: "1px 7px", background: `${T.gold}22`, color: T.gold, borderRadius: 4, fontWeight: 600, fontSize: 9.5 }}>{nomeLoja(c.lojaId)}</span>}
                  {c.instituicao && <span style={{ fontSize: 10, color: T.muted, fontStyle: "italic" }}>{c.instituicao}</span>}
                </div>
              </div>
              <div className="num" style={{ fontFamily: T.serif, fontSize: 15, color: (Number(c.saldo) || 0) < 0 ? T.red : T.ink, whiteSpace: "nowrap" }}>
                {hidden ? "•••" : fmt(c.saldo)}
              </div>
              <button onClick={() => setForm({ ...c })} title="Editar"
                      style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", padding: 4 }}>
                <Edit3 size={13} />
              </button>
              <button onClick={() => excluir(c)} title="Excluir"
                      style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", padding: 4 }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal title={form.id ? "Editar Conta" : "Nova Conta"} onClose={() => setForm(null)}>
          <Field label="Nome" required error={formErrors.nome}>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Conta do Negócio" />
          </Field>
          {(ehTodas || !lojaAtiva) && (
            <Field label="Loja" required error={formErrors.lojaId}>
              <select value={form.lojaId || ""} onChange={e => setForm({ ...form, lojaId: e.target.value })}>
                <option value="">— Escolha —</option>
                {lojas.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            </Field>
          )}
          <Field label="Instituição">
            <input value={form.instituicao} onChange={e => setForm({ ...form, instituicao: e.target.value })} placeholder="Ex.: Itaú, Nubank PJ…" />
          </Field>
          <Field label="Saldo (R$)" error={formErrors.saldo} hint="Aceita: 1500 · 1.500,00 · negativo">
            <input type="text" inputMode="decimal" autoComplete="off"
                   value={form.saldo == null ? "" : String(form.saldo)}
                   onChange={e => setForm({ ...form, saldo: e.target.value })}
                   placeholder="Ex.: 1.500,00 ou 1500" />
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
