/**
 * DRE visual — Demonstração do Resultado do mês em cascata.
 *
 * Monta, a partir dos agregadores que o app já usa (getDespesasDoMes /
 * getGanhosDoMes), a estrutura clássica:
 *   Receitas → (−) fixas → (−) variáveis → (−) cartões
 *   (=) Sobra operacional → (+) proventos → (=) Resultado do mês
 *
 * Puro e testável. Convenções herdadas do agregador (mesmas da Análise do
 * mês): fatura importada em aberto entra como bolo único no cartão; baixas
 * ligadas a fonte não duplicam; escopo pessoal × negócio via aplicarEscopo.
 */
import { getDespesasDoMes, getGanhosDoMes } from "./agregador.js";
import { ehProventoTx } from "./movimentacoesInvest.js";

const soma = (itens) => itens.reduce((s, x) => s + (Number(x.valor) || 0), 0);
const top = (itens, n = 6) =>
  [...itens].sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0)).slice(0, n)
    .map(x => ({ descricao: x.descricao || x.categoria || "—", valor: Number(x.valor) || 0 }));

/**
 * @returns {{
 *  receitas, fixas, variaveis, cartoes, sobraOperacional, proventos, resultado,
 *  detalhe: { receitas:[], fixas:[], variaveis:[], cartoes:[], proventos:[] }
 * }} — todos os valores em número; detalhe traz os maiores itens de cada grupo.
 */
export function montarDRE(mesISO, state = {}, escopo = "tudo", { carteiraProventos = null } = {}) {
  const despesas = getDespesasDoMes(mesISO, state, escopo);
  const ganhos = getGanhosDoMes(mesISO, state, escopo);

  // Cartão: parcelas/fatura (fonte "parcela") + transações avulsas com cartaoId
  // (o item do agregador não carrega cartaoId — reconstruímos pelo id, mesma
  // técnica do relatorioMensal.js).
  const cartaoTxIds = new Set((state.transacoes || []).filter(t => t && t.cartaoId).map(t => t.id));
  const ehCartao = (d) => d.fonte === "parcela" || cartaoTxIds.has(d.id);

  const itensFixas = despesas.filter(d => d.tipo === "fixa" && !ehCartao(d));
  const itensCartao = despesas.filter(ehCartao);
  const itensVariaveis = despesas.filter(d => d.tipo !== "fixa" && !ehCartao(d));

  // Proventos: receitas de provento (regex do movimentacoesInvest) saem da
  // linha de receitas e ganham linha própria; recebimentos na carteirinha de
  // proventos (fora de conta) somam também.
  const proventoTxIds = new Set((state.transacoes || []).filter(t => t && ehProventoTx(t)).map(t => t.id));
  const itensProvTx = ganhos.filter(g => g.fonte === "transacao" && proventoTxIds.has(g.id));
  const itensReceita = ganhos.filter(g => !(g.fonte === "transacao" && proventoTxIds.has(g.id)));
  const provCarteira = (carteiraProventos?.historico || [])
    .filter(h => h && h.tipo === "recebimento" && String(h.data || "").startsWith(mesISO))
    .map(h => ({ descricao: h.descricao || h.ticker || "Provento (carteira)", valor: Number(h.valor) || 0 }));

  const receitas = soma(itensReceita);
  const fixas = soma(itensFixas);
  const variaveis = soma(itensVariaveis);
  const cartoes = soma(itensCartao);
  const proventos = soma(itensProvTx) + soma(provCarteira);
  const sobraOperacional = receitas - fixas - variaveis - cartoes;
  const resultado = sobraOperacional + proventos;

  return {
    receitas, fixas, variaveis, cartoes, sobraOperacional, proventos, resultado,
    detalhe: {
      receitas: top(itensReceita),
      fixas: top(itensFixas),
      variaveis: top(itensVariaveis),
      cartoes: top(itensCartao),
      proventos: top([...itensProvTx, ...provCarteira]),
    },
  };
}
