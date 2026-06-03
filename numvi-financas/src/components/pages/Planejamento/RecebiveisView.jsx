import React from "react";
import AReceberEDividas from "../AReceberEDividas.jsx";

/**
 * View expandida do card "Recebíveis".
 * Reaproveita AReceberEDividas, que já tem as 2 colunas (Receber + Pagar).
 * (Filtragem específica de "só A Receber" pode ser feita futuramente
 *  via prop dedicada se necessário — por enquanto mostra os 2.)
 */
export default function RecebiveisView(props) {
  return <AReceberEDividas {...props} />;
}
