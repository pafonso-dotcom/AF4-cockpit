// Helpers para calcular o saldo "verdadeiro" de uma conta
// a partir de saldoInicial + transações compensadas.
//
// Usado pelo botão "Reconciliar saldos" na página Contas
// para corrigir contas que dessincronizaram por bugs anteriores.

export function calcSaldoConta(conta, transacoes = []) {
  const inicial = Number(conta.saldoInicial != null ? conta.saldoInicial : 0);
  const txs = transacoes.filter(t => t.conta === conta.nome && t.compensado);

  let saldo = inicial;
  for (const t of txs) {
    const v = Number(t.valor) || 0;
    saldo += t.tipo === "receita" ? v : -v;
  }
  return saldo;
}

// Reconcilia todas as contas: para cada uma, calcula o saldo "verdadeiro"
// e guarda o saldoInicial atual (caso ainda não exista) baseado no saldo
// armazenado menos as transações já lançadas.
//
// Modo de operação:
//  - Se a conta JÁ TEM saldoInicial → recalcula saldo = saldoInicial + transações
//  - Se NÃO TEM → infere saldoInicial = saldoArmazenado − transações compensadas
//
// Retorna { contas: novaLista, mudancas: [{nome, antigo, novo, delta}] }
export function reconciliarContas(contas = [], transacoes = []) {
  const mudancas = [];
  const novaLista = contas.map(c => {
    const antigo = Number(c.saldo) || 0;
    const txs = transacoes.filter(t => t.conta === c.nome && t.compensado);
    const somaTx = txs.reduce(
      (s, t) => s + (t.tipo === "receita" ? (Number(t.valor) || 0) : -(Number(t.valor) || 0)),
      0
    );

    let saldoInicial;
    if (c.saldoInicial != null) {
      saldoInicial = Number(c.saldoInicial);
    } else {
      // Inferir: se o saldo armazenado já reflete as transações,
      // então saldoInicial = saldoArmazenado − somaTx.
      saldoInicial = antigo - somaTx;
    }

    const novo = saldoInicial + somaTx;
    if (Math.abs(antigo - novo) > 0.005) {
      mudancas.push({ nome: c.nome, antigo, novo, delta: novo - antigo });
    }
    return { ...c, saldoInicial, saldo: novo };
  });

  return { contas: novaLista, mudancas };
}
