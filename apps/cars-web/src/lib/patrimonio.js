/**
 * Patrimônio Total — FONTE ÚNICA (card do Painel + assistente de voz).
 * Soma contas + proventos + investimentos Brasil + a receber + cheques −
 * tudo a pagar em aberto. Cada parte pode ser desligada na composição
 * (config salva no aparelho em COMP_KEY).
 */
import { somaContasBRL } from "./cambio.js";

export const COMP_KEY = "af4:patrimonio-comp:v1";
export const COMP_PADRAO = { contas: true, proventos: true, invest: true, investUS: true, areceber: true, cheques: true, apagar: true };

export function lerCompCfg() {
  try { return { ...COMP_PADRAO, ...JSON.parse(localStorage.getItem(COMP_KEY) || "{}") }; }
  catch { return { ...COMP_PADRAO }; }
}

const ehUSD = (a) => a.tipo === "stock" || a.tipo === "reit";

/** Partes do patrimônio (valores já com sinal: a pagar entra negativo). */
export function partesPatrimonio({
  contas = [], ativos = [], carteiraProventos, devedores = [], cheques = [],
  aPagarTotal = 0, escopo = "tudo", usdRate = null,
} = {}) {
  const totalContas = somaContasBRL(contas || []);
  const totalInvest = (ativos || []).reduce((s, a) =>
    ehUSD(a) ? s : s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  // Stocks/REITs (US$) entram convertidos pelo dólar do dia (decisão
  // 2026-10-01: Painel e Invest mostram o mesmo número). Sem cotação, 0.
  const totalUSD = (ativos || []).reduce((s, a) =>
    ehUSD(a) ? s + Number(a.qtd || 0) * Number(a.preco || 0) : s, 0);
  const investUS = usdRate > 0 ? totalUSD * usdRate : 0;
  const provSaldo = Number(carteiraProventos?.saldo) || 0;
  const aReceber = (devedores || []).reduce((s, d) => {
    if (d.recebido) return s;
    return s + Math.max(0, (Number(d.valor) || 0) - (Number(d.valorRecebido) || 0));
  }, 0);
  const noEsc = (c) => escopo === "tudo" || (c.escopo || "pessoal") === escopo;
  const chequesAReceber = (cheques || []).reduce((s, c) =>
    (c.status === "aguardando" && noEsc(c)) ? s + (Number(c.valor) || 0) : s, 0);
  return [
    { k: "contas",    icone: "🏦", label: "Contas (todas, incl. negócio)", valor: totalContas },
    { k: "proventos", icone: "💰", label: "Carteira de proventos (saldo)", valor: provSaldo },
    { k: "invest",    icone: "📈", label: "Investimentos Brasil (R$)",     valor: totalInvest },
    ...(totalUSD > 0 ? [{ k: "investUS", icone: "🇺🇸", label: usdRate > 0
        ? `Investimentos EUA (US$ ${totalUSD.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} × dólar ${usdRate.toFixed(2).replace(".", ",")})`
        : "Investimentos EUA (aguardando o dólar do dia)", valor: investUS }] : []),
    { k: "areceber",  icone: "🤝", label: "A receber (devedores)",         valor: aReceber },
    { k: "cheques",   icone: "🧾", label: "Cheques a receber",             valor: chequesAReceber },
    { k: "apagar",    icone: "➖", label: "Tudo a pagar em aberto (desconta)", valor: -(Number(aPagarTotal) || 0) },
  ];
}

export function totalPatrimonio(partes = [], cfg = COMP_PADRAO) {
  return partes.reduce((s, p) => s + (cfg[p.k] ? p.valor : 0), 0);
}
