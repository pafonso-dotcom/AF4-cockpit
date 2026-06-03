import React from "react";
import Cartoes from "../Cartoes.jsx";

/**
 * View expandida do card "Parcelas em curso".
 * Reaproveita a página Cartões (que tem o painel de parcelamentos integrado).
 */
export default function ParcelasView(props) {
  return <Cartoes {...props} />;
}
