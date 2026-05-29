import React from "react";
import AReceberEDividas from "../AReceberEDividas.jsx";

/**
 * Tela unificada de pagamento/recebimento.
 * Usa o AReceberEDividas (visual com KPIs, buckets de vencimento e toggle
 * "A Pagar | A Receber"). O lado "A Pagar" já agrega fixas + parcelas +
 * variáveis/dívidas; o lado "A Receber" mostra os devedores.
 */
export default function PagarReceber(props) {
  return <AReceberEDividas {...props} />;
}
