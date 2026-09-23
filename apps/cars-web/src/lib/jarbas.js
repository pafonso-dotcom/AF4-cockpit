// ⏸️ PROJETO JARBAS PAUSADO (2026-09-23) — fora da UI; spec e prompt de
// retomada em docs/jarbas/JARBAS-PROMPT.md. Não apagar: repluga depois.
/**
 * Jarbas — o assistente pessoal do Afinanças (estilo Jarvis).
 * Lógica pura: bom-dia falável, contexto completo dos dados e prompts.
 * A conversa/voz vive em components/JarbasModal.jsx; a fala em lib/tts.js.
 */
import { buildContext } from "./aiChat.js";
import { getDespesasDoMes } from "./agregador.js";
import { dataPorExtenso } from "./olhadaRapida.js";

// Saudação conforme a hora (mesma regra do Painel).
export function saudacaoHora(h = new Date().getHours()) {
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Bom-dia LOCAL (sem API): saudação + data + saldo + avisos do Resumo do dia.
 * `resumoDia` é a saída de montarResumoDia ([{icone, texto, cor}]).
 */
export function montarBomDia({ userName = "", totalContas = 0, resumoDia = [], fmt = (v) => `R$ ${v}`, data = new Date() } = {}) {
  const partes = [];
  partes.push(`${saudacaoHora(data.getHours())}${userName ? `, ${userName}` : ""}. Aqui é o Jarbas.`);
  partes.push(`Hoje é ${dataPorExtenso(data)}.`);
  // totalContas null = modo oculto ligado → não fala o saldo em voz alta.
  if (totalContas != null) partes.push(`Seu saldo em contas está em ${fmt(totalContas)}.`);
  if (resumoDia.length === 0) {
    partes.push("Nenhum vencimento ou aviso pra hoje. Dia tranquilo.");
  } else {
    partes.push(resumoDia.length === 1 ? "Um aviso pra hoje:" : `${resumoDia.length} avisos pra hoje:`);
    resumoDia.forEach(a => partes.push(`${a.texto}.`));
  }
  partes.push("Precisa de algo, é só perguntar.");
  return partes.join(" ").replace(/\.\./g, ".");
}

/**
 * Contexto COMPLETO pro Jarbas responder qualquer coisa do app:
 * buildContext (resumo do mês/patrimônio/pendências) + o que faltava lá —
 * contas por nome, cartões com fatura pendente, vencimentos dos próximos 7
 * dias (fixas/parcelas/dívidas via agregador) e agenda de hoje.
 */
export function montarContextoJarbas(d = {}) {
  const {
    contas = [], cartoes = [], transacoes = [], ativos = [],
    devedores = [], dividas = [], cheques = [],
    fixas = [], fixaOcorrencias = [], parcelamentos = [],
    agenda = [], lembretes = [], tarefas = [],
  } = d;
  const base = buildContext({ transacoes, contas, ativos, devedores, dividas, cheques });

  const fmtV = (v) => `R$ ${(Number(v) || 0).toFixed(2)}`;
  const hojeD = new Date();
  const hojeISO = `${hojeD.getFullYear()}-${String(hojeD.getMonth() + 1).padStart(2, "0")}-${String(hojeD.getDate()).padStart(2, "0")}`;
  const mesISO = hojeISO.slice(0, 7);

  const linhasContas = contas.map(c =>
    `• ${c.nome}: ${fmtV(c.saldo)}${c.moeda && c.moeda !== "BRL" ? ` (${c.moeda})` : ""}`).join("\n") || "• (nenhuma)";

  const linhasCartoes = cartoes.map(c => {
    const pendente = transacoes
      .filter(t => t.cartao === c.nome && t.compensado === false && t.tipo === "despesa")
      .reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const extras = [
      pendente > 0 ? `fatura pendente ${fmtV(pendente)}` : "sem pendências",
      c.limite ? `limite ${fmtV(c.limite)}` : null,
      c.diaFechamento ? `fecha dia ${c.diaFechamento}` : null,
      c.diaVencimento ? `vence dia ${c.diaVencimento}` : null,
    ].filter(Boolean).join(" · ");
    return `• ${c.nome}: ${extras}`;
  }).join("\n") || "• (nenhum)";

  // Compromissos do mês (fixas+parcelas+dívidas, via agregador) nos próximos 7 dias.
  let linhasVencer = "• (nada nos próximos 7 dias)";
  try {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques };
    const em7 = new Date(hojeD); em7.setDate(em7.getDate() + 7);
    const lim = `${em7.getFullYear()}-${String(em7.getMonth() + 1).padStart(2, "0")}-${String(em7.getDate()).padStart(2, "0")}`;
    const prox = getDespesasDoMes(mesISO, state, "tudo")
      .filter(x => x.status !== "paga" && x.data >= hojeISO && x.data <= lim)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""))
      .slice(0, 12);
    if (prox.length) {
      linhasVencer = prox.map(x =>
        `• ${x.data.slice(8, 10)}/${x.data.slice(5, 7)}: ${x.descricao || x.nome || "compromisso"} — ${fmtV(x.valor)}`).join("\n");
    }
  } catch { /* agregador falhou: segue sem o bloco */ }

  const agHoje = [
    ...agenda.filter(e => e && e.data === hojeISO && e.status !== "feito").map(e => `evento "${e.titulo || e.nome}"${e.horario ? ` às ${e.horario}` : ""}`),
    ...lembretes.filter(l => l && !l.concluido && l.data === hojeISO).map(l => `lembrete "${l.titulo || l.texto}"`),
    ...tarefas.filter(t => t && !t.concluida && t.prazo === hojeISO).map(t => `tarefa "${t.titulo}"`),
  ];

  // Memórias permanentes do Jarbas (metas, preferências — o usuário pediu pra lembrar).
  const memorias = (d.memorias || []).map(m => `• ${m.texto}`).join("\n");

  return `${base}
${memorias ? `\n═══ MEMÓRIAS (coisas que o Paulo pediu pra eu lembrar) ═══\n${memorias}\n` : ""}

═══ CONTAS (uma a uma) ═══
${linhasContas}

═══ CARTÕES DE CRÉDITO ═══
${linhasCartoes}

═══ VENCE NOS PRÓXIMOS 7 DIAS ═══
${linhasVencer}

═══ AGENDA DE HOJE (${hojeISO}) ═══
${agHoje.length ? agHoje.map(x => `• ${x}`).join("\n") : "• (livre)"}`;
}

