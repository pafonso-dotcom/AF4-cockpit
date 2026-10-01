/**
 * 🎙 Assistente de voz — motor de INTENÇÕES (fase 1, local, sem IA).
 *
 * Recebe a frase reconhecida ("qual o valor do cartão XP?") e um CONTEXTO
 * já calculado pelas libs de fonte única (fatura, saldo, a pagar, posso
 * gastar, patrimônio) e devolve { ok, intencao, texto, fala }:
 *   texto → balão na tela (R$ 1.234,56)
 *   fala  → o que o speechSynthesis lê ("1.234 reais e 56 centavos")
 * Sem casar nenhuma intenção → ok:false (quem chama oferece a IA).
 */

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
}

// Como o reconhecimento de voz costuma escrever siglas/nomes falados.
const APELIDOS = [
  [/\bxis pe\b|\bx p\b|\bshis pe\b|\bxpe\b/g, "xp"],
  [/\bnu bank\b|\bnew bank\b|\bnubanco\b/g, "nubank"],
  [/\bc 6\b|\bc seis\b|\bse seis\b/g, "c6"],
  [/\bb b\b|\bbebe\b/g, "bb"],
  [/\bsicred\b/g, "sicredi"],
];
function prepararFrase(frase) {
  let q = ` ${norm(frase)} `;
  for (const [re, sub] of APELIDOS) q = q.replace(re, sub);
  return q.trim();
}

// Palavras genéricas que não identificam conta/cartão.
const GENERICAS = new Set(["cartao", "conta", "banco", "credito", "debito", "corrente", "de", "do", "da",
  "o", "a", "e", "card", "visa", "master", "mastercard", "elo", "black", "platinum", "gold", "pessoal", "pj"]);

function distancia1(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, dif = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++dif > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return dif + (a.length - i) + (b.length - j) <= 1;
}

/** Pontua o quanto `nome` aparece na frase (0 = nada). */
export function pontuarNome(frase, nome) {
  const q = prepararFrase(frase);
  const qTok = q.split(" ");
  const n = norm(nome);
  if (!n) return 0;
  const compactQ = q.replace(/ /g, "");
  const compactN = n.replace(/ /g, "");
  if (compactN.length >= 3 && compactQ.includes(compactN)) return 100 + compactN.length;
  const tokens = n.split(" ").filter(t => t && !GENERICAS.has(t) && (t.length >= 2 || /\d/.test(t)));
  if (!tokens.length) return 0;
  let pts = 0;
  for (const t of tokens) {
    if (qTok.includes(t)) pts += 10 + t.length;
    else if (t.length >= 4 && qTok.some(w => w.length >= 4 && distancia1(w, t))) pts += 6 + t.length;
  }
  return pts;
}

/** Melhor item de `lista` (com .nome) citado na frase, ou null. */
export function acharPorNome(frase, lista = []) {
  let melhor = null, best = 0;
  for (const item of lista || []) {
    const p = pontuarNome(frase, item?.nome);
    if (p > best) { best = p; melhor = item; }
  }
  return melhor;
}



// ===== Lançamento por voz ("lança 50 reais de mercado no Itaú") =====
const VERBO_LANC = /^(?:(?:por favor|ei|oi)\s+)?(lanca|lancar|lance|lancei|anota|anotar|anote|registra|registrar|registre|gastei|paguei|comprei|recebi|entrou|ganhei|adiciona|adicionar|adicione|coloca|coloque)\b/;
const RECEITA = /\b(recebi|entrou|ganhei|receita|entrada|deposito|depositaram|salario|pix recebido)\b/;

/** Extrai o valor falado: "50 reais", "R$ 32,90", "1.200", "2 mil", "50 reais e 90 centavos". */
export function extrairValor(q) {
  let m = q.match(/\b(\d+)\s*mil(?:\s+e\s+(\d{1,3}))?\b/);
  if (m) return { valor: Number(m[1]) * 1000 + (Number(m[2]) || 0), trecho: m[0] };
  m = q.match(/\b(\d{1,3}(?: \d{3})+|\d+)(?: (\d{1,2}))?\s*(?:reais|real|r)?\s*(?:e\s+(\d{1,2})\s*centavos?)?/);
  if (!m) return null;
  const inteiro = Number(m[1].replace(/ /g, ""));
  const cent = m[3] != null ? Number(m[3]) : (m[2] != null ? Number(m[2].padEnd(2, "0")) : 0);
  return { valor: Math.round((inteiro + cent / 100) * 100) / 100, trecho: m[0] };
}

function isoLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function extrairData(q, hoje = new Date()) {
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (/\banteontem\b/.test(q)) { d.setDate(d.getDate() - 2); return { data: isoLocal(d), trecho: "anteontem" }; }
  if (/\bontem\b/.test(q)) { d.setDate(d.getDate() - 1); return { data: isoLocal(d), trecho: "ontem" }; }
  const m = q.match(/\bdia (\d{1,2})\b/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 31) {
    const alvo = new Date(d.getFullYear(), d.getMonth(), Number(m[1]));
    if (alvo > d) alvo.setMonth(alvo.getMonth() - 1); // "dia 28" no dia 3 = mês passado
    return { data: isoLocal(alvo), trecho: m[0] };
  }
  return { data: isoLocal(d), trecho: /\bhoje\b/.test(q) ? "hoje" : null };
}

const tirarNome = (q, nome) => {
  let r = ` ${q} `;
  const n = norm(nome);
  if (n) r = r.replace(` ${n} `, " ");
  for (const t of n.split(" ").filter(t => t.length >= 2 && !GENERICAS.has(t))) r = r.replace(new RegExp(`\\b${t}\\b`, "g"), " ");
  return r;
};
const PREENCHE = /\b(de|do|da|dos|das|no|na|nos|nas|em|com|pra|para|pro|o|a|os|as|um|uma|reais|real|centavos|centavo|cartao|conta|credito|debito|despesa|receita|gasto|uma compra|compra|valor|hoje|ontem|anteontem|que|eu)\b/g;

/**
 * Lê a frase de lançamento. Devolve null se não for lançamento, ou
 * { tipo, valor, descricao, categoria, data, destino: {tipo, item}|null }.
 * `valor` null quando não deu pra entender o número.
 */
export function interpretarLancamento(frase, { contas = [], cartoes = [], categorias = [], historico = [], categoriaAuto } = {}, hoje = new Date()) {
  const q0 = prepararFrase(frase).replace(/(\d)[.,](\d)/g, "$1 $2").replace(/\br\s*\$?\s*(?=\d)/g, "");
  const v = q0.match(VERBO_LANC);
  if (!v) return null;
  const tipo = RECEITA.test(q0) ? "receita" : "despesa";
  let q = q0.slice(v[0].length).trim();
  const val = extrairValor(q);
  if (val) q = q.replace(val.trecho, " ");
  const dt = extrairData(q, hoje);
  if (dt.trecho) q = q.replace(dt.trecho, " ");

  const querCartao = /\b(cartao|credito|fatura)\b/.test(q);
  const querConta = /\b(conta|debito|pix|dinheiro)\b/.test(q);
  // O destino costuma vir depois de "no/na/pelo…" ("…de mercado NO itaú"):
  // procura primeiro nesse trecho, pra "mercado" não virar o cartão Mercado Livre.
  const mPrep = [...` ${q} `.matchAll(/ (?:no|na|nos|nas|pelo|pela|em) /g)].pop();
  const cauda = mPrep ? ` ${q} `.slice(mPrep.index + mPrep[0].length) : "";
  const achar = (lista) => (cauda && acharPorNome(cauda, lista)) || null;
  let cartao = tipo === "despesa" ? achar(cartoes) : null;
  let conta = achar(contas);
  if (!cartao && !conta) {
    cartao = tipo === "despesa" ? acharPorNome(q, cartoes) : null;
    conta = acharPorNome(q, contas);
  }
  let destino = null;
  if (cartao && (querCartao || !conta || (!querConta && pontuarNome(q, cartao.nome) >= pontuarNome(q, conta.nome)))) destino = { tipo: "cartao", item: cartao };
  else if (conta) destino = { tipo: "conta", item: conta };
  if (destino) q = tirarNome(q, destino.item.nome);

  let desc = q.replace(/\b(cartao|conta|credito|debito|pix)\b/g, " ")
    .replace(PREENCHE, " ").replace(/\s+/g, " ").trim();
  if (!desc) desc = tipo === "receita" ? "Receita" : "Despesa";
  const descricao = desc.charAt(0).toUpperCase() + desc.slice(1);

  // Categoria: nome do cadastro citado na frase > histórico/regras > Outros.
  const nd = norm(descricao);
  const doCadastro = (categorias || []).filter(c => c?.nome && (!c.tipo || c.tipo === tipo))
    .map(c => ({ c, n: norm(c.nome) }))
    .filter(x => x.n && (` ${nd} `.includes(` ${x.n} `) || nd === x.n))
    .sort((a, b) => b.n.length - a.n.length)[0];
  let categoria = doCadastro?.c.nome || null;
  if (!categoria && categoriaAuto) { try { categoria = categoriaAuto({ descricao, tipo }, categorias, historico); } catch {} }

  return { tipo, valor: val ? val.valor : null, descricao, categoria: categoria || "Outros", data: dt.data, destino };
}

