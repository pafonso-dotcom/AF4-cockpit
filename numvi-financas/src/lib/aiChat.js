/**
 * Chat IA · usa o Gemini (via Worker /api/gemini) com dados contextualizados.
 *
 * Sem chave do cliente: a chave fica como secret no Worker (GEMINI_API_KEY).
 * Privacidade: só o resumo relevante dos dados é enviado para a IA.
 */

import { gerarTextoGemini } from "./gemini.js";

/** Monta resumo compacto dos dados do cockpit pra dar contexto à IA. */
export function buildContext({ transacoes = [], contas = [], ativos = [], vendas = [], veiculos = [], devedores = [], dividas = [], cheques = [] }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const mesAtual = hoje.slice(0, 7);
  const mesAnterior = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();

  const somar = (arr, filtroData, filtroTipo) =>
    arr.filter(t => (t.data || "").startsWith(filtroData))
       .filter(t => !filtroTipo || t.tipo === filtroTipo)
       .filter(t => t.compensado !== false)
       .reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);

  // Receitas / Despesas mês corrente e anterior
  const rec = somar(transacoes, mesAtual, "receita");
  const des = somar(transacoes, mesAtual, "despesa");
  const recAnt = somar(transacoes, mesAnterior, "receita");
  const desAnt = somar(transacoes, mesAnterior, "despesa");

  // Top 5 categorias de despesa no mês
  const porCat = {};
  transacoes
    .filter(t => (t.data || "").startsWith(mesAtual) && t.tipo === "despesa" && t.compensado !== false)
    .forEach(t => { porCat[t.categoria] = (porCat[t.categoria] || 0) + (parseFloat(t.valor) || 0); });
  const topCat = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const saldoContas = contas.reduce((s, c) => s + (parseFloat(c.saldo) || 0), 0);
  const valorCarteira = ativos.reduce((s, a) => s + (a.qtd * a.preco), 0);
  const investido = ativos.reduce((s, a) => s + (a.qtd * a.pm), 0);

  // Loja
  const vendasMes = vendas.filter(v => (v.dataVenda || "").startsWith(mesAtual));
  const lucroMes = vendasMes.reduce((s, v) => s + (v.lucroLiquido || 0), 0);
  const fatMes = vendasMes.reduce((s, v) => s + (parseFloat(v.valorVenda) || 0), 0);
  const estoque = veiculos.filter(v => v.status === "estoque").length;

  const devAbertos = devedores.filter(d => !d.recebido).length;
  const divAbertas = dividas.filter(d => !d.pago).length;
  const chequesAguardando = cheques.filter(c => c.status === "aguardando").length;

  return `
DADOS DO PAINEL FINANCEIRO (Afinanças · ${hoje})

═══ FINANÇAS PESSOAIS · MÊS ATUAL (${mesAtual}) ═══
• Receitas: R$ ${rec.toFixed(2)} (mês anterior: R$ ${recAnt.toFixed(2)})
• Despesas: R$ ${des.toFixed(2)} (mês anterior: R$ ${desAnt.toFixed(2)})
• Saldo do mês: R$ ${(rec - des).toFixed(2)}

Top categorias de despesa este mês:
${topCat.map(([c, v], i) => `${i + 1}. ${c}: R$ ${v.toFixed(2)}`).join("\n")}

═══ PATRIMÔNIO ═══
• Saldo em contas: R$ ${saldoContas.toFixed(2)} (${contas.length} contas)
• Carteira de ativos: R$ ${valorCarteira.toFixed(2)} (investido R$ ${investido.toFixed(2)})
• Resultado da carteira: R$ ${(valorCarteira - investido).toFixed(2)}

═══ LOJA ═══
• Vendas no mês: ${vendasMes.length} (faturamento R$ ${fatMes.toFixed(2)} · lucro líquido R$ ${lucroMes.toFixed(2)})
• Veículos em estoque: ${estoque}

═══ PENDÊNCIAS ═══
• Devedores em aberto: ${devAbertos}
• Dívidas a pagar: ${divAbertas}
• Cheques aguardando compensar: ${chequesAguardando}
`.trim();
}

/**
 * Envia uma pergunta para o Claude com o contexto dos dados.
 * Retorna a resposta em texto.
 */
export async function perguntarAoClaude({ pergunta, historico = [], contextoDados }) {
  const sistema = `Você é o assistente financeiro do Afinanças.
Analise os dados do usuário e responda com clareza, em PT-BR.

Princípios:
- Seja direto e objetivo · evite preâmbulo
- Sempre use os dados reais fornecidos (não invente números)
- Cite valores específicos quando relevante (formate como R$ 1.234,56)
- Quando der opinião financeira, deixe claro que é sugestão, não recomendação
- Quando faltar dado pra responder, diga o que falta
- Tom: profissional mas próximo, como um contador de confiança`;

  const conversa = historico
    .map(h => `${h.role === "user" ? "Usuário" : "Assistente"}: ${h.content}`)
    .join("\n");

  const prompt = `${sistema}

=== DADOS ATUAIS ===
${contextoDados}

${conversa ? `=== CONVERSA ATÉ AQUI ===\n${conversa}\n\n` : ""}Usuário: ${pergunta}

Responda como o assistente (texto corrido, sem markdown pesado):`;

  try {
    const texto = await gerarTextoGemini(prompt, { temperature: 0.3, maxOutputTokens: 1024 });
    return (texto || "").trim() || "(resposta vazia)";
  } catch (err) {
    throw new Error(err.message || "Erro ao consultar a IA.");
  }
}

/** Lista de sugestões iniciais pra inspirar perguntas. */
export const SUGESTOES = [
  "Onde gastei demais este mês?",
  "Compare meu fluxo de caixa com o mês passado",
  "Quais as vendas mais lucrativas da loja em maio?",
  "Devo aportar mais em renda fixa ou ações?",
  "Como está minha reserva de emergência?",
  "Quais dívidas estão prestes a vencer?",
  "Que padrões nas minhas despesas você nota?",
];
