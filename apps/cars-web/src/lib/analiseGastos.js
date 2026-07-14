// Análise de GASTO por categoria (só consumo). Exclui movimentação de dinheiro
// (investimento, transferência, depósito, aporte, resgate) e transferências.
// Compara o mês com o anterior por categoria e no total.
//
// Ajuste avulso: o usuário pode TIRAR uma categoria de consumo da análise
// (excluir) ou COLOCAR uma categoria de movimentação que normalmente ficaria
// de fora (incluir). Essas listas vêm de fora e são persistidas pela UI.

const NAO_GASTO = /investim|transfer|dep[oó]sito|aporte|resgate/i;

const mesAnterior = (mesISO) => {
  const [y, m] = mesISO.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Uma categoria conta como gasto quando:
//  - não está na lista "excluir" (tirada à mão), E
//  - é consumo (não casa NAO_GASTO) OU foi colocada à mão em "incluir".
const contaComoGasto = (cat, excSet, incSet) => {
  const c = cat || "Outros";
  if (excSet.has(c)) return false;
  if (incSet.has(c)) return true;
  return !NAO_GASTO.test(c);
};

/**
 * @param {object} opts
 * @param {string} [opts.mesISO]
 * @param {string[]} [opts.excluir] categorias tiradas à mão
 * @param {string[]} [opts.incluir] categorias de movimentação colocadas à mão
 * @param {string[]} [opts.categorias] todas as categorias conhecidas (nomes) —
 *   entram como opção em foraDaAnalise mesmo sem gasto no mês.
 * @returns {{
 *   mes, mesAnt, total, totalAnterior, totalPct:number|null,
 *   categorias: Array<{ nome, valor, pct, valorAnterior, variacao:number|null, nova:boolean, forcada:boolean }>,
 *   foraDaAnalise: Array<{ nome, valor, motivo:"movimentacao"|"manual"|"semGasto" }>,
 *   maiorAlta: object|null
 * }}
 * variacao = % vs mês anterior; null quando a categoria não existia (nova).
 */
export function analiseGastosMes(transacoes = [], { mesISO, excluir = [], incluir = [], categorias: categoriasConhecidas = [] } = {}) {
  const mes = mesISO || new Date().toISOString().slice(0, 7);
  const mesAnt = mesAnterior(mes);
  const excSet = new Set(excluir);
  const incSet = new Set(incluir);

  const despesasDoMes = (mk) => (transacoes || []).filter(
    (t) => t?.tipo === "despesa"
      && String(t?.data || "").startsWith(mk)
      && !t?.transferenciaId,
  );
  const agrupar = (arr, filtro) => {
    const m = {};
    arr.forEach((t) => {
      const k = t.categoria || "Outros";
      if (filtro && !filtro(k)) return;
      m[k] = (m[k] || 0) + (Number(t.valor) || 0);
    });
    return m;
  };

  const dentro = (c) => contaComoGasto(c, excSet, incSet);
  const atual = agrupar(despesasDoMes(mes), dentro);
  const ant = agrupar(despesasDoMes(mesAnt), dentro);
  const total = Object.values(atual).reduce((s, v) => s + v, 0);
  const totalAnterior = Object.values(ant).reduce((s, v) => s + v, 0);

  const categorias = Object.entries(atual).map(([nome, valor]) => {
    const valorAnterior = ant[nome] || 0;
    const nova = valorAnterior === 0;
    const variacao = valorAnterior > 0 ? ((valor - valorAnterior) / valorAnterior) * 100 : null;
    return {
      nome, valor, pct: total > 0 ? (valor / total) * 100 : 0,
      valorAnterior, variacao, nova, forcada: incSet.has(nome),
    };
  }).sort((a, b) => b.valor - a.valor);

  // Fora da análise: TODA categoria conhecida que não está contando agora — para
  // a UI oferecer como opção de "colocar". Inclui as com gasto no mês que ficaram
  // de fora (movimentação/manual) e também as sem gasto no mês (semGasto).
  const contadas = new Set(Object.keys(atual));
  const todasDoMes = agrupar(despesasDoMes(mes), null);
  const nomesFora = Array.from(new Set([
    ...Object.keys(todasDoMes),
    ...(categoriasConhecidas || []),
  ])).filter((nome) => !contadas.has(nome));
  const motivoDe = (nome) => {
    if (excSet.has(nome)) return "manual";
    if (NAO_GASTO.test(nome)) return "movimentacao";
    return "semGasto";
  };
  const foraDaAnalise = nomesFora
    .map((nome) => ({ nome, valor: todasDoMes[nome] || 0, motivo: motivoDe(nome) }))
    .sort((a, b) => (b.valor - a.valor) || a.nome.localeCompare(b.nome));

  const totalPct = totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : null;

  // Destaque: maior ALTA em reais vs mês anterior (o que mais "pesou a mais").
  const maiorAlta = categorias
    .filter((c) => c.valorAnterior > 0 && c.valor > c.valorAnterior)
    .sort((a, b) => (b.valor - b.valorAnterior) - (a.valor - a.valorAnterior))[0] || null;

  return { mes, mesAnt, total, totalAnterior, totalPct, categorias, foraDaAnalise, maiorAlta };
}
