import React, { useState } from "react";
import { Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, todayISO } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import Modal from "../ui/Modal.jsx";
import Field from "../ui/Field.jsx";
import MoneyInput from "../ui/MoneyInput.jsx";

const MES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const LS_LANCAR_KEY = "fixas-lancar-no-banco";

/**
 * Modal de confirmação de pagamento de uma ocorrência de fixa.
 *
 * Props:
 *  - ocorrencia: ocorrência sendo paga
 *  - fixa: template original (pra acessar descricao, contaPadrao, categoria)
 *  - contas: lista pra select
 *  - onConfirm({ dataPagto, valorPago, lancarNoBanco, conta })
 *  - onClose
 */
export default function ConfirmarPagamentoFixaModal({ ocorrencia, fixa, contas = [], onConfirm, onClose }) {
  const hojeISO = todayISO();

  // Lê última escolha do usuário do localStorage (default: true = lançar)
  const lancarDefault = (() => {
    try {
      const v = localStorage.getItem(LS_LANCAR_KEY);
      return v === null ? true : JSON.parse(v);
    } catch { return true; }
  })();

  const [dataPagto, setDataPagto] = useState(hojeISO);
  const [valorPagoForm, setValorPagoForm] = useState(ocorrencia.valor ?? "");
  const [lancarNoBanco, setLancarNoBanco] = useState(lancarDefault);
  const contaInicial = fixa?.contaPadrao || (contas && contas[0]?.nome) || "";
  const [conta, setConta] = useState(contaInicial);

  const valorPago = Number(valorPagoForm) || 0;

  const [m, a] = (() => {
    const [an, mn] = (ocorrencia.mes || "").split("-");
    return [MES_NOMES[parseInt(mn, 10) - 1] || "?", an || "?"];
  })();

  const confirmar = () => {
    if (valorPago <= 0) {
      toast.error("Valor pago inválido.");
      return;
    }
    if (lancarNoBanco && !conta) {
      toast.error("Selecione uma conta para lançar no banco.");
      return;
    }
    // Persiste preferência
    try { localStorage.setItem(LS_LANCAR_KEY, JSON.stringify(lancarNoBanco)); } catch {}

    onConfirm?.({
      dataPagto,
      valorPago,
      lancarNoBanco,
      conta: lancarNoBanco ? conta : null,
    });
    onClose?.();
  };

  return (
    <Modal title={`Marcar "${fixa.descricao}" como paga?`} onClose={onClose}>
      <div style={{
        background: T.bgSoft, padding: 12, borderRadius: 8, marginBottom: 14,
        fontSize: 12.5, color: T.muted, lineHeight: 1.6,
      }}>
        <strong style={{ color: T.ink }}>{m}/{a}</strong>
        {" · vence dia "}
        <strong style={{ color: T.ink }}>{fixa.diaVencimento}</strong>
        {" · valor previsto "}
        <strong style={{ color: T.ink }}>{fmt(ocorrencia.valor || 0)}</strong>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data do pagamento" required>
          <input type="date" value={dataPagto}
                 onChange={e => setDataPagto(e.target.value)} />
        </Field>
        <Field label="Valor pago (R$)" required hint="Só números · centavos automáticos">
          <MoneyInput value={valorPagoForm} onChange={setValorPagoForm} />
        </Field>
      </div>

      <Field label="Categoria" hint="Da fixa (não editável aqui)">
        <input value={fixa.categoria || "—"} readOnly
               style={{ opacity: 0.7, cursor: "not-allowed" }} />
      </Field>

      {/* Bloco dourado: lançar no banco? */}
      <div style={{
        marginTop: 14, padding: 14,
        background: `${T.gold}11`, border: `1px solid ${T.gold}55`, borderRadius: 8,
      }}>
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={lancarNoBanco}
                 onChange={e => setLancarNoBanco(e.target.checked)}
                 style={{ accentColor: T.gold, marginTop: 3 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>
              Sim, lançar como transação no extrato bancário
            </div>
            {lancarNoBanco && (
              <div style={{ marginTop: 8 }}>
                <select value={conta} onChange={e => setConta(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: "100%", padding: "8px 11px",
                                 background: T.bg, border: `1px solid ${T.border}`,
                                 color: T.ink, fontSize: 12, borderRadius: 6 }}>
                  <option value="">— Selecione a conta —</option>
                  {(contas || []).map(c => (
                    <option key={c.id || c.nome} value={c.nome}>
                      {c.nome}{c.instituicao ? ` (${c.instituicao})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8, lineHeight: 1.5, overflowWrap: "break-word" }}>
              {lancarNoBanco
                ? <>→ Será criada uma transação de <strong>despesa {fmt(valorPago || 0)}</strong> em <strong>{conta || "(conta)"}</strong> no dia {dataPagto}, debitando o saldo.</>
                : <>→ A fixa só será marcada como paga aqui, sem afetar o extrato bancário.</>}
            </div>
          </div>
        </label>
      </div>

      <div className="flex gap-3 justify-end mt-5">
        <button className="btn-ghost" onClick={onClose}>Cancelar</button>
        <button onClick={confirmar}
          style={{
            background: T.green, color: T.bg, border: "none",
            padding: "10px 16px", borderRadius: 7, fontSize: 12,
            letterSpacing: ".08em", textTransform: "uppercase", fontWeight: 600,
            cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6,
          }}>
          <Check size={14} /> Confirmar pagamento
        </button>
      </div>
    </Modal>
  );
}
