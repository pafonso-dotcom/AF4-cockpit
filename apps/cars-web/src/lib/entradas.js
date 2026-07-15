// Entradas de dinheiro do mês — dinheiro NOVO que entra (puro e testável).
//
// Conta como entrada: salário, proventos, rendimentos, vendas, aluguéis, juros
// recebidos, depósito externo, etc.
// NÃO conta (é só mover teu próprio dinheiro): transferência entre contas,
// resgate de investimento e retorno de empréstimo (principal).
// O ajuste manual (excluir/incluir por categoria) sempre vence.

const NAO_ENTRADA = /transfer|investim|resgate|aporte|previd[êe]ncia/i;
const money = (v) => Number(v) || 0;

export function contaComoEntrada(t, excSet, incSet) {
  const cat = t?.categoria || "Outros";
  if (incSet && incSet.has(cat)) return true;   // colocada à mão
  if (excSet && excSet.has(cat)) return false;  // tirada à mão
  if (t?.transferenciaId) return false;         // transferência entre contas
  if (t?.emprestimoRetorno) return false;       // principal de empréstimo voltando
  return !NAO_ENTRADA.test(cat);                // resgate/investimento/aporte fora
}

function motivoFora(t) {
  if (t?.transferenciaId) return "transferencia";
  if (t?.emprestimoRetorno) return "emprestimo";
  const cat = t?.categoria || "";
  if (/resgate|investim|aporte|previd/i.test(cat)) return "resgate";
  if (/transfer/i.test(cat)) return "transferencia";
  return "outro";
}

/**
 * @param {Array} transacoes
 * @param {string} mesISO  "YYYY-MM"
 * @param {{excluir?:string[], incluir?:string[]}} ajuste
 * @returns {{ total, porCategoria, categorias, foraTotal, foraPorMotivo }}
 */
export function entradasDoMes(transacoes = [], mesISO = "", { excluir = [], incluir = [] } = {}) {
  const excSet = new Set(excluir), incSet = new Set(incluir);
  const doMes = (transacoes || []).filter((t) => t?.tipo === "receita" && String(t?.data || "").startsWith(mesISO));

  const porCategoria = {};
  const agg = {}; // cat -> { dentro, fora }
  let total = 0, foraTotal = 0;
  const foraPorMotivo = { transferencia: 0, resgate: 0, emprestimo: 0, outro: 0 };

  doMes.forEach((t) => {
    const v = money(t.valor);
    const cat = t.categoria || "Outros";
    if (!agg[cat]) agg[cat] = { dentro: 0, fora: 0 };
    if (contaComoEntrada(t, excSet, incSet)) {
      porCategoria[cat] = (porCategoria[cat] || 0) + v;
      agg[cat].dentro += v;
      total += v;
    } else {
      agg[cat].fora += v;
      foraTotal += v;
      foraPorMotivo[motivoFora(t)] += v;
    }
  });

  // Lista por categoria (contadas e não contadas) pra o "Ajustar"
  const categorias = Object.entries(agg)
    .map(([categoria, o]) => ({ categoria, valor: o.dentro + o.fora, contada: o.dentro > 0 || (o.fora === 0) }))
    .sort((a, b) => b.valor - a.valor);

  return { total, porCategoria, categorias, foraTotal, foraPorMotivo };
}
