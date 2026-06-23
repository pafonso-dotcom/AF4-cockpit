// Glue do Painel de Inteligência: aplica escopo nos dados de Finanças,
// agrega assinaturas e mapeia um insight para a aba relevante (best-effort).
import { filtrarPorEscopo } from "./escopo.js";

/** Filtra contas pelo escopo e transações pelas contas do escopo (igual ao Dashboard). */
export function escoparFinancas(transacoesRaw, contasRaw, escopoAtivo) {
  const txs = Array.isArray(transacoesRaw) ? transacoesRaw : [];
  const contasAll = Array.isArray(contasRaw) ? contasRaw : [];
  if (escopoAtivo === "tudo" || !escopoAtivo) {
    return { transacoes: txs, contas: contasAll };
  }
  const contas = filtrarPorEscopo(contasAll, escopoAtivo);
  const nomes = new Set(contas.map(c => c.nome));
  const transacoes = txs.filter(t => t.conta && nomes.has(t.conta));
  return { transacoes, contas };
}

/** Soma assinaturas: anual = Σ valorAnualizado; mensal = anual / 12. */
export function totalAssinaturas(assinaturas) {
  const lista = Array.isArray(assinaturas) ? assinaturas : [];
  const anual = lista.reduce((s, a) => s + (Number(a.valorAnualizado) || 0), 0);
  return { anual, mensal: anual / 12 };
}

/** Mapeia um insight para a aba alvo por palavra-chave do título (ou null). */
export function tabAlvoInsight(insight) {
  const t = (insight?.titulo || "").toLowerCase();
  if (!t) return null;
  if (t.includes("cart")) return "cartoes";
  if (t.includes("reserva") || t.includes("meta")) return "metas";
  if (t.includes("receber") || t.includes("devedor")) return "areceber";
  if (t.includes("delivery") || t.includes("gasto") || t.includes("gastos")) return "transacoes";
  return null;
}
