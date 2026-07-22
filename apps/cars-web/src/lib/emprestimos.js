// ============================================================
// EMPRÉSTIMOS — motor puro (sem React)
// Lê os empréstimos (devedores com `emprestimo: true`) e resume, por
// empréstimo e no total: quanto foi emprestado (principal), quanto já rendeu
// de juros (recebidos, com datas), quanto ainda falta de juros e o principal
// em aberto.
// ============================================================

// Um empréstimo é um `devedor` com emprestimo=true. Campos usados:
//   principal, jurosMensal, meses, juros (total previsto), dataEmprestimo,
//   vencimento, recebido (principal quitado?), recebimentos[] (cada um:
//   { tipo:"juros"|"principal", valor, data, mesJuros? }).
function resumoDeUm(d) {
  const principal = Number(d.principal ?? d.valor) || 0;
  const jurosMensal = Number(d.jurosMensal) || 0;
  const meses = Number(d.meses) || 0;
  const jurosPrevisto = jurosMensal > 0 ? +(jurosMensal * meses).toFixed(2) : (Number(d.juros) || 0);

  const recebimentos = Array.isArray(d.recebimentos) ? d.recebimentos : [];
  const jurosLancamentos = recebimentos
    .filter(r => r && r.tipo === "juros")
    .map(r => ({ data: r.data || null, mes: r.mesJuros || null, valor: Number(r.valor) || 0 }))
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const jurosRecebido = jurosLancamentos.reduce((s, r) => s + r.valor, 0);
  const principalRecebido = recebimentos
    .filter(r => r && r.tipo === "principal")
    .reduce((s, r) => s + (Number(r.valor) || 0), 0);

  const jurosAReceber = Math.max(0, +(jurosPrevisto - jurosRecebido).toFixed(2));
  const principalAberto = d.recebido ? 0 : Math.max(0, +(principal - principalRecebido).toFixed(2));
  const rendimentoPct = principal > 0 ? (jurosRecebido / principal) * 100 : 0;

  return {
    id: d.id, nome: d.nome || "—",
    principal, jurosMensal, meses, jurosPrevisto,
    jurosRecebido, jurosAReceber, principalRecebido, principalAberto,
    rendimentoPct, quitado: !!d.recebido,
    dataEmprestimo: d.dataEmprestimo || null, vencimento: d.vencimento || null,
    jurosLancamentos,
  };
}

/**
 * Resumo geral dos empréstimos.
 * @param {Array} devedores  lista de devedores (empréstimos são os com emprestimo=true)
 */
export function resumoEmprestimos(devedores = []) {
  const emprestimos = (devedores || [])
    .filter(d => d && d.emprestimo)
    .map(resumoDeUm)
    // abertos primeiro, depois por data do empréstimo (mais recente no topo)
    .sort((a, b) => {
      if (a.quitado !== b.quitado) return a.quitado ? 1 : -1;
      return (b.dataEmprestimo || "").localeCompare(a.dataEmprestimo || "");
    });

  const totalEmprestado = emprestimos.reduce((s, e) => s + e.principal, 0);
  const totalJurosRecebido = emprestimos.reduce((s, e) => s + e.jurosRecebido, 0);
  const totalJurosAReceber = emprestimos.reduce((s, e) => s + e.jurosAReceber, 0);
  const totalPrincipalAberto = emprestimos.reduce((s, e) => s + e.principalAberto, 0);
  const rendimentoMedioPct = totalEmprestado > 0 ? (totalJurosRecebido / totalEmprestado) * 100 : 0;

  return {
    emprestimos,
    abertos: emprestimos.filter(e => !e.quitado).length,
    totalEmprestado, totalJurosRecebido, totalJurosAReceber,
    totalPrincipalAberto, rendimentoMedioPct,
  };
}