// Persona do Jarbas — usada como system (Anthropic) ou prefixo (Gemini).
export const PROMPT_JARBAS = `Você é o JARBAS, o assistente pessoal do Paulo no aplicativo Afinanças — inspirado no Jarvis do Homem de Ferro: prestativo, direto, levemente espirituoso, sempre em português do Brasil.

Regras:
- Responda em 1 a 4 frases CURTAS e faláveis (a resposta será lida em voz alta). Sem markdown, sem listas, sem emoji.
- Use SOMENTE os números do contexto de dados fornecido; nunca invente valores. Formate dinheiro como "1.234 reais" ou "R$ 1.234,56".
- Se faltar dado pra responder, diga o que falta em uma frase.
- Chame o usuário de "Paulo" quando fizer sentido.`;

// Campos extras do JSON (áudio E texto): valores na tela, memória e web.
export const REGRAS_JSON_EXTRAS = `Campos OPCIONAIS do JSON (inclua só quando se aplicarem):
- "destaques": SEMPRE que a resposta citar valores/números importantes (saldo, fatura, total, preço), liste até 4 itens [{"rotulo":"Saldo Itaú","valor":"R$ 1.234,56"}] pra aparecerem POR ESCRITO na tela.
- "memorizar": quando o usuário pedir pra lembrar/anotar/guardar algo pessoal ("lembra que...", "anota que..."), o texto curto da memória. Confirme na "resposta" que guardou.
- "buscaWeb": se a pergunta precisar de informação da INTERNET (notícias, cotações e fatos que NÃO estão no contexto), coloque aqui a consulta de busca em português e deixe "resposta" curta tipo "Deixa eu verificar na internet.". NÃO use pra dados que já estão no contexto.`;

// Versão pra ÁUDIO: transcreve E responde numa chamada só (Gemini).
export const PROMPT_JARBAS_AUDIO = `${PROMPT_JARBAS}

O usuário enviou um ÁUDIO com a pergunta. Transcreva e responda usando o contexto abaixo. Retorne APENAS JSON válido:
{"transcricao": "o que o usuário falou", "resposta": "sua resposta falável"}

${REGRAS_JSON_EXTRAS}`;

// Versão pra TEXTO digitado (mesma estrutura, sem transcrição).
export function montarPromptTexto(contexto, msgs = [], pergunta = "") {
  const historico = msgs.slice(-6)
    .map(m => `${m.role === "user" ? "Paulo" : "Jarbas"}: ${m.texto}`)
    .join("\n");
  return `${PROMPT_JARBAS}

Responda a pergunta do Paulo usando o contexto abaixo. Retorne APENAS JSON válido:
{"resposta": "sua resposta falável"}

${REGRAS_JSON_EXTRAS}

${historico ? `CONVERSA ATÉ AGORA:\n${historico}\n\n` : ""}CONTEXTO DE DADOS:
${contexto}

Paulo: ${pergunta}`;
}

// Prompt da 2ª chamada quando precisa de WEB (grounding não aceita JSON).
export function montarPromptWeb(pergunta) {
  return `${PROMPT_JARBAS}

Pesquise na internet e responda a pergunta do Paulo em 1 a 4 frases faláveis, em pt-BR, SEM URLs nem markdown no texto (as fontes aparecem separadas na tela).

Pergunta: ${pergunta}`;
}

/**
 * Prompt completo pro caminho de ÁUDIO com MEMÓRIA da conversa — sem isso,
 * "e no Nubank?" depois de perguntar do Itaú perdia o fio.
 * `msgs` = [{role:"user"|"jarbas", texto}].
 */
export function montarPromptAudio(contexto, msgs = []) {
  const historico = msgs.slice(-6)
    .map(m => `${m.role === "user" ? "Paulo" : "Jarbas"}: ${m.texto}`)
    .join("\n");
  return `${PROMPT_JARBAS_AUDIO}

${historico ? `CONVERSA ATÉ AGORA:\n${historico}\n\n` : ""}CONTEXTO DE DADOS:
${contexto}`;
}

// Sugestões prontas do chat.
export const SUGESTOES_JARBAS = [
  "Quanto tenho em contas?",
  "Como estão os cartões?",
  "O que vence essa semana?",
  "Como foi meu mês até agora?",
  "Tenho algo na agenda hoje?",
];