const dataFalada = (iso, hoje = new Date()) => {
  const h = isoLocal(hoje);
  if (iso === h) return "hoje";
  const o = new Date(hoje); o.setDate(o.getDate() - 1);
  if (iso === isoLocal(o)) return "ontem";
  return `dia ${diaMes(iso)}`;
};

// ===== Navegação por voz ("abre os cartões", "vai pra conta AF4") =====
// Cada destino: módulo + aba + apelidos (já normalizados, sem acento).
export const DESTINOS = [
  { modulo: "financas", tab: "dashboard",    label: "Painel",          ap: ["painel", "inicio", "tela inicial", "pagina inicial", "home", "resumo"] },
  { modulo: "financas", tab: "contas",       label: "Contas",          ap: ["contas", "bancos", "minhas contas"] },
  { modulo: "financas", tab: "cartoes",      label: "Cartões",         ap: ["cartoes", "cartao de credito", "faturas", "cartoes de credito"] },
  { modulo: "financas", tab: "planejamento", label: "Planejamento",    ap: ["planejamento", "planejar", "orcamento", "fluxo de caixa"] },
  { modulo: "financas", tab: "transacoes",   label: "Transações",      ap: ["transacoes", "lancamentos", "movimentacoes", "extrato geral"] },
  { modulo: "financas", tab: "relatorios-f", label: "Análises & Relatórios", ap: ["relatorios", "relatorio", "analises", "analise do mes", "analise financeira"] },
  { modulo: "financas", tab: "categorias",   label: "Categorias",      ap: ["categorias", "categoria"] },
  { modulo: "financas", tab: "areceber",     label: "A Receber & Dívidas", ap: ["a receber", "dividas", "devedores", "quem me deve", "recebiveis"] },
  { modulo: "financas", tab: "emprestimos",  label: "Empréstimos",     ap: ["emprestimos", "emprestimo"] },
  { modulo: "financas", tab: "fixas",        label: "Contas fixas",    ap: ["fixas", "contas fixas", "despesas fixas"] },
  { modulo: "financas", tab: "cheques",      label: "Cheques",         ap: ["cheques", "cheque"] },
  { modulo: "financas", tab: "metas",        label: "Metas",           ap: ["metas", "objetivos financeiros"] },
  { modulo: "financas", tab: "perguntar",    label: "Pergunte ao Claude", ap: ["pergunte ao claude", "chat", "claude"] },
  { modulo: "invest",   tab: "investimentos", label: "Investimentos",  ap: ["investimentos", "invest", "painel de investimentos"] },
  { modulo: "invest",   tab: "carteira",     label: "Carteira",        ap: ["carteira", "minha carteira", "acoes", "ativos"] },
  { modulo: "invest",   tab: "proventos",    label: "Proventos",       ap: ["proventos", "dividendos", "renda passiva"] },
  { modulo: "invest",   tab: "analises",     label: "Análises da carteira", ap: ["analise da carteira", "analises da carteira"] },
  { modulo: "agenda",   tab: "calendario",   label: "Calendário",      ap: ["calendario", "agenda"] },
  { modulo: "agenda",   tab: "tarefas",      label: "Tarefas",         ap: ["tarefas", "afazeres", "to do"] },
  { modulo: "agenda",   tab: "treino",       label: "Treino",          ap: ["treino", "academia", "exercicios"] },
  { modulo: "agenda",   tab: "voos",         label: "Voos & viagens",  ap: ["voos", "voo", "viagens", "viagem", "passagens", "excursoes", "excursao"] },
  { modulo: "agenda",   tab: "lembretes",    label: "Lembretes",       ap: ["lembretes", "lembrete"] },
  { modulo: "agenda",   tab: "notas",        label: "Compromissos",    ap: ["compromissos", "compromisso"] },
  { modulo: "config",   tab: "cfg-aparencia", label: "Configurações",  ap: ["configuracoes", "configuracao", "config", "ajustes", "aparencia", "tema"] },
  { modulo: "config",   tab: "cfg-apis",     label: "APIs",            ap: ["apis", "chaves", "chave de api"] },
  { modulo: "config",   tab: "cfg-backup",   label: "Backup",          ap: ["backup", "historico", "pontos de restauracao", "ponto de restauracao"] },
];

