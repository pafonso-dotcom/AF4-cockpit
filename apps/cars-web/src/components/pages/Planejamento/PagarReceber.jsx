import React, { useState } from "react";
import { T } from "../../../lib/theme.js";
import Despesas from "../Despesas.jsx";
import AReceberEDividas from "../AReceberEDividas.jsx";

/**
 * Tela unificada de pagamento/recebimento.
 * Toggle no topo: "A Pagar" (despesa do mês — fixas/parcelas/dívidas/transações,
 * via Despesas) e "A Receber" (devedores, via AReceberEDividas em modo só-receber).
 * Junta as duas telas antigas (Despesa do Mês + A Receber & Dívidas) numa só.
 */
export default function PagarReceber({ ladoInicial = "pagar", ...props }) {
  const [lado, setLado] = useState(ladoInicial === "receber" ? "receber" : "pagar");

  const opcoes = [
    { id: "pagar",   label: "⚠️ A Pagar",   cor: T.red },
    { id: "receber", label: "💰 A Receber", cor: T.green },
  ];

  return (
    <div>
      <div style={{
        display: "inline-flex", gap: 0, marginBottom: 16,
        background: T.bgSoft, padding: 3, borderRadius: 9, border: `1px solid ${T.border}`,
      }}>
        {opcoes.map(o => {
          const ativo = lado === o.id;
          return (
            <button key={o.id} onClick={() => setLado(o.id)}
              style={{
                padding: "8px 18px", fontSize: 12.5, fontWeight: ativo ? 700 : 500,
                background: ativo ? T.card : "transparent",
                color: ativo ? o.cor : T.muted,
                border: ativo ? `1px solid ${o.cor}55` : "1px solid transparent",
                borderRadius: 7, cursor: "pointer", letterSpacing: ".02em",
                whiteSpace: "nowrap",
              }}>
              {o.label}
            </button>
          );
        })}
      </div>

      {lado === "pagar"
        ? <Despesas {...props} />
        : <AReceberEDividas {...props} somenteReceber />}
    </div>
  );
}
