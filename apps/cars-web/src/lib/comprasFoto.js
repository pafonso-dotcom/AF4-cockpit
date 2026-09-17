/* ============================================================
   COMPRAS POR FOTO · helpers puros

   Lê um print/foto das "transações recentes" do cartão (Wallet,
   app do banco) ou de um cupom/comprovante, extrai as compras via
   Gemini e lança na fatura do cartão sem esperar a fatura fechar.
   ============================================================ */

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** Prompt de extração — datas relativas resolvidas com a data de hoje. */
export function montarPromptComprasFoto(hoje = new Date()) {
  const iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  return `Você está lendo uma FOTO ou PRINT de compras no cartão de crédito — pode ser a tela "transações recentes" de um app de banco/carteira (Apple Wallet, Nubank, XP…), um cupom fiscal ou um comprovante.

Hoje é ${iso} (${DIAS[hoje.getDay()]}).

Extraia SOMENTE as compras/débitos visíveis e retorne APENAS este JSON:
{"compras":[{"descricao":"...","valor":123.45,"data":"AAAA-MM-DD"}]}

Regras:
- "valor": número positivo em reais (na foto "R$ 326,05" vira 326.05).
- "data": converta termos relativos usando a data de hoje — "Ontem" = dia anterior; nome de dia da semana ("Sábado", "Sexta-feira") = a ocorrência MAIS RECENTE desse dia (hoje ou antes, nunca no futuro); "DD/MM/AAAA" vira ISO; sem data visível → hoje.
- "descricao": nome do estabelecimento como aparece (pode limpar prefixos técnicos como "IFD*").
- IGNORE: estornos, pagamentos de fatura, limites, saldo e número do cartão.
- Se a mesma compra aparecer repetida na foto (mesmo valor, mesmo dia, mesmo nome), inclua as duas — compras duplicadas de verdade existem.`;
}

/** Normaliza um item vindo do Gemini; retorna null se inválido. */
export function normalizarCompraFoto(item, hojeISO) {
  const valor = Number(item?.valor);
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const descricao = String(item?.descricao || "").trim() || "Compra no cartão";
  let data = String(item?.data || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || data > hojeISO) data = hojeISO;
  return { descricao, valor: +valor.toFixed(2), data };
}

/**
 * Marca compras extraídas que PROVAVELMENTE já estão lançadas no cartão:
 * mesma fatura (cartaoId), mesmo valor e data até 3 dias de distância.
 * Essas começam desmarcadas na revisão pra não duplicar.
 */
export function marcarJaLancadas(compras = [], transacoes = [], cartaoId = "") {
  const doCartao = (transacoes || []).filter(t => t && t.cartaoId === cartaoId && t.tipo === "despesa");
  const diasEntre = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
  // Cada transação existente só "casa" com UMA compra da foto (senão duas
  // compras iguais de verdade seriam ambas marcadas por um único lançamento).
  const usadas = new Set();
  return (compras || []).map(c => {
    const idx = doCartao.findIndex((t, i) =>
      !usadas.has(i) &&
      Math.abs((Number(t.valor) || 0) - c.valor) < 0.005 &&
      t.data && diasEntre(t.data, c.data) <= 3
    );
    if (idx >= 0) { usadas.add(idx); return { ...c, jaLancada: true }; }
    return { ...c, jaLancada: false };
  });
}
