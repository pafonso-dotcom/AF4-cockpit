import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, uid, todayISO } from "../../lib/format.js";
import { parseValorBR } from "../../lib/importExport.js";
import { toast } from "../../lib/toast.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";

export default function TransferenciaModal({ contas, setContas, transacoes, setTransacoes, categorias, onClose }) {
  const [form, setForm] = useState({
    origem: contas?.[0]?.nome || "",
    destino: contas?.[1]?.nome || contas?.[0]?.nome || "",
    valor: "",
    data: todayISO(),
    obs: "",
  });

  const contaOrigem = contas?.find(c => c.nome === form.origem);
  const contaDestino = contas?.find(c => c.nome === form.destino);
  const valor = parseValorBR(form.valor) || 0;

  const transferir = () => {
    if (!form.origem || !form.destino) {
      toast.error("Selecione conta de origem e destino.");
      return;
    }
    if (form.origem === form.destino) {
      toast.error("Origem e destino devem ser diferentes.");
      return;
    }
    if (!valor || valor <= 0) {
      toast.error("Informe o valor da transferência.");
      return;
    }
    if (contaOrigem.saldo < valor) {
      toast.error(`Saldo insuficiente em ${contaOrigem.nome} (${fmt(contaOrigem.saldo)}).`);
      return;
    }

    // Atualiza saldos
    setContas(contas.map(c => {
      if (c.nome === form.origem) return { ...c, saldo: Number(c.saldo) - valor };
      if (c.nome === form.destino) return { ...c, saldo: Number(c.saldo) + valor };
      return c;
    }));

    // Cria 2 transações conectadas via campo transferenciaId
    const transferId = uid();
    const catTransf = (categorias || []).find(c => /transfer/i.test(c.nome))?.nome || "";

    const txDespesa = {
      id: uid(),
      tipo: "despesa",
      valor,
      descricao: `Transferência para ${form.destino}`,
      categoria: catTransf,
      conta: form.origem,
      data: form.data,
      compensado: true,
      obs: form.obs || `Transferência interna · par ${transferId}`,
      fixa: false,
      vencimento: null,
      transferenciaId: transferId,
    };
    const txReceita = {
      id: uid(),
      tipo: "receita",
      valor,
      descricao: `Transferência de ${form.origem}`,
      categoria: catTransf,
      conta: form.destino,
      data: form.data,
      compensado: true,
      obs: form.obs || `Transferência interna · par ${transferId}`,
      fixa: false,
      vencimento: null,
      transferenciaId: transferId,
    };
    setTransacoes([txDespesa, txReceita, ...(transacoes || [])]);

    toast.success(`${fmt(valor)} transferido de ${form.origem} para ${form.destino}.`, {
      action: {
        label: "Desfazer",
        onClick: () => {
          // Reverte saldos
          setContas(contas);
          // Remove as 2 transações
          setTransacoes((transacoes || []).filter(t => t.id !== txDespesa.id && t.id !== txReceita.id));
        },
      },
    });
    onClose();
  };

  return (
    <Modal title="Transferência entre contas" onClose={onClose}>
      <Field label="Conta de origem">
        <select value={form.origem} onChange={e => setForm({ ...form, origem: e.target.value })}>
          <option value="">Selecione…</option>
          {(contas || []).map(c => (
            <option key={c.id} value={c.nome}>{c.nome} · saldo {fmt(c.saldo)}</option>
          ))}
        </select>
      </Field>

      {/* Setinha visual */}
      <div style={{ textAlign: "center", margin: "6px 0", color: T.gold }}>
        <ArrowRight size={20} style={{ transform: "rotate(90deg)" }} />
      </div>

      <Field label="Conta de destino">
        <select value={form.destino} onChange={e => setForm({ ...form, destino: e.target.value })}>
          <option value="">Selecione…</option>
          {(contas || []).filter(c => c.nome !== form.origem).map(c => (
            <option key={c.id} value={c.nome}>{c.nome} · saldo {fmt(c.saldo)}</option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor (R$)" hint="Aceita 500 · 500,00 · 1.500,00">
          <input type="text" inputMode="decimal" value={form.valor}
                 onChange={e => setForm({ ...form, valor: e.target.value })}
                 placeholder="Ex.: 500,00" />
        </Field>
        <Field label="Data">
          <input type="date" value={form.data}
                 onChange={e => setForm({ ...form, data: e.target.value })} />
        </Field>
      </div>

      <Field label="Observação (opcional)">
        <input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
               placeholder="Ex.: Reserva mensal" />
      </Field>

      {/* Preview de saldos pós-transferência */}
      {contaOrigem && contaDestino && valor > 0 && (
        <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 14, marginTop: 12 }}>
          <div className="label-eyebrow mb-2">Saldos após transferência</div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span style={{ color: T.muted }}>{contaOrigem.nome}</span>
            <span className="num text-right" style={{ color: contaOrigem.saldo - valor >= 0 ? T.ink : T.red, fontWeight: 600 }}>
              {fmt(contaOrigem.saldo - valor)}
            </span>
            <span style={{ color: T.muted }}>{contaDestino.nome}</span>
            <span className="num text-right" style={{ color: T.green, fontWeight: 600 }}>
              {fmt(contaDestino.saldo + valor)}
            </span>
          </div>
        </div>
      )}

      <div style={{ background: `${T.gold}11`, border: `1px solid ${T.gold}`, padding: 10, fontSize: 12, color: T.muted, fontStyle: "italic", marginTop: 12 }}>
        ✓ A transferência gera 2 transações automaticamente (1 despesa de saída, 1 receita de entrada) marcadas como par.
      </div>

      <div className="flex gap-3 mt-6">
        <button className="btn-gold" onClick={transferir}>Confirmar Transferência</button>
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
      </div>
    </Modal>
  );
}
