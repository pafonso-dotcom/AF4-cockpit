import React from "react";
import { T } from "../../../lib/theme.js";
import Despesas from "../Despesas.jsx";
import AReceberEDividas from "../AReceberEDividas.jsx";

/**
 * Tela unificada de pagamento/recebimento — TUDO numa página só (sem toggle):
 *  - Seção "A Pagar": despesa do mês (fixas + variáveis + parcelas + dívidas),
 *    com KPIs e botão Pagar — via <Despesas/> (que já tem o próprio cabeçalho).
 *  - Seção "A Receber": devedores (cobrar/WhatsApp/parcial) — via
 *    <AReceberEDividas somenteReceber/>.
 * Junta as duas telas antigas (Despesa do Mês + A Receber & Dívidas).
 */
export default function PagarReceber(props) {
  return (
    <div>
      {/* === A PAGAR (Despesa do mês: fixas + variáveis + parcelas) === */}
      <Despesas {...props} />

      {/* === A RECEBER (devedores) === */}
      <div style={{ marginTop: 8 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          margin: "8px 0 14px",
        }}>
          <span style={{ fontSize: 18 }}>💰</span>
          <h2 style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 400, color: T.green }}>
            A Receber
          </h2>
          <div style={{ flex: 1, height: 1, background: T.border }} />
        </div>
        <AReceberEDividas {...props} somenteReceber />
      </div>
    </div>
  );
}
