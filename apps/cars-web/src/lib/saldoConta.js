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

// Data local AAAA-MM-DD (sem sustos de fuso do toISOString).
const diaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Série do saldo dos últimos N dias (mais antigo → hoje), derivada das
// transações COMPENSADAS: parte do saldo atual e anda pra trás. Alimenta o
// mini-gráfico do card da conta.
export function serieSaldoConta(conta, transacoes = [], dias = 30, hoje = new Date()) {
  const fim = diaLocal(hoje);
  const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - (dias - 1));
  const inicioISO = diaLocal(inicio);

  const deltaPorDia = {};
  for (const t of transacoes || []) {
    if (!t || t.conta !== conta?.nome || !t.compensado) continue;
    const d = String(t.data || "").slice(0, 10);
    if (!d || d > fim || d < inicioISO) continue;
    deltaPorDia[d] = (deltaPorDia[d] || 0) + (t.tipo === "receita" ? 1 : -1) * (Number(t.valor) || 0);
  }

  const serie = new Array(dias);
  let s = Number(conta?.saldo) || 0;
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(d.getDate() - (dias - 1 - i));
    serie[i] = s;             // saldo no FIM deste dia
    s -= deltaPorDia[diaLocal(d)] || 0; // volta pro fim do dia anterior
  }
  return serie;
}

// Lançamentos PENDENTES (não compensados) da conta: quanto o saldo vira
// quando tudo compensar.
export function pendentesDaConta(conta, transacoes = []) {
  let delta = 0, qtd = 0;
  for (const t of transacoes || []) {
    if (!t || t.conta !== conta?.nome || t.compensado) continue;
    delta += (t.tipo === "receita" ? 1 : -1) * (Number(t.valor) || 0);
    qtd += 1;
  }
  return { delta, qtd, saldoApos: (Number(conta?.saldo) || 0) + delta };
}

// Última movimentação da conta (pela data; empate fica com a mais recente
// na lista). null se não há transações.
export function ultimaMovimentacao(conta, transacoes = []) {
  let ult = null;
  for (const t of transacoes || []) {
    if (!t || t.conta !== conta?.nome || !t.data) continue;
    if (!ult || String(t.data) >= String(ult.data)) ult = t;
  }
  if (!ult) return null;
  return { data: ult.data, valor: Number(ult.valor) || 0, tipo: ult.tipo, descricao: ult.descricao || "" };
}