const VERBO_NAV = /\b(abre|abra|abrir|abri|abrindo|vai (pra|para|pro|no|na|nos|nas|em)|va (pra|para|pro)|ir (pra|para|pro)|me leva|leva (pra|para|pro)|entra (no|na|em)|entrar (no|na|em)|navega|tela (de|do|da|dos|das))\b/;

/** "abre os cartões" → { destino } | { conta } | { cartao } | null */
export function detectarNavegacao(frase, { cartoes = [], contas = [] } = {}) {
  const q = prepararFrase(frase);
  if (!VERBO_NAV.test(q)) return null;
  const pad = ` ${q} `;
  let destino = null, maior = 0;
  for (const d of DESTINOS) for (const a of d.ap) {
    if (pad.includes(` ${a} `) && a.length > maior) { maior = a.length; destino = d; }
  }
  const cartao = acharPorNome(q, cartoes);
  const conta = acharPorNome(q, contas);
  const querCartao = /\b(cartao|fatura)\b/.test(q);
  if (cartao && (querCartao || !conta || pontuarNome(q, cartao.nome) >= pontuarNome(q, conta.nome)) && !(conta && /\bconta\b/.test(q) && !querCartao))
    return { cartao };
  if (conta) return { conta };
  if (destino) return { destino };
  return null;
}

const tem = (q, re) => re.test(q);

/** Classifica a frase. Retorna { tipo, alvo? }. */
export function detectarIntencao(frase, { cartoes = [], contas = [] } = {}) {
  const q = prepararFrase(frase);
  if (!q) return { tipo: null };
  if (tem(q, /\b(posso|pode|quanto da pra|da para) gastar\b|\bgastar hoje\b/)) return { tipo: "possoGastar" };
  if (tem(q, /\bpatrimonio\b|\bquanto (eu )?tenho (no|de) total\b/)) return { tipo: "patrimonio" };
  if (tem(q, /\b(vence|vencem|vencendo|vencimento|vencimentos)\b/) && !tem(q, /\bfatura\b|\bcartao\b/))
    return { tipo: "vencimentos" };
  if (tem(q, /\ba pagar\b|\btenho (que|pra|para) pagar\b|\bquanto (eu )?devo\b|\bcontas a pagar\b/))
    return { tipo: "aPagar", mes: tem(q, /\b(mes|mês)\b/) };

  const cartao = acharPorNome(q, cartoes);
  const conta = acharPorNome(q, contas);
  const querCartao = tem(q, /\bcartao\b|\bcartoes\b|\bfatura\b|\bfaturas\b/);
  const querConta = tem(q, /\bsaldo\b|\bconta\b|\bcontas\b|\bno banco\b/);
  const pc = cartao ? pontuarNome(q, cartao.nome) : 0;
  const pk = conta ? pontuarNome(q, conta.nome) : 0;

  if (cartao && (querCartao || (!querConta && pc >= pk))) return { tipo: "cartao", alvo: cartao };
  if (conta && (querConta || !querCartao)) return { tipo: "conta", alvo: conta };
  if (cartao) return { tipo: "cartao", alvo: cartao };
  if (querCartao) return { tipo: "cartoes" };
  if (tem(q, /\bsaldo\b/)) return { tipo: "contas" };
  return { tipo: null };
}

