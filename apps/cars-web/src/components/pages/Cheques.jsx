import React, { useState, useMemo } from "react";
import { Plus, Trash2, Edit3, Check, RotateCcw } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import Field from "../ui/Field.jsx";
import Modal from "../ui/Modal.jsx";
import MoneyInput from "../ui/MoneyInput.jsx";
import PageHeader from "../ui/PageHeader.jsx";

/**
 * Cheques — controle de cheques a receber (nova fonte de recebíveis).
 * Status: aguardando | compensado | devolvido.
 * Compensar credita uma conta e cria transação de receita. Cheque aguardando
 * conta como recebível pendente no relatório (via getGanhosDoMes).
 */
const STATUS = {
  aguardando: { label: "Aguardando", cor: "#F59E0B" },
  compensado: { label: "Compensado", cor: "#10B981" },
  devolvido:  { label: "Devolvido",  cor: "#EF4444" },
};

export default function Cheques({ cheques = [], setCheques, contas = [], setContas, transacoes = [], setTransacoes, escopoAtivo = "tudo", hidden }) {
  const [form, setForm] = useState(null);         // novo/editar
  const [compForm, setCompForm] = useState(null); // compensar
  const [filtro, setFiltro] = useState("todos");
  const hoje = todayISO();
  const mesAtual = hoje.slice(0, 7);

  const noEscopo = (c) => escopoAtivo === "tudo" || (c.escopo || "pessoal") === escopoAtivo;
  const doEscopo = useMemo(() => (cheques || []).filter(noEscopo), [cheques, escopoAtivo]);
  const lista = useMemo(() =>
    doEscopo.filter(c => filtro === "todos" || c.status === filtro)
      .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || "")),
    [doEscopo, filtro]);

  const totalAguardando = doEscopo.filter(c => c.status === "aguardando").reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const vencidos = doEscopo.filter(c => c.status === "aguardando" && (c.vencimento || "") < hoje);
  const totalVencidos = vencidos.reduce((s, c) => s + (Number(c.valor) || 0), 0);
  const compensadoMes = doEscopo.filter(c => c.status === "compensado" && (c.dataCompensacao || "").startsWith(mesAtual)).reduce((s, c) => s + (Number(c.valor) || 0), 0);

  const novo = () => setForm({ id: null, de: "", valor: "", vencimento: hoje, banco: "", numero: "", obs: "", escopo: escopoAtivo === "tudo" ? "pessoal" : escopoAtivo, status: "aguardando" });

  const salvar = () => {
    if (!form.de?.trim()) { toast.error("Informe de quem é o cheque."); return; }
    const valor = Number(form.valor) || 0;
    if (valor <= 0) { toast.error("Valor inválido."); return; }
    if (!form.vencimento) { toast.error("Informe o vencimento."); return; }
    const data = { ...form, de: form.de.trim(), valor };
    if (form.id) {
      setCheques(cheques.map(c => c.id === form.id ? { ...c, ...data } : c));
      toast.success("Cheque atualizado.");
    } else {
      setCheques([...cheques, { ...data, id: uid() }]);
      toast.success(`Cheque de ${data.de} cadastrado.`);
    }
    setForm(null);
  };

  const abrirCompensar = (c) => setCompForm({ chequeId: c.id, de: c.de, valor: c.valor, contaDestino: contas[0]?.nome || "", data: hoje });

  const confirmarCompensar = () => {
    if (!compForm.contaDestino) { toast.error("Selecione a conta de destino."); return; }
    const conta = contas.find(x => x.nome === compForm.contaDestino);
    if (!conta) { toast.error("Conta não encontrada."); return; }
    const valor = Number(compForm.valor) || 0;
    const txId = uid();
    const tx = { id: txId, tipo: "receita", valor, descricao: `Cheque de ${compForm.de}`, categoria: "Cheques", conta: compForm.contaDestino, data: compForm.data, compensado: true, fixa: false, chequeId: compForm.chequeId };
    setTransacoes([tx, ...transacoes]);
    setContas(contas.map(x => x.id === conta.id ? { ...x, saldo: (parseFloat(x.saldo) || 0) + valor } : x));
    setCheques(cheques.map(c => c.id === compForm.chequeId ? { ...c, status: "compensado", contaCompensacao: compForm.contaDestino, dataCompensacao: compForm.data, txId } : c));
    toast.success(`Cheque de ${compForm.de} compensado em ${compForm.contaDestino}.`);
    setCompForm(null);
  };

  // Desfaz a compensação: remove a transação e debita o valor de volta da conta.
  const reverterCompensacao = (c) => {
    if (c.txId) setTransacoes((transacoes || []).filter(t => t.id !== c.txId));
    if (c.contaCompensacao) setContas((contas || []).map(x => x.nome === c.contaCompensacao ? { ...x, saldo: (parseFloat(x.saldo) || 0) - (Number(c.valor) || 0) } : x));
  };

  const estornar = (c) => {
    const backup = { cheques, contas, transacoes };
    reverterCompensacao(c);
    setCheques(cheques.map(x => x.id === c.id ? { ...x, status: "aguardando", contaCompensacao: null, dataCompensacao: null, txId: null } : x));
    toast.success(`Compensação do cheque de ${c.de} estornada.`, {
      action: { label: "Desfazer", onClick: () => { setCheques(backup.cheques); setContas(backup.contas); setTransacoes(backup.transacoes); } },
    });
  };

  const devolver = async (c) => {
    const ok = await confirm({ title: `Marcar cheque de ${c.de} como devolvido?`, body: "Cheque sem fundo / devolvido. Se estava compensado, a transação é estornada.", danger: true, confirmLabel: "Devolver" });
    if (!ok) return;
    if (c.status === "compensado") reverterCompensacao(c);
    setCheques(cheques.map(x => x.id === c.id ? { ...x, status: "devolvido", contaCompensacao: null, dataCompensacao: null, txId: null } : x));
    toast.success("Cheque marcado como devolvido.");
  };

  const reativar = (c) => {
    setCheques(cheques.map(x => x.id === c.id ? { ...x, status: "aguardando" } : x));
    toast.success("Cheque voltou para aguardando.");
  };

  const excluir = async (c) => {
    const ok = await confirm({ title: `Excluir cheque de ${c.de}?`, body: c.status === "compensado" ? "O cheque foi compensado — a transação será estornada e o valor devolvido da conta." : "O cheque será removido.", danger: true, confirmLabel: "Excluir" });
    if (!ok) return;
    const backup = { cheques, contas, transacoes };
    if (c.status === "compensado") reverterCompensacao(c);
    setCheques(cheques.filter(x => x.id !== c.id));
    toast.success("Cheque excluído.", {
      action: { label: "Desfazer", onClick: () => { setCheques(backup.cheques); setContas(backup.contas); setTransacoes(backup.transacoes); } },
    });
  };

  const fmtData = (d) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}` : "—";
  const btnGhost = { background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 10, padding: "5px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5 };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Recebíveis"
        title={<>Cheques.</>}
        sub="Cheques a receber. Ao compensar, o dinheiro entra na conta escolhida e vira receita. Cheques aguardando aparecem no relatório."
        action={<button className="btn-gold" onClick={novo}><Plus size={13} className="inline mr-1.5" /> Novo cheque</button>}
      />

      {/* KPIs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          { l: "Aguardando", v: totalAguardando, c: T.gold },
          { l: `Vencidos (${vencidos.length})`, v: totalVencidos, c: T.red },
          { l: "Compensado · mês", v: compensadoMes, c: T.green },
        ].map(k => (
          <div key={k.l} style={{ flex: 1, minWidth: 120, background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "10px 12px" }}>
            <div style={{ fontSize: 10.5, color: T.muted }}>{k.l}</div>
            <div className="num" style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: k.c, marginTop: 2 }}>{hidden ? "•••" : fmt(k.v)}</div>
          </div>
        ))}
      </div>

      {/* Filtro por status */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {[["todos", "Todos"], ["aguardando", "Aguardando"], ["compensado", "Compensado"], ["devolvido", "Devolvido"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setFiltro(id)}
            style={{ background: filtro === id ? T.gold : "transparent", color: filtro === id ? T.bg : T.ink, border: `1px solid ${filtro === id ? T.gold : T.border}`, borderRadius: 999, padding: "4px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {lbl}
          </button>
        ))}
      </div>

      {lista.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", color: T.muted, fontStyle: "italic", background: T.card, border: `1px dashed ${T.border}`, borderRadius: 16 }}>
          Nenhum cheque {filtro !== "todos" ? STATUS[filtro]?.label.toLowerCase() : "cadastrado"}. Comece com <strong>Novo cheque</strong>.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {lista.map(c => {
            const st = STATUS[c.status] || STATUS.aguardando;
            const vencido = c.status === "aguardando" && (c.vencimento || "") < hoje;
            return (
              <div key={c.id} style={{ background: T.card, border: `1px solid ${T.border}`, borderLeft: `4px solid ${st.cor}`, borderRadius: 16, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ color: T.ink, fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    {c.de}
                    <span style={{ fontSize: 8.5, padding: "1px 6px", borderRadius: 100, background: `${st.cor}22`, color: st.cor, textTransform: "uppercase", fontWeight: 700, letterSpacing: ".05em" }}>{st.label}</span>
                    {vencido && <span style={{ fontSize: 8.5, padding: "1px 6px", borderRadius: 100, background: `${T.red}22`, color: T.red, textTransform: "uppercase", fontWeight: 700 }}>vencido</span>}
                  </div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>
                    venc. {fmtData(c.vencimento)}{c.banco ? ` · ${c.banco}` : ""}{c.numero ? ` · nº ${c.numero}` : ""}
                    {c.status === "compensado" && c.contaCompensacao ? ` · em ${c.contaCompensacao}` : ""}
                  </div>
                </div>
                <div className="num" style={{ color: st.cor, fontFamily: T.serif, fontSize: 14.5, fontWeight: 600, minWidth: 90, textAlign: "right" }}>{hidden ? "•••" : fmt(c.valor)}</div>
                <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap" }}>
                  {c.status === "aguardando" && (
                    <button onClick={() => abrirCompensar(c)} title="Compensar"
                      style={{ background: T.gold, color: T.bg, border: "none", borderRadius: 10, padding: "5px 10px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600 }}>
                      <Check size={12} /> Compensar
                    </button>
                  )}
                  {c.status === "compensado" && (
                    <button onClick={() => estornar(c)} title="Estornar compensação" style={btnGhost}><RotateCcw size={12} /> Estornar</button>
                  )}
                  {c.status === "aguardando" && (
                    <button onClick={() => devolver(c)} title="Marcar devolvido" style={{ ...btnGhost, color: T.red, borderColor: `${T.red}55` }}>Devolver</button>
                  )}
                  {c.status === "devolvido" && (
                    <button onClick={() => reativar(c)} title="Voltar para aguardando" style={btnGhost}><RotateCcw size={12} /> Reativar</button>
                  )}
                  <button onClick={() => setForm({ ...c })} title="Editar" style={{ ...btnGhost, padding: "5px 7px" }}><Edit3 size={13} /></button>
                  <button onClick={() => excluir(c)} title="Excluir" style={{ ...btnGhost, color: T.red, borderColor: `${T.red}55`, padding: "5px 7px" }}><Trash2 size={13} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Novo/Editar */}
      {form && (
        <Modal title={form.id ? "Editar cheque" : "Novo cheque"} onClose={() => setForm(null)}>
          <Field label="De quem é o cheque" required>
            <input value={form.de} onChange={e => setForm({ ...form, de: e.target.value })} placeholder="Ex.: João Silva" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)" required>
              <MoneyInput value={form.valor} onChange={v => setForm({ ...form, valor: v })} />
            </Field>
            <Field label="Vencimento" required>
              <input type="date" value={form.vencimento} onChange={e => setForm({ ...form, vencimento: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Banco">
              <input value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="Ex.: Itaú" />
            </Field>
            <Field label="Nº do cheque">
              <input value={form.numero} onChange={e => setForm({ ...form, numero: e.target.value })} placeholder="Ex.: 000123" />
            </Field>
          </div>
          <Field label="Escopo" hint="Pessoal ou Negócio — separa nas estatísticas">
            <select value={form.escopo || "pessoal"} onChange={e => setForm({ ...form, escopo: e.target.value })}>
              <option value="pessoal">👤 Pessoal</option>
              <option value="negocio">🏢 Negócio</option>
            </select>
          </Field>
          <Field label="Observações">
            <textarea value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })} rows={2} placeholder="Detalhes…" />
          </Field>
          <div className="flex gap-3 justify-end mt-4">
            <button className="btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={salvar}>Salvar</button>
          </div>
        </Modal>
      )}

      {/* Modal Compensar */}
      {compForm && (
        <Modal title={`Compensar cheque · ${compForm.de}`} onClose={() => setCompForm(null)}>
          <div style={{ padding: 12, background: T.bgSoft, borderRadius: 12, fontSize: 13, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: T.muted }}>Valor</span>
            <span className="num" style={{ color: T.green, fontWeight: 600, fontSize: 16 }}>+ {fmt(compForm.valor)}</span>
          </div>
          <Field label="Conta de destino" required>
            <select value={compForm.contaDestino} onChange={e => setCompForm({ ...compForm, contaDestino: e.target.value })}>
              {(contas || []).map(c => <option key={c.id} value={c.nome}>{c.nome} · {fmt(c.saldo)}</option>)}
            </select>
          </Field>
          <Field label="Data da compensação" required>
            <input type="date" value={compForm.data} onChange={e => setCompForm({ ...compForm, data: e.target.value })} />
          </Field>
          <div className="flex gap-3 justify-end mt-4">
            <button className="btn-ghost" onClick={() => setCompForm(null)}>Cancelar</button>
            <button className="btn-gold" onClick={confirmarCompensar}>✓ Compensar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
