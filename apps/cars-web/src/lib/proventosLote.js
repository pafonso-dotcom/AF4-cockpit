// Baixa de proventos EM LOTE ("Receber todos do mês") — puro.
// Monta, num passo só, tudo que a baixa em massa precisa aplicar no estado:
// marcação em proventosRecebidos + movimentos da carteira virtual (destino
// "carteira") OU transações de receita (destino "conta"). Reinvestir não tem
// versão em lote — cada reinvestimento pede um ativo destino.

/**
 * @param {Array} pendentes  proventos ainda não baixados (do mês escolhido)
 * @param {Object} opts
 *   destino      "carteira" | "conta"
 *   contaDestino nome da conta (obrigatório se destino = "conta")
 *   dataBaixa    ISO yyyy-mm-dd
 *   categoria    categoria da receita (destino conta)
 *   mkId         gerador de id (uid)
 * @returns {{recebidos, movimentos, transacoes, total, itens}}
 */
export function montarBaixaLote(pendentes = [], { destino, contaDestino, dataBaixa, categoria, mkId } = {}) {
  const itens = (pendentes || []).filter(p => p && Number(p.total) > 0);
  const recebidos = {};
  const movimentos = [];
  const transacoes = [];
  let total = 0;

  for (const p of itens) {
    const valor = Number(p.total) || 0;
    total += valor;
    recebidos[p.id] = destino === "conta"
      ? { dataBaixa, valor, destino: "conta", contaDestino }
      : { dataBaixa, valor, destino: "carteira" };

    if (destino === "conta") {
      transacoes.push({
        id: mkId ? mkId() : `lote-${p.id}`,
        tipo: "receita",
        descricao: `${p.ticker} · ${p.tipo}`,
        categoria: categoria || "Outros",
        conta: contaDestino,
        data: dataBaixa,
        valor,
        compensado: true,
        fixa: false,
        obs: `Provento baixado em lote · ${String(p.data || "").slice(8, 10)}/${String(p.data || "").slice(5, 7)}`,
      });
    } else {
      movimentos.push({
        id: mkId ? mkId() : `lote-${p.id}`,
        data: dataBaixa,
        tipo: "recebimento",
        valor,
        descricao: `${p.ticker} · ${p.tipo} de ${String(p.data || "").slice(8, 10)}/${String(p.data || "").slice(5, 7)}`,
        proventoKey: p.id,
        ticker: p.ticker,
      });
    }
  }

  return { recebidos, movimentos, transacoes, total, itens };
}
