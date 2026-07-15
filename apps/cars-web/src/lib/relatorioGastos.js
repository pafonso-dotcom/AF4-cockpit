// Relatório de gastos do mês — análise profunda (puro e testável).
// Junta várias óticas sobre o mesmo mês: resumo (taxa de consumo/poupança),
// saúde, composição (fixo/cartão/variável), fora do padrão, concentração,
// recorrentes, projeção de fechamento e sugestões de corte.
//
// Reaproveita diagnosticoMes (fora do padrão + cortes) e totaisPorCategoria.

import { diagnosticoMes } from "./diagnosticoGastos.js";
import { totaisPorCategoria } from "./analiseGastos.js";

const NAO_GASTO = /investim|transfer|dep[oó]sito|aporte|resgate/i;
const money = (v) => Number(v) || 0;
const consumo = (it) => !NAO_GASTO.test(it?.categoria || "") && !it?.transferenciaId;

// De qual "fonte" veio a despesa → fixo / cartão / variável.
function classeFonte(it) {
  if (it.fonte === "fixa") return "fixo";
  if (it.fonte === "parcela") return "cartao";
  if (it.fonte === "divida") return "variavel";
  if (it.fonte === "transacao") {
    if (it.tipo === "parcela") return "cartao";
    if (it.tipo === "fixa") return "fixo";
    return "variavel";
  }
  return "variavel";
}

/**
 * @param {object} p
 * @param {Array} p.itensMes        itens de getDespesasDoMes do mês
 * @param {Array<object>} p.historicoCats  totais por categoria dos meses anteriores
 * @param {number} p.receitaMes     receita realizada do mês
 * @param {Array} p.categorias      cadastro (pra ler limites de orçamento)
 * @param {Array} p.fixas           fixas do escopo (recorrentes)
 * @param {string} [p.hojeISO]      YYYY-MM-DD (pra projeção do mês corrente)
 * @param {boolean} [p.ehMesCorrente]
 */
export function montarRelatorioGastos(p = {}) {
  const mesCats = totaisPorCategoria(p.itensMes || [], p.ajuste || {});
  const contadas = new Set(Object.keys(mesCats));
  // Itens que entram no gasto (respeita o ajuste de include/exclude).
  const itensMes = (p.itensMes || []).filter((it) => contadas.has(it.categoria || "Outros"));
  const diag = diagnosticoMes(mesCats, p.historicoCats || []);

  const totalMes = diag.totalMes;
  const receitaMes = p.receitaMes != null ? money(p.receitaMes) : money(p.entradas && p.entradas.total);
  const poupanca = receitaMes - totalMes;
  const taxaConsumo = receitaMes > 0 ? (totalMes / receitaMes) * 100 : null;
  const pctPoupanca = receitaMes > 0 ? (poupanca / receitaMes) * 100 : null;

  // Composição por fonte
  const comp = { fixo: 0, cartao: 0, variavel: 0 };
  itensMes.forEach((it) => { comp[classeFonte(it)] += money(it.valor); });
  const composicao = ["fixo", "cartao", "variavel"].map((k) => ({
    classe: k, valor: comp[k], pct: totalMes > 0 ? (comp[k] / totalMes) * 100 : 0,
  }));

  // Concentração (top 3 categorias)
  const ordenadas = Object.entries(mesCats).map(([nome, valor]) => ({ nome, valor: money(valor) }))
    .sort((a, b) => b.valor - a.valor);
  const top3 = ordenadas.slice(0, 3);
  const somaTop3 = top3.reduce((s, c) => s + c.valor, 0);
  const concentracaoPct = totalMes > 0 ? (somaTop3 / totalMes) * 100 : 0;

  // Recorrentes (fixas de consumo)
  const recorrentes = (p.fixas || [])
    .filter((f) => !NAO_GASTO.test(f.categoria || "") && money(f.valor) > 0)
    .map((f) => ({ nome: f.descricao || f.categoria || "Fixa", valor: money(f.valor), dia: f.diaVencimento || null }))
    .sort((a, b) => b.valor - a.valor);
  const recorrentesTotal = recorrentes.reduce((s, r) => s + r.valor, 0);

  // Orçamento estourado
  const cadDesp = (p.categorias || []).filter((c) => (!c.tipo || c.tipo === "despesa") && money(c.limite) > 0);
  const estouros = cadDesp
    .map((c) => ({ nome: c.nome, limite: money(c.limite), gasto: money(mesCats[c.nome]) }))
    .filter((c) => c.gasto > c.limite);

  // Projeção de fechamento (mês corrente)
  let fechamentoPrevisto = totalMes, realizado = totalMes, aVencer = 0;
  if (p.ehMesCorrente && p.hojeISO) {
    realizado = itensMes.filter((it) => (it.data || "") <= p.hojeISO || it.status === "paga")
      .reduce((s, it) => s + money(it.valor), 0);
    aVencer = Math.max(0, totalMes - realizado);
    fechamentoPrevisto = totalMes;
  }

  // Saúde do mês (score + checagens)
  const chk = (estado, texto, detalhe) => ({ estado, texto, detalhe });
  const checks = [];
  if (pctPoupanca != null) {
    checks.push(pctPoupanca >= 20 ? chk("ok", `Você poupou ${pctPoupanca.toFixed(0)}% da renda`, "acima de 20%, saudável")
      : pctPoupanca >= 10 ? chk("warn", `Poupou ${pctPoupanca.toFixed(0)}% da renda`, "abaixo do ideal (20%)")
      : chk("bad", pctPoupanca >= 0 ? `Poupou só ${pctPoupanca.toFixed(0)}% da renda` : "Gastou mais do que ganhou", "atenção com o fluxo"));
  }
  if (diag.pctTotal != null) {
    checks.push(diag.pctTotal <= 5 ? chk("ok", "Gasto dentro do seu normal", "em linha com a média de 6 meses")
      : diag.pctTotal <= 20 ? chk("warn", `Gasto ${diag.pctTotal.toFixed(0)}% acima do normal`, diag.maiorAlta ? `puxado por ${diag.maiorAlta.categoria}` : "")
      : chk("bad", `Gasto ${diag.pctTotal.toFixed(0)}% acima do normal`, diag.maiorAlta ? `puxado por ${diag.maiorAlta.categoria}` : ""));
  }
  checks.push(concentracaoPct < 50 ? chk("ok", "Gastos bem distribuídos", `top 3 = ${concentracaoPct.toFixed(0)}%`)
    : concentracaoPct <= 65 ? chk("warn", "Concentração média", `top 3 categorias = ${concentracaoPct.toFixed(0)}% do gasto`)
    : chk("bad", "Concentração alta", `top 3 categorias = ${concentracaoPct.toFixed(0)}% do gasto`));
  checks.push(estouros.length === 0 ? chk("ok", "Nenhuma categoria estourou o orçamento", cadDesp.length ? "" : "sem limites definidos")
    : chk("bad", `${estouros.length} categoria${estouros.length > 1 ? "s" : ""} estourou o orçamento`, estouros.map((e) => e.nome).join(", ")));

  const nota = { ok: 100, warn: 60, bad: 25 };
  const score = checks.length ? Math.round(checks.reduce((s, c) => s + nota[c.estado], 0) / checks.length) : null;

  return {
    ...diag,
    receitaMes, entradas: p.entradas || null, poupanca, taxaConsumo, pctPoupanca,
    composicao, concentracaoPct, top3,
    recorrentes, recorrentesTotal,
    estouros,
    fechamentoPrevisto, realizado, aVencer,
    checks, score,
  };
}
