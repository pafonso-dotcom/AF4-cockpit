// Movimentações de investimento do mês (compras, vendas, proventos) — puro.
// Fonte: transações. Aporte/venda viram lançamento com campos ricos
// (investOp/ticker/qtd/preco/resultado) nos novos; nos antigos lê pela descrição.

import { PROVENTO_REGEX } from "./invest-constants.js";

const NAO_PROVENTO = /\bsaldo\b|transfer|\btransf\b|\bpix\b|aporte|resgate|\bvenda\b/i;
const money = (v) => Number(v) || 0;

export const ehProventoTx = (t) =>
  t?.tipo === "receita"
  && (PROVENTO_REGEX.test(t.categoria || "") || PROVENTO_REGEX.test(t.descricao || ""))
  && !NAO_PROVENTO.test(t.descricao || "");

const ehCompra = (t) => t?.investOp === "compra" || (t?.tipo === "despesa" && /^\s*aporte\s+/i.test(t?.descricao || ""));
const ehVenda = (t) => t?.investOp === "venda" || (t?.tipo === "receita" && /^\s*venda\s+/i.test(t?.descricao || ""));

const tickerDe = (t) => {
  if (t?.ticker) return t.ticker;
  const m = String(t?.descricao || "").match(/^\s*(?:aporte|venda)\s+([^\s(]+)/i);
  if (m) return m[1];
  const tk = String(t?.descricao || "").match(/\b[A-Z]{2,6}\d{0,2}\b/);
  return tk ? tk[0] : "—";
};
const qtdDe = (t) => {
  if (t?.qtd != null) return Number(t.qtd) || 0;
  const m = String(t?.descricao || "").match(/\(\s*([\d.,]+)\s*[×x]/i);
  return m ? Number(m[1].replace(/\./g, "").replace(",", ".")) : 0;
};
const resultadoDe = (t) => {
  if (t?.resultado != null) return Number(t.resultado) || 0;
  const obs = String(t?.obs || "");
  const m = obs.match(/Resultado:\s*[-−]?R?\$?\s*([\d.,]+)/i);
  if (!m) return null;
  const val = Number(m[1].replace(/\./g, "").replace(",", "."));
  return /preju/i.test(obs) ? -val : val;
};
const tipoProvento = (t) => {
  const s = `${t?.descricao || ""} ${t?.categoria || ""}`;
  if (/jcp|juros sobre capital/i.test(s)) return "JCP";
  if (/rendiment/i.test(s)) return "Rendimento";
  if (/dividend/i.test(s)) return "Dividendo";
  return "Provento";
};

/**
 * Linha do tempo de um ATIVO: todas as operações dele em ordem cronológica —
 * compras/vendas (transações), proventos recebidos via conta (transações) e
 * via carteira virtual (historico de carteiraProventos, incl. reinvestimentos).
 * @returns eventos [{data, tipo: "compra"|"venda"|"provento"|"reinvestimento", valor, qtd?, preco?, resultado?, detalhe}]
 */
export function linhaTempoAtivo(ticker, { transacoes = [], historicoCarteira = [] } = {}) {
  const tk = String(ticker || "").trim().toUpperCase();
  if (!tk) return [];
  const eventos = [];

  for (const t of transacoes || []) {
    if (ehCompra(t) && tickerDe(t).toUpperCase() === tk) {
      eventos.push({ id: t.id, data: t.data, tipo: "compra", valor: money(t.valor), qtd: qtdDe(t), preco: qtdDe(t) > 0 ? money(t.valor) / qtdDe(t) : money(t.preco), detalhe: t.descricao || "" });
    } else if (ehVenda(t) && tickerDe(t).toUpperCase() === tk) {
      eventos.push({ id: t.id, data: t.data, tipo: "venda", valor: money(t.valor), qtd: qtdDe(t), preco: qtdDe(t) > 0 ? money(t.valor) / qtdDe(t) : money(t.preco), resultado: resultadoDe(t), detalhe: t.descricao || "" });
    } else if (ehProventoTx(t) && tickerDe(t).toUpperCase() === tk) {
      eventos.push({ id: t.id, data: t.data, tipo: "provento", valor: money(t.valor), detalhe: `${tipoProvento(t)} · em conta (${t.conta || "—"})` });
    }
  }

  for (const h of historicoCarteira || []) {
    const htk = String(h?.ticker || "").trim().toUpperCase();
    if (htk !== tk) continue;
    if (h.tipo === "recebimento") {
      eventos.push({ id: h.id, data: h.data, tipo: "provento", valor: money(h.valor), detalhe: `${h.descricao || "Provento"} · carteira de proventos` });
    } else if (h.tipo === "reinvestimento") {
      eventos.push({ id: h.id, data: h.data, tipo: "reinvestimento", valor: Math.abs(money(h.valor)), detalhe: h.descricao || "Reinvestimento" });
    }
  }

  eventos.sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  return eventos;
}

export function movimentacoesInvestMes(transacoes = [], mesISO = "") {
  const doMes = (transacoes || []).filter((t) => String(t?.data || "").startsWith(mesISO));

  const compras = doMes.filter(ehCompra).map((t) => ({
    id: t.id, data: t.data, ticker: tickerDe(t), qtd: qtdDe(t), valor: money(t.valor),
    preco: qtdDe(t) > 0 ? money(t.valor) / qtdDe(t) : money(t.preco),
  }));
  const vendas = doMes.filter(ehVenda).map((t) => ({
    id: t.id, data: t.data, ticker: tickerDe(t), qtd: qtdDe(t), valor: money(t.valor),
    preco: qtdDe(t) > 0 ? money(t.valor) / qtdDe(t) : money(t.preco), resultado: resultadoDe(t),
  }));
  const vendaIds = new Set(vendas.map((v) => v.id));
  const proventos = doMes.filter((t) => !vendaIds.has(t.id) && ehProventoTx(t)).map((t) => ({
    id: t.id, data: t.data, ticker: tickerDe(t), tipo: tipoProvento(t), valor: money(t.valor),
  }));

  const ordDia = (a, b) => (a.data || "").localeCompare(b.data || "");
  compras.sort(ordDia); vendas.sort(ordDia); proventos.sort(ordDia);

  const totalComprado = compras.reduce((s, x) => s + x.valor, 0);
  const totalVendido = vendas.reduce((s, x) => s + x.valor, 0);
  const totalProventos = proventos.reduce((s, x) => s + x.valor, 0);
  const resultadoVendas = vendas.reduce((s, x) => s + (Number(x.resultado) || 0), 0);

  return { compras, vendas, proventos, totalComprado, totalVendido, totalProventos, resultadoVendas };
}
