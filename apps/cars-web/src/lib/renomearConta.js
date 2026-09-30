/**
 * Renomear CONTA propagando pros lançamentos (bug 2026-09-30: usuário
 * renomeou "BANCO DA AF4" → "AF4-CARROS" e o extrato ficou vazio — os
 * lançamentos apontam pra conta pelo NOME e viraram órfãos, mas o saldo,
 * que é campo da própria conta, continuou aparecendo).
 *
 * Puro e testável: troca o nome antigo pelo novo em
 *  - transacoes[].conta
 *  - fixas[].contaPadrao
 *  - ativos[].conta  (conta de onde saem os aportes)
 * e devolve as coleções novas + quantos itens mudaram.
 */
export function renomearContaNosLancamentos(de, para, dados = {}) {
  const { transacoes = [], fixas = [], ativos = [] } = dados;
  const antigo = String(de || "").trim();
  const novo = String(para || "").trim();
  let n = 0;
  const troca = (campo) => (o) => {
    if (!o || String(o[campo] || "").trim() !== antigo) return o;
    n += 1;
    return { ...o, [campo]: novo };
  };
  return {
    transacoes: transacoes.map(troca("conta")),
    fixas: fixas.map(troca("contaPadrao")),
    ativos: ativos.map(troca("conta")),
    n,
  };
}
