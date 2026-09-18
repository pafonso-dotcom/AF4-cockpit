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
const diaLocal = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

// Vencimento da parcela N de juros: dataEmprestimo + N meses (dia limitado
// a 28 pra não pular fevereiro).
function vencimentoParcela(dataEmprestimo, n) {
  const [y, m, d] = String(dataEmprestimo).slice(0, 10).split("-").map(Number);
  if (!y || !m) return null;
  const dt = new Date(y, m - 1 + n, Math.min(d || 1, 28));
  return diaLocal(dt);
}

function resumoDeUm(d, hoje = new Date()) {
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

  // CRONOGRAMA das parcelas de juros (quando o empréstimo é mensal com prazo):
  // parcela N vence em dataEmprestimo + N meses. Status: "recebida" (as
  // primeiras, na ordem dos lançamentos), "atrasada" (venceu e não recebeu)
  // ou "prevista". Empréstimo quitado não tem atraso.
  const hojeISO = diaLocal(hoje);
  let cronograma = [];
  if (jurosMensal > 0 && meses > 0 && d.dataEmprestimo && !d.recebido) {
    cronograma = Array.from({ length: meses }, (_, i) => {
      const n = i + 1;
      const venc = vencimentoParcela(d.dataEmprestimo, n);
      const recebida = jurosLancamentos[i] || null;
      const status = recebida ? "recebida" : (venc && venc < hojeISO ? "atrasada" : "prevista");
      return { n, venc, valor: jurosMensal, status, dataRecebida: recebida?.data || null };
    });
  } else if (jurosMensal > 0 && meses > 0 && d.dataEmprestimo) {
    cronograma = Array.from({ length: meses }, (_, i) => ({
      n: i + 1, venc: vencimentoParcela(d.dataEmprestimo, i + 1),
      valor: jurosMensal, status: "recebida", dataRecebida: jurosLancamentos[i]?.data || null,
    }));
  }
  const atrasadas = cronograma.filter(p => p.status === "atrasada");
  const jurosAtrasado = +atrasadas.reduce((s, p) => s + p.valor, 0).toFixed(2);

  // % já retornado do total combinado (principal + juros previstos).
  const totalCombinado = principal + jurosPrevisto;
  const retornadoPct = totalCombinado > 0
    ? Math.min(100, ((jurosRecebido + principalRecebido + (d.recebido ? principalAberto : 0)) / totalCombinado) * 100)
    : 0;

  return {
    id: d.id, nome: d.nome || "—",
    principal, jurosMensal, meses, jurosPrevisto,
    jurosRecebido, jurosAReceber, principalRecebido, principalAberto,
    rendimentoPct, quitado: !!d.recebido,
    dataEmprestimo: d.dataEmprestimo || null, vencimento: d.vencimento || null,
    jurosLancamentos,
    cronograma, atrasadas: atrasadas.length, jurosAtrasado, retornadoPct,
  };
}

/**
 * Resumo geral dos empréstimos.
 * @param {Array} devedores  lista de devedores (empréstimos são os com emprestimo=true)
 */
export function resumoEmprestimos(devedores = [], hoje = new Date()) {
  const emprestimos = (devedores || [])
    .filter(d => d && d.emprestimo)
    .map(d => resumoDeUm(d, hoje))
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
  const totalJurosAtrasado = +emprestimos.reduce((s, e) => s + (e.jurosAtrasado || 0), 0).toFixed(2);
  const parcelasAtrasadas = emprestimos.reduce((s, e) => s + (e.atrasadas || 0), 0);

  return {
    emprestimos,
    abertos: emprestimos.filter(e => !e.quitado).length,
    totalEmprestado, totalJurosRecebido, totalJurosAReceber,
    totalPrincipalAberto, rendimentoMedioPct,
    totalJurosAtrasado, parcelasAtrasadas,
  };
}
