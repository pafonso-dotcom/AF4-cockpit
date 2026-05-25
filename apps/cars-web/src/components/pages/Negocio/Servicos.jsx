import React from "react";
import PlaceholderNegocio from "./PlaceholderNegocio.jsx";

/**
 * Serviços: catálogo de serviços (preço, custo) + registro de venda.
 * Shape pretendido:
 *   negocioServicos:        [{ id, nome, descricao, precoSugerido, custoBase, ativo }]
 *   negocioVendasServicos:  [{ id, servicoId, data, valor, custo, clienteId, veiculoId?, contaDestino, obs }]
 */
export default function Servicos(props) {
  return (
    <PlaceholderNegocio
      eyebrow="Negócio · Serviços"
      titulo="Serviços e vendas"
      sub="Catálogo de serviços (mecânica, lavagem, etc) com preço e custo + histórico de vendas avulsas."
      roadmap={[
        "Catálogo: cadastro de serviços (nome, descrição, preço sugerido, custo base, ativo/inativo).",
        "Registro de venda avulsa: escolhe serviço do catálogo OU avulso, ajusta preço/custo, vincula a cliente (opcional) e a um veículo do estoque (opcional).",
        "Lista de vendas com filtro por período + cliente + serviço.",
        "Cria receita no Finanças automaticamente (mesma mecânica da venda de veículo).",
        "Cálculo de margem por tipo de serviço + ranking dos mais lucrativos.",
      ]}
    />
  );
}
