/**
 * Calculadora de variação Mês-a-Mês (Month-over-Month).
 *
 * Uso: const v = calcMoMTransacoes(transacoes, { tipo: "despesa" });
 *      // → { atual: 8420, anterior: 7510, pct: 12.1, label: "vs abril" }
 */

const NOMES_MES = [
  "janeiro","fevereiro","março","abril","maio","junho",
  "julho","agosto","setembro","outubro","novembro","dezembro",
];

/**
 * Retorna ISO da chave YYYY-MM do mês atual e do mês anterior.
 */
export function chavesMes(ref = new Date()) {
  const atual = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  const ant = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  const anterior = `${ant.getFullYear()}-${String(ant.getMonth() + 1).padStart(2, "0")}`;
  return {
    atual,
    anterior,
    nomeAtual: NOMES_MES[ref.getMonth()],
    nomeAnterior: NOMES_MES[ant.getMonth()],
  };
}

/**
 * Calcula variação entre 2 valores.
 *   pct: número (-100 a +∞)
 *   label: "vs abril" pré-formatado
 *   goodIfUp: heurística sobre se subir é bom
 */
export function calcVariacao(atual, anterior, opts = {}) {
  const a = Number(atual) || 0;
  const b = Number(anterior) || 0;
  const pct = b !== 0 ? ((a - b) / Math.abs(b)) * 100 : (a === 0 ? 0 : 100);
  const { nomeAnterior } = chavesMes();
  return {
    atual: a,
    anterior: b,
    delta: a - b,
    pct: Math.round(pct * 10) / 10,
    label: opts.label || `vs ${nomeAnterior}`,
    goodIfUp: opts.goodIfUp !== false, // default: subir é bom (receitas, patrimônio)
  };
}

/**
 * Soma transações de um mês específico.
 */
export function somaMes(transacoes, mesKey, filtro = {}) {
  return transacoes
    .filter(t => (t.data || "").startsWith(mesKey))
    .filter(t => !filtro.tipo || t.tipo === filtro.tipo)
    .filter(t => !filtro.categoria || t.categoria === filtro.categoria)
    .filter(t => filtro.compensadoOnly === undefined || t.compensado === filtro.compensadoOnly)
    .reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
}

/**
 * MoM de transações por tipo.
 * Subir despesa = ruim. Subir receita = bom.
 */
export function calcMoMTransacoes(transacoes, filtro = {}) {
  const { atual, anterior } = chavesMes();
  const a = somaMes(transacoes, atual, filtro);
  const b = somaMes(transacoes, anterior, filtro);
  const goodIfUp = filtro.tipo !== "despesa"; // subir despesa é ruim
  return calcVariacao(a, b, { goodIfUp });
}

/**
 * MoM de vendas (Loja).
 */
export function calcMoMVendas(vendas, campo = "valorVenda") {
  const { atual, anterior } = chavesMes();
  const noMes = (mk) => vendas
    .filter(v => (v.dataVenda || "").startsWith(mk))
    .reduce((s, v) => s + (parseFloat(v[campo]) || 0), 0);
  return calcVariacao(noMes(atual), noMes(anterior), { goodIfUp: true });
}

/**
 * MoM de contagem (ex: número de vendas no mês).
 */
export function calcMoMContagem(itens, dataCampo, mesKey) {
  const { atual, anterior } = chavesMes();
  const contaMes = (mk) => itens.filter(i => (i[dataCampo] || "").startsWith(mk)).length;
  return calcVariacao(contaMes(atual), contaMes(anterior), { goodIfUp: true });
}
