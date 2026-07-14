// Helpers para a "Análise com IA" do mês — montam um resumo compacto dos dados
// e o prompt em pt-BR. Puros/testáveis; a chamada à IA (Gemini) fica no card.

const NAO_GASTO = /investim|transfer|dep[oó]sito|aporte|resgate/i;
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Resumo do mês a partir das transações (só gasto de consumo nas categorias).
 * @returns {{ mes, receitas, despesas, saldo, topCategorias:[{nome,valor}], qtdLancamentos }}
 */
export function montarResumoMes(transacoes = [], { mesISO } = {}) {
  const mes = mesISO || new Date().toISOString().slice(0, 7);
  const doMes = (transacoes || []).filter((t) => String(t?.data || "").startsWith(mes));
  const receitas = doMes.filter((t) => t.tipo === "receita").reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const gastos = doMes.filter((t) => t.tipo === "despesa" && !NAO_GASTO.test(t.categoria || "") && !t.transferenciaId);
  const despesas = gastos.reduce((s, t) => s + (Number(t.valor) || 0), 0);
  const catMap = {};
  gastos.forEach((t) => { const k = t.categoria || "Outros"; catMap[k] = (catMap[k] || 0) + (Number(t.valor) || 0); });
  const topCategorias = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nome, valor]) => ({ nome, valor }));
  return { mes, receitas, despesas, saldo: receitas - despesas, topCategorias, qtdLancamentos: doMes.length };
}

/**
 * Prompt para a IA gerar o resumo do mês em linguagem natural.
 * extras: { score?, alertas?:string[], assinaturasQtd?, assinaturasTotal? }
 */
export function promptAnaliseMes(resumo = {}, extras = {}) {
  const L = [];
  L.push("Você é um assistente financeiro pessoal. Escreva um resumo curto e direto (português do Brasil, 4 a 6 frases, tom amigável e objetivo) do mês financeiro do usuário com base APENAS nos dados abaixo. Destaque o que foi bem e o que merece atenção; termine com 1 dica prática. Não invente números. No máximo 1 emoji. Não use markdown de título.");
  L.push("");
  L.push(`Mês: ${resumo.mes || "—"}`);
  L.push(`Receitas: ${brl(resumo.receitas)}`);
  L.push(`Despesas (consumo): ${brl(resumo.despesas)}`);
  L.push(`Saldo do mês: ${brl(resumo.saldo)}`);
  if (resumo.topCategorias?.length) {
    L.push(`Maiores gastos: ${resumo.topCategorias.map((c) => `${c.nome} ${brl(c.valor)}`).join("; ")}`);
  }
  if (extras.score != null) L.push(`Score financeiro: ${extras.score}`);
  if (Array.isArray(extras.alertas) && extras.alertas.length) {
    L.push(`Alertas: ${extras.alertas.slice(0, 3).join("; ")}`);
  }
  if (extras.assinaturasQtd) {
    L.push(`Assinaturas recorrentes: ${extras.assinaturasQtd}${extras.assinaturasTotal ? ` (~${brl(extras.assinaturasTotal)}/mês)` : ""}`);
  }
  return L.join("\n");
}
