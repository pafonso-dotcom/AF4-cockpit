import React from "react";
import PlaceholderNegocio from "./PlaceholderNegocio.jsx";

/**
 * Clientes: cadastro básico de clientes vinculáveis a vendas.
 * Shape pretendido:
 *   negocioClientes: [{ id, nome, doc, telefone, email, obs, criadoEm }]
 */
export default function Clientes(props) {
  return (
    <PlaceholderNegocio
      eyebrow="Negócio · Clientes"
      titulo="Clientes"
      sub="Cadastro simples (nome, contato, CPF/CNPJ) usado nas vendas de veículos e serviços."
      roadmap={[
        "Cadastro: nome, CPF/CNPJ, telefone, email, observações.",
        "Lista com busca por nome/doc.",
        "Histórico do cliente: veículos comprados + serviços contratados + valor total.",
        "Edição e exclusão (com aviso se o cliente tem vendas vinculadas).",
      ]}
    />
  );
}
