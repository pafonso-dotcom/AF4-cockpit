import React, { useState } from "react";
import { X, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { todayISO, uid } from "../../lib/format.js";
import { parseValorBR } from "../../lib/importExport.js";
import { toast } from "../../lib/toast.js";

// Impacto da transação no saldo da conta (0 se pendente).
function signed(t) {
  if (!t.compensado) return 0;
  const v = Number(t.valor) || 0;
  return t.tipo === "receita" ? v : -v;
}

/**
 * Modal autossuficiente de criar/editar transação.
 * Salva direto em setTransacoes e ajusta o saldo da conta — sem trocar de tela.
 * Replica a lógica de saldo da página Transações.
 */
export default function NovaTransacaoModal({
  contaFixa,          // conta pré-selecionada (extrato) — opcional
  transacaoEdit,      // transação existente p/ editar — opcional
  contas = [], categorias = [],
  transacoes = [], setTransacoes, setContas,
  onClose,
}) {
  const [form, setForm] = useState(() => transacaoEdit
    ? { ...transacaoEdit, valor: String(transacaoEdit.valor ?? "") }
    : {
        id: null, tipo: "despesa", valor: "", descricao: "", categoria: "",
        conta: contaFixa?.nome || contas[0]?.nome || "",
        data: todayISO(), obs: "", compensado: true, fixa: false, vencimento: null,
      }
  );
  const ehEdicao = !!transacaoEdit;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const salvar = () => {
    if (!form.descricao?.trim()) { toast.error("Descrição é obrigatória."); return; }
    const v = parseValorBR(form.valor);
    if (form.valor === "" || form.valor == null || isNaN(v) || v <= 0) {
      toast.error("Informe um valor positivo (ex.: 1.500,00).");
      return;
    }
    if (!form.categoria) { toast.error("Selecione uma categoria."); return; }
    if (!form.conta) { toast.error("Selecione uma conta."); return; }
    if (!form.data) { toast.error("Informe a data."); return; }

    const oldT = transacoes.find(t => t.id === form.id);
    const novo = { ...form, valor: v };
    const newDelta = signed(novo);
    const oldDelta = oldT ? signed(oldT) : 0;
    const oldConta = oldT?.conta;
    const newConta = novo.conta;

    // Ajuste de saldo (mesma regra da página Transações)
    if (setContas) {
      if (oldConta && oldConta !== newConta && oldDelta !== 0) {
        setContas(contas.map(c => {
          if (c.nome === oldConta) return { ...c, saldo: (Number(c.saldo) || 0) - oldDelta };
          if (c.nome === newConta) return { ...c, saldo: (Number(c.saldo) || 0) + newDelta };
          return c;
        }));
      } else {
        const d = newDelta - oldDelta;
        if (d !== 0) {
          setContas(contas.map(c => c.nome === newConta ? { ...c, saldo: (Number(c.saldo) || 0) + d } : c));
        }
      }
    }

    if (form.id && oldT) {
      setTransacoes(transacoes.map(t => t.id === form.id ? novo : t));
      toast.success("Transação atualizada.");
    } else {
      setTransacoes([{ ...novo, id: uid() }, ...transacoes]);
      toast.success("Transação criada.");
    }
    onClose?.();
  };

  const catsDoTipo = categorias.filter(c => c.tipo === form.tipo);

  const lbl = { fontSize: 10, color: T.muted, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", marginBottom: 4 };
  const inp = { width: "100%", padding: "8px 11px", background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 6 };

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
      display: "grid", placeItems: "center", zIndex: 1000, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto",
        background: T.card, borderRadius: 12, padding: 22,
        width: "100%", maxWidth: 460, border: `1px solid ${T.border}`,
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 9.5, letterSpacing: ".18em", color: T.faint, textTransform: "uppercase", fontWeight: 600 }}>
              {ehEdicao ? "Editar transação" : "Nova transação"}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, marginTop: 4, color: T.ink }}>
              {form.conta || "—"}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        {/* Tipo */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
          {["despesa", "receita"].map(tp => {
            const ativo = form.tipo === tp;
            const cor = tp === "receita" ? T.green : T.red;
            return (
              <button key={tp} onClick={() => set("tipo", tp)}
                style={{
                  padding: "8px", borderRadius: 6, cursor: "pointer",
                  border: `1px solid ${ativo ? cor : T.border}`,
                  background: ativo ? `${cor}22` : "transparent",
                  color: ativo ? cor : T.muted,
                  fontSize: 12, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase",
                }}>
                {tp === "receita" ? "Receita" : "Despesa"}
              </button>
            );
          })}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Descrição</div>
          <input value={form.descricao} onChange={e => set("descricao", e.target.value)}
                 placeholder="Ex.: Mercado, Salário…" style={inp} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={lbl}>Valor (R$)</div>
            <input type="text" inputMode="decimal" value={form.valor}
                   onChange={e => set("valor", e.target.value)}
                   placeholder="1.500,00" style={inp} />
          </div>
          <div>
            <div style={lbl}>Data</div>
            <input type="date" value={form.data} onChange={e => set("data", e.target.value)} style={inp} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
          <div>
            <div style={lbl}>Categoria</div>
            <select value={form.categoria} onChange={e => set("categoria", e.target.value)} style={inp}>
              <option value="">— selecione —</option>
              {catsDoTipo.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
          <div>
            <div style={lbl}>Conta</div>
            <select value={form.conta} onChange={e => set("conta", e.target.value)} style={inp}>
              {contas.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
            </select>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.ink, cursor: "pointer", marginBottom: 14 }}>
          <input type="checkbox" checked={!!form.compensado}
                 onChange={e => set("compensado", e.target.checked)}
                 style={{ width: 15, height: 15, accentColor: T.gold }} />
          Compensada (já entrou/saiu da conta · afeta o saldo)
        </label>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 14px", background: "transparent", border: `1px solid ${T.border}`,
            color: T.muted, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
            letterSpacing: ".05em", textTransform: "uppercase",
          }}>Cancelar</button>
          <button onClick={salvar} style={{
            padding: "8px 14px", background: T.gold, color: T.bg, border: "none",
            borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
            letterSpacing: ".05em", textTransform: "uppercase",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>
            <Check size={13} /> {ehEdicao ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}
