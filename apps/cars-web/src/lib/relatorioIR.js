/* ============================================================
   RELATÓRIO IR · dados do ano prontos pra declaração

   Junta o que o IRPF pede do investidor:
   1. Bens e direitos — posição por ativo pelo CUSTO de aquisição
      (qtd × preço médio). Atenção: é a posição ATUAL da carteira;
      confira com o informe da corretora antes de declarar.
   2. Rendimentos — proventos recebidos no ano, por ativo e tipo
      (Rendimento de FII e Dividendo são isentos; JCP é tributado).
   3. Vendas — operações do ano, agrupadas por mês (a isenção de
      ações até R$ 20.000/mês fica visível).
   ============================================================ */

import { movimentacoesInvestMes } from "./movimentacoesInvest.js";
import { ASSET_CLASS_LABELS } from "./invest-constants.js";

/** Anos com movimento (transações) — mais recente primeiro. */
export function anosDisponiveisIR(transacoes = []) {
  const anos = new Set();
  (transacoes || []).forEach(t => {
    const a = String(t?.data || "").slice(0, 4);
    if (/^\d{4}$/.test(a)) anos.add(a);
  });
  anos.add(String(new Date().getFullYear()));
  return [...anos].sort().reverse();
}

export function montarRelatorioIR({ ativos = [], transacoes = [], ano }) {
  const anoStr = String(ano || new Date().getFullYear());

  // 1. Bens e direitos (posição atual pelo custo de aquisição)
  const bens = (ativos || [])
    .filter(a => (Number(a?.qtd) || 0) > 0 && (Number(a?.pm ?? a?.precoMedio) || 0) > 0)
    .map(a => {
      const qtd = Number(a.qtd) || 0;
      const pm = Number(a.pm ?? a.precoMedio) || 0;
      return {
        ticker: a.ticker || "—",
        nome: a.nome || "",
        tipo: ASSET_CLASS_LABELS[a.tipo] || a.tipo || "—",
        qtd, pm,
        custo: qtd * pm,
      };
    })
    .sort((a, b) => b.custo - a.custo);
  const totalBens = bens.reduce((s, b) => s + b.custo, 0);

  // 2 e 3. Proventos e vendas do ano (movimentacoesInvestMes com o ANO
  // funciona porque o filtro é por prefixo da data).
  const mov = movimentacoesInvestMes(transacoes, anoStr);

  const provMap = {};
  mov.proventos.forEach(p => {
    const k = `${p.ticker}|${p.tipo}`;
    provMap[k] = provMap[k] || { ticker: p.ticker, tipo: p.tipo, total: 0, qtd: 0 };
    provMap[k].total += p.valor;
    provMap[k].qtd += 1;
  });
  const proventos = Object.values(provMap).sort((a, b) => b.total - a.total);
  const provJCP = proventos.filter(p => p.tipo === "JCP").reduce((s, p) => s + p.total, 0);
  const provIsentos = mov.totalProventos - provJCP;

  const vendasMesMap = {};
  mov.vendas.forEach(v => {
    const m = String(v.data || "").slice(0, 7);
    vendasMesMap[m] = vendasMesMap[m] || { mes: m, total: 0, resultado: 0, ops: 0 };
    vendasMesMap[m].total += v.valor;
    vendasMesMap[m].resultado += Number(v.resultado) || 0;
    vendasMesMap[m].ops += 1;
  });
  const vendasMeses = Object.values(vendasMesMap)
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .map(v => ({ ...v, isento20k: v.total <= 20000 }));

  return {
    ano: anoStr,
    bens, totalBens,
    proventos, totalProventos: mov.totalProventos, provIsentos, provJCP,
    vendas: mov.vendas, vendasMeses,
    totalVendido: mov.totalVendido, resultadoVendas: mov.resultadoVendas,
  };
}
