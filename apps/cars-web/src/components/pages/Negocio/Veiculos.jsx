import React from "react";
import PlaceholderNegocio from "./PlaceholderNegocio.jsx";

/**
 * Veículos: entrada de carro, controle de estoque, registro de venda.
 * Shape pretendido:
 *   negocioVeiculos:     [{ id, placa, modelo, ano, cor, custoEntrada, custosExtra:[], dataEntrada, vendido }]
 *   negocioVendasVeiculos: [{ id, veiculoId, dataVenda, valorVenda, custoTotal, clienteId, contaDestino }]
 */
export default function Veiculos(props) {
  return (
    <PlaceholderNegocio
      eyebrow="Negócio · Veículos"
      titulo="Veículos em estoque"
      sub="Entrada de veículos, custos extras (despachante, vistoria, conserto) e registro de venda."
      roadmap={[
        "Cadastro de entrada (placa, modelo, ano, cor, custo de aquisição, data, fornecedor).",
        "Custos extras por veículo (despachante, vistoria, conserto, despesas) que somam no custo total.",
        "Tabela de estoque com filtro (em estoque / vendidos / todos).",
        "Modal de venda: cliente (busca no cadastro de Clientes), valor, conta destino (cria receita no Finanças automaticamente).",
        "Cálculo de lucro por veículo (venda − custo total) e margem.",
        "Status visual: em estoque, em preparação, vendido.",
      ]}
    />
  );
}
