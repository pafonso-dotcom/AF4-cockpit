// Análise de GASTO por categoria (só consumo). Exclui movimentação de dinheiro
// (investimento, transferência, depósito, aporte, resgate).
//
// FONTE: lista de despesas JÁ AGREGADA do mês (getDespesasDoMes), que unifica as
// 4 fontes — transações, despesas fixas, parcelas de cartão e dívidas. Assim uma
// categoria cujo gasto vem de uma fixa ou do cartão também aparece (antes,
// olhando só `transacoes`, ela sumia).
//
// HIERARQUIA: agrupa por categoria-pai (parentId) com as subcategorias dentro,
// igual à tela de Categorias. Categorias sem pai (ou fora do cadastro) viram
// grupos "solo".
//
// Ajuste avulso: TIRAR (excluir) uma subcategoria de consumo ou COLOCAR (incluir)
// uma categoria que normalmente ficaria de fora. Listas persistidas pela UI.

const NAO_GASTO = /investim|transfer|dep[oó]sito|aporte|resgate/i;

export const mesAnterior = (mesISO) => {
  const [y, m] = String(mesISO || "").split("-").map(Number);
  const d = new Date(y, (m || 1) - 2, 1);
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

// Soma por nome de categoria a partir de itens agregados ({ categoria, valor }).
const agrupar = (itens, filtro) => {
  const m = {};
  (itens || []).forEach((d) => {
    if (d?.transferenciaId) return;
    const k = d?.categoria || "Outros";
    if (filtro && !filtro(k)) return;
    m[k] = (m[k] || 0) + (Number(d?.valor) || 0);
  });
  return m;
};

const variacaoPct = (v, vAnt) => (vAnt > 0 ? ((v - vAnt) / vAnt) * 100 : null);

/**
 * @param {Array<{categoria,valor}>} itensMes   despesas agregadas do mês
 * @param {Array<{categoria,valor}>} itensMesAnt despesas agregadas do mês anterior
 * @param {object} opts
 * @param {string} [opts.mes] / [opts.mesAnt] rótulos "YYYY-MM"
 * @param {string[]} [opts.excluir] / [opts.incluir] ajustes avulsos (nomes)
 * @param {Array<{id,nome,parentId}>} [opts.categorias] cadastro de categorias de
 *   despesa — usado pra montar a hierarquia e listar opções em foraDaAnalise.
 * @returns {{
 *   mes, mesAnt, total, totalAnterior, totalPct:number|null,
 *   grupos: Array<{ nome, valor, valorAnterior, variacao, pct, nova, solo,
 *                   filhos: Array<{ nome, valor, valorAnterior, variacao, pct, nova, forcada }> }>,
 *   foraDaAnalise: Array<{ nome, valor, motivo:"movimentacao"|"manual"|"semGasto" }>,
 *   maiorAlta: object|null
 * }}
 */
export function analiseGastosMes(itensMes = [], itensMesAnt = [], { mes = "", mesAnt = "", excluir = [], incluir = [], categorias: cadastro = [] } = {}) {
  const excSet = new Set(excluir);
  const incSet = new Set(incluir);
  const dentro = (c) => contaComoGasto(c, excSet, incSet);

  const atual = agrupar(itensMes, dentro);
  const ant = agrupar(itensMesAnt, dentro);
  // Categoria colocada à mão (incluir) aparece SEMPRE, mesmo sem gasto no mês —
  // assim o clique no "+" tem retorno visual (entra em R$ 0,00).
  incSet.forEach((nome) => { if (!(nome in atual)) atual[nome] = 0; });

  const total = Object.values(atual).reduce((s, v) => s + v, 0);
  const totalAnterior = Object.values(ant).reduce((s, v) => s + v, 0);

  // Registro do cadastro pra resolver pai/filho (2 níveis).
  const byNome = {};
  const idToNome = {};
  (cadastro || []).forEach((c) => { if (c?.nome) { byNome[c.nome] = c; if (c.id != null) idToNome[c.id] = c.nome; } });
  const grupoDe = (nome) => {
    const c = byNome[nome];
    if (c && c.parentId != null && idToNome[c.parentId]) return idToNome[c.parentId];
    return nome; // raiz ou avulsa (fora do cadastro)
  };

  // Monta grupos: cada folha contada cai no pai (ou em si mesma se raiz/avulsa).
  const gmap = {};
  Object.entries(atual).forEach(([nome, valor]) => {
    const g = grupoDe(nome);
    if (!gmap[g]) gmap[g] = { nome: g, valor: 0, valorAnterior: 0, filhos: [] };
    const valorAnterior = ant[nome] || 0;
    gmap[g].valor += valor;
    gmap[g].valorAnterior += valorAnterior;
    gmap[g].filhos.push({
      nome, valor, valorAnterior,
      variacao: variacaoPct(valor, valorAnterior),
      nova: valor > 0 && valorAnterior === 0,
      forcada: incSet.has(nome),
    });
  });

  const grupos = Object.values(gmap).map((g) => {
    const filhos = g.filhos
      .map((f) => ({ ...f, pct: g.valor > 0 ? (f.valor / g.valor) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);
    return {
      nome: g.nome,
      valor: g.valor,
      valorAnterior: g.valorAnterior,
      variacao: variacaoPct(g.valor, g.valorAnterior),
      pct: total > 0 ? (g.valor / total) * 100 : 0,
      nova: g.valor > 0 && g.valorAnterior === 0,
      solo: filhos.length === 1 && filhos[0].nome === g.nome,
      filhos,
    };
  }).sort((a, b) => b.valor - a.valor);

  // Fora da análise: TODA categoria conhecida que não está contando agora.
  const contadas = new Set(Object.keys(atual));
  const todasDoMes = agrupar(itensMes, null);
  const nomesFora = Array.from(new Set([
    ...Object.keys(todasDoMes),
    ...(cadastro || []).map((c) => c?.nome).filter(Boolean),
  ])).filter((nome) => !contadas.has(nome));
  const motivoDe = (nome) => {
    if (excSet.has(nome)) return "manual";
    if (NAO_GASTO.test(nome)) return "movimentacao";
    return "semGasto";
  };
  const foraDaAnalise = nomesFora
    .map((nome) => ({ nome, valor: todasDoMes[nome] || 0, motivo: motivoDe(nome) }))
    .sort((a, b) => (b.valor - a.valor) || a.nome.localeCompare(b.nome));

  const totalPct = variacaoPct(total, totalAnterior);

  // Destaque: grupo que mais SUBIU em reais vs mês anterior.
  const maiorAlta = grupos
    .filter((g) => g.valorAnterior > 0 && g.valor > g.valorAnterior)
    .sort((a, b) => (b.valor - b.valorAnterior) - (a.valor - a.valorAnterior))[0] || null;

  return { mes, mesAnt, total, totalAnterior, totalPct, grupos, foraDaAnalise, maiorAlta };
}
