// Helper central da conta "Banco da Loja" — usada por toda a Loja AF4
// (compra de veículo, venda, despesas, cheques compensados, etc.)

export const NOME_BANCO_LOJA = "Banco da Loja · CC";

export function getContaLoja(contas = []) {
  if (!Array.isArray(contas) || contas.length === 0) return null;
  // 1) match exato
  let c = contas.find(x => x.nome === NOME_BANCO_LOJA);
  if (c) return c;
  // 2) match por flag dedicada
  c = contas.find(x => x?.bancoLoja === true);
  if (c) return c;
  // 3) match por nome contendo "Banco da Loja"
  c = contas.find(x => /banco da loja/i.test(x?.nome || ""));
  if (c) return c;
  return null;
}

export function getContaLojaNome(contas = [], fallback = "") {
  return getContaLoja(contas)?.nome || fallback || (contas[0]?.nome ?? "");
}

// Garante que a conta "Banco da Loja · CC" exista. Retorna a lista (mutada se necessário).
// Idempotente — se já existe não cria duplicata, e respeita o escopo que o usuário
// tiver definido (não sobrescreve). O default "negocio" só é aplicado na criação.
export function ensureContaLoja(contas = [], { uid }) {
  const existente = getContaLoja(contas);
  if (existente) {
    return contas;
  }
  const nova = {
    id: uid?.() || `bancoloja-${Date.now()}`,
    nome: NOME_BANCO_LOJA,
    instituicao: "Loja AF4",
    tipo: "corrente",
    escopo: "negocio",
    saldo: 0,
    cor: "#c9a96b",
    bancoLoja: true,
    createdAt: new Date().toISOString(),
  };
  return [...contas, nova];
}