// ===== formatação =====
export function fmtBRL(v) {
  const n = Number(v) || 0;
  return (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
/** "R$ 8.000,33" → "8.000 reais e 33 centavos" (soa natural no speechSynthesis). */
export function valorFalado(v) {
  const n = Math.round((Number(v) || 0) * 100) / 100;
  const neg = n < 0;
  const abs = Math.abs(n);
  const reais = Math.floor(abs);
  const cent = Math.round((abs - reais) * 100);
  const r = reais.toLocaleString("pt-BR");
  let s;
  if (reais === 0 && cent > 0) s = `${cent} centavos`;
  else s = `${r} ${reais === 1 ? "real" : "reais"}${cent ? ` e ${cent} centavo${cent === 1 ? "" : "s"}` : ""}`;
  return (neg ? "menos " : "") + s;
}
const nomeMes = (mk) => MESES[(Number(String(mk || "").slice(5, 7)) || 1) - 1];
const diaMes = (iso) => `${Number(String(iso).slice(8, 10))}/${String(iso).slice(5, 7)}`;
const diaFalado = (iso) => `dia ${Number(String(iso).slice(8, 10))} de ${MESES[Number(String(iso).slice(5, 7)) - 1]}`;

function resp(intencao, texto, fala) {
  return { ok: true, intencao, texto, fala: fala || texto };
}

/**
 * Responde a frase usando o contexto pré-calculado:
 * {
 *   cartoes: [{ id, nome, vencimento }], contas: [{ id, nome, saldo, moeda, previsto? }],
 *   faturaDe(cartao) → { valor, mes, paga },
 *   possoGastar: { porDia, semana, sobraMes, fura, primeiroNegativo } | null,
 *   aPagar: { total, pagarMes, prox7: { total, count, top: [{ desc, valor, venc }] } },
 *   patrimonio: number,
 * }
 */
export function responder(frase, ctx = {}) {
  const lanc = interpretarLancamento(frase, ctx, ctx.hoje || new Date());
  if (lanc) {
    if (!(lanc.valor > 0)) {
      return { ok: true, intencao: { tipo: "lancar" }, texto: "Não peguei o valor. Fala de novo com o número, ex.: \"lança 50 reais de mercado no Itaú\".", fala: "Não peguei o valor. Fala de novo com o número." };
    }
    const onde = lanc.destino ? (lanc.destino.tipo === "cartao" ? ` no cartão ${lanc.destino.item.nome}` : ` na conta ${lanc.destino.item.nome}`) : "";
    const quando = dataFalada(lanc.data, ctx.hoje || new Date());
    const tipoTxt = lanc.tipo === "receita" ? "Receita" : "Despesa";
    return {
      ok: true, intencao: { tipo: "lancar" }, lancamento: lanc,
      texto: `${tipoTxt} de ${fmtBRL(lanc.valor)} — ${lanc.descricao}${onde}, ${quando}. Confere e confirma.`,
      fala: `${tipoTxt} de ${valorFalado(lanc.valor)}, ${lanc.descricao}${onde}, ${quando}. Confere e confirma.`,
    };
  }
  const nav = detectarNavegacao(frase, ctx);
  if (nav) {
    const label = nav.cartao ? `o cartão ${nav.cartao.nome}` : nav.conta ? `a conta ${nav.conta.nome}` : nav.destino.label;
    return { ok: true, intencao: { tipo: "navegar" }, nav, texto: `Abrindo ${label}.`, fala: `Abrindo ${label}.` };
  }
  const it = detectarIntencao(frase, ctx);
  switch (it.tipo) {
    case "cartao": {
      const c = it.alvo;
      const f = ctx.faturaDe ? ctx.faturaDe(c) : { valor: 0 };
      const venc = Number(c.vencimento);
      const vencTxt = venc >= 1 && venc <= 31 ? `, vence dia ${venc}` : "";
      if (f.paga && !(f.valor > 0)) return resp(it, `A fatura do ${c.nome} deste mês já está paga.`);
      if (!(f.valor > 0)) return resp(it, `O ${c.nome} não tem fatura em aberto.`);
      const mes = f.mes ? ` de ${nomeMes(f.mes)}` : "";
      return resp(it,
        `A fatura do ${c.nome}${mes} está em ${fmtBRL(f.valor)}${vencTxt}.`,
        `A fatura do ${c.nome}${mes} está em ${valorFalado(f.valor)}${vencTxt}.`);
    }
    case "cartoes": {
      const lista = (ctx.cartoes || []).map(c => ({ c, f: ctx.faturaDe ? ctx.faturaDe(c) : { valor: 0 } }))
        .filter(x => x.f.valor > 0).sort((a, b) => b.f.valor - a.f.valor);
      if (!lista.length) return resp(it, "Nenhum cartão com fatura em aberto.");
      const total = lista.reduce((s, x) => s + x.f.valor, 0);
      const top = lista.slice(0, 3);
      return resp(it,
        `Faturas em aberto: ${fmtBRL(total)} em ${lista.length} ${lista.length > 1 ? "cartões" : "cartão"} — ` +
          top.map(x => `${x.c.nome} ${fmtBRL(x.f.valor)}`).join(", ") + ".",
        `As faturas em aberto somam ${valorFalado(total)}. ` +
          top.map(x => `${x.c.nome}, ${valorFalado(x.f.valor)}`).join("; ") + ".");
    }
    case "conta": {
      const c = it.alvo;
      const saldo = Number(c.saldo) || 0;
      const moeda = c.moeda && c.moeda !== "BRL" ? c.moeda : null;
      const sTxt = moeda ? `${moeda} ${saldo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : fmtBRL(saldo);
      const sFala = moeda ? `${saldo.toLocaleString("pt-BR")} ${moeda}` : valorFalado(saldo);
      const prev = Number.isFinite(c.previsto) && c.previsto !== saldo ? c.previsto : null;
      return resp(it,
        `O saldo da ${c.nome} é ${sTxt}.` + (prev != null ? ` Com a planilha, a previsão é ${fmtBRL(prev)}.` : ""),
        `O saldo da ${c.nome} é ${sFala}.` + (prev != null ? ` Com a planilha, a previsão é ${valorFalado(prev)}.` : ""));
    }
    case "contas": {
      const brl = (ctx.contas || []).filter(c => !c.moeda || c.moeda === "BRL");
      const total = brl.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
      return resp(it, `Somando as ${brl.length} contas em real: ${fmtBRL(total)}.`,
        `Somando as ${brl.length} contas em real, dá ${valorFalado(total)}.`);
    }
    case "possoGastar": {
      const p = ctx.possoGastar;
      if (!p) return resp(it, "Ainda não consegui calcular o pode gastar hoje.");
      if (p.fura) {
        const quando = p.primeiroNegativo ? ` no ${diaFalado(p.primeiroNegativo)}` : " este mês";
        return resp(it,
          `Segura o gasto: o caixa fura${p.primeiroNegativo ? ` dia ${diaMes(p.primeiroNegativo)}` : " este mês"}. Sobra prevista no fim do mês: ${fmtBRL(p.sobraMes)}.`,
          `Segura o gasto. O caixa fura${quando}. A sobra prevista no fim do mês é ${valorFalado(p.sobraMes)}.`);
      }
      return resp(it,
        `Hoje você pode gastar ${fmtBRL(p.porDia)} (${fmtBRL(p.semana)} na semana).`,
        `Hoje você pode gastar ${valorFalado(p.porDia)}. Na semana, ${valorFalado(p.semana)}.`);
    }
    case "aPagar": {
      const a = ctx.aPagar || {};
      if (it.mes) return resp(it, `A pagar neste mês: ${fmtBRL(a.pagarMes)}. No total em aberto: ${fmtBRL(a.total)}.`,
        `Neste mês você tem ${valorFalado(a.pagarMes)} a pagar. No total em aberto, ${valorFalado(a.total)}.`);
      return resp(it, `Tudo a pagar em aberto: ${fmtBRL(a.total)} (${fmtBRL(a.pagarMes)} neste mês).`,
        `Você tem ${valorFalado(a.total)} a pagar em aberto, sendo ${valorFalado(a.pagarMes)} neste mês.`);
    }
    case "vencimentos": {
      const p7 = ctx.aPagar?.prox7;
      if (!p7 || !p7.count) return resp(it, "Nada vencendo nos próximos 7 dias.");
      const top = (p7.top || []).map(x => `${x.desc} ${fmtBRL(x.valor)} (${diaMes(x.venc)})`).join(", ");
      const topF = (p7.top || []).map(x => `${x.desc}, ${valorFalado(x.valor)}, ${diaFalado(x.venc)}`).join("; ");
      return resp(it,
        `Nos próximos 7 dias vencem ${p7.count} conta${p7.count > 1 ? "s" : ""}: ${fmtBRL(p7.total)}. ${top}.`,
        `Nos próximos 7 dias vencem ${p7.count} conta${p7.count > 1 ? "s" : ""}, somando ${valorFalado(p7.total)}. ${topF}.`);
    }
    case "patrimonio":
      return resp(it, `Seu patrimônio total é ${fmtBRL(ctx.patrimonio)}.`,
        `Seu patrimônio total é ${valorFalado(ctx.patrimonio)}.`);
    default:
      return { ok: false, intencao: it, texto: "", fala: "" };
  }
}
