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
