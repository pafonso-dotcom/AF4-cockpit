/* ============================================================
   SNAPSHOT DA CARTEIRA · posição congelada numa data

   O relatório IR precisa da posição em 31/12 do ano-base, mas a
   carteira do app é viva (muda a cada aporte). O snapshot congela
   a foto de hoje — ticker, qtd, PM, preço — pra consulta futura.
   Coleção persistida `snapshotsCarteira` (sincroniza entre
   aparelhos como as demais).
   ============================================================ */

import { ASSET_CLASS_LABELS } from "./invest-constants.js";

/** Congela a posição atual (só ativos com qtd > 0). Um por data — quem
 *  congelar duas vezes no mesmo dia substitui (tratado no chamador). */
export function congelarCarteira(ativos = [], dataISO, mkId) {
  const itens = (ativos || [])
    .filter(a => (Number(a?.qtd) || 0) > 0)
    .map(a => {
      const qtd = Number(a.qtd) || 0;
      const pm = Number(a.pm ?? a.precoMedio) || 0;
      const preco = Number(a.preco) || 0;
      return {
        ticker: a.ticker || "—",
        nome: a.nome || "",
        tipo: ASSET_CLASS_LABELS[a.tipo] || a.tipo || "—",
        qtd, pm, preco,
        custo: qtd * pm,
        valor: qtd * preco,
      };
    })
    .sort((a, b) => b.custo - a.custo);
  return {
    id: mkId ? mkId() : `snap-${dataISO}`,
    data: dataISO,
    criadoEm: new Date().toISOString(),
    itens,
    totalCusto: itens.reduce((s, i) => s + i.custo, 0),
    totalValor: itens.reduce((s, i) => s + i.valor, 0),
  };
}

/** Melhor snapshot pro IR do ano-base: o MAIS RECENTE dentro do próprio ano
 *  (quanto mais perto de 31/12, melhor). Fora do ano não vale — posição de
 *  outro exercício confunde mais do que ajuda. */
export function snapshotParaAno(snapshots = [], ano) {
  const a = String(ano);
  const doAno = (snapshots || []).filter(s => String(s?.data || "").slice(0, 4) === a);
  if (!doAno.length) return null;
  return doAno.sort((x, y) => String(x.data).localeCompare(String(y.data))).at(-1);
}
