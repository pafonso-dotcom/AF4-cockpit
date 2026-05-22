import React from "react";
import Despesas from "../Despesas.jsx";

/**
 * View expandida do card "Despesas do mês".
 * Usa a tela unificada Despesas (Fixas + Variáveis + Parcelas).
 */
export default function DespesasView(props) {
  return <Despesas {...props} />;
}
