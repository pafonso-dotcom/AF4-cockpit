import React, { useMemo, useState, useEffect } from "react";
import { T } from "../../lib/theme.js";
import { CARD_SHADOW } from "../../lib/styles.js";
import { MESES_CURTO } from "../../lib/meses.js";
import { fmt } from "../../lib/format.js";
import { BarChartDouble, BarChart, HorizontalBarList, ReportCard, ReportGrid } from "../ui/Charts.jsx";
import { toPDF, toCSV, toPNG, hasPNGSupport } from "../../lib/exportRelatorio.js";
import { toast } from "../../lib/toast.js";
import { getKPIsMes, getDespesasDoMes, getGanhosDoMes } from "../../lib/agregador.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { somaContasBRL, saldoContaBRL } from "../../lib/cambio.js";
import { printHTML } from "../../lib/importExport.js";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { StatTile } from "../ui/widget.jsx";

const MESES_PROJ = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
// Agrupamento da projeção por origem do compromisso.
const FONTE_LABEL = { fixa: "Fixas", parcela: "Parcelas", divida: "Dívidas", transacao: "Avulsas previstas" };
const FONTE_ORDEM = ["fixa", "parcela", "divida", "transacao"];
// Fonte arredondada (nativa em Apple via ui-rounded / SF Pro Rounded; cai pra system-ui fora).
const FONTE_ARRED = 'ui-rounded, "SF Pro Rounded", "Hiragino Maru Gothic ProN", "Varela Round", "Nunito", system-ui, -apple-system, sans-serif';
// Equivalente para a janela de impressão.
const FONTE_ARRED_PRINT = "ui-rounded,'SF Pro Rounded','Varela Round','Nunito',system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
import EvolucaoPatrimonio from "./Invest/EvolucaoPatrimonio.jsx";

/**
 * Relatórios de Finanças · análises do período.
 */
export default function RelatoriosFinancas({
  transacoes: transacoesRaw = [], contas: contasRaw = [], categorias = [],
  fixas = [], fixaOcorrencias = [], parcelamentos = [], dividas = [], devedores = [], cheques = [],
  patrimonioHistorico = [],
  escopoAtivo = "tudo",
  hidden,
}) {
  // Aplica filtro de escopo (Pessoal / Negócio / Tudo) — contas de negócio
  // não entram nos relatórios quando o escopo é "pessoal", e vice-versa.
  const contas = useMemo(() => filtrarPorEscopo(contasRaw || [], escopoAtivo), [contasRaw, escopoAtivo]);
  const transacoes = useMemo(() => {
    if (escopoAtivo === "tudo") return transacoesRaw || [];
    const setContas = new Set(contas.map(c => c.nome));
    return (transacoesRaw || []).filter(t => t.conta && setContas.has(t.conta));
  }, [transacoesRaw, contas, escopoAtivo]);

  const [pngOk, setPngOk] = useState(false);
  useEffect(() => { hasPNGSupport().then(setPngOk); }, []);
  const anoAtualProj = new Date().getFullYear();
  const [anoProj, setAnoProj] = useState(anoAtualProj);
  const mesAtualKey = new Date().toISOString().slice(0, 7);
  // ===== Receita vs Despesa últimos 6 meses =====
  const seisMeses = useMemo(() => {
    const hoje = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const nome = MESES_CURTO[d.getMonth()];
      const tx = transacoes.filter(t => (t.data || "").startsWith(key));
      const rec = tx.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
      const desp = tx.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
      meses.push({ label: nome, value1: rec, value2: desp });
    }
    return meses;
  }, [transacoes]);

  // ===== Top categorias do mês =====
  // Usa o agregador (getDespesasDoMes) — MESMA base do donut do painel (fatura
  // expandida + fixas/parcelas/dívidas), pra os números baterem entre as telas.
  const topCategorias = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques };
    let desp = [];
    try { desp = getDespesasDoMes(mes, state, escopoAtivo); } catch {}
    const mapa = {};
    desp.forEach(d => {
      const cat = d.categoria || "Sem categoria";
      mapa[cat] = (mapa[cat] || 0) + (Number(d.valor) || 0);
    });
    return Object.entries(mapa)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, escopoAtivo]);

  // ===== Tendência por categoria (6 meses) =====
  // Pra cada categoria de despesa: total por mês + variação do mês atual vs média
  // dos meses anteriores. Mostra o que está subindo/caindo de verdade.
  const tendenciaCategorias = useMemo(() => {
    const hoje = new Date();
    const keys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      keys.push(d.toISOString().slice(0, 7));
    }
    const mesAtual = keys[keys.length - 1];
    const porCat = {}; // cat -> { [mes]: total }
    transacoes.filter(t => t.tipo === "despesa").forEach(t => {
      const mes = (t.data || "").slice(0, 7);
      if (!keys.includes(mes)) return;
      const cat = t.categoria || "Sem categoria";
      (porCat[cat] = porCat[cat] || {});
      porCat[cat][mes] = (porCat[cat][mes] || 0) + Number(t.valor || 0);
    });
    const linhas = Object.entries(porCat).map(([cat, meses]) => {
      const serie = keys.map(k => meses[k] || 0);
      const atual = meses[mesAtual] || 0;
      const anteriores = keys.slice(0, -1).map(k => meses[k] || 0);
      const mediaAnt = anteriores.length ? anteriores.reduce((s, v) => s + v, 0) / anteriores.length : 0;
      const variacao = mediaAnt > 0 ? ((atual - mediaAnt) / mediaAnt) * 100 : (atual > 0 ? 100 : 0);
      const total6m = serie.reduce((s, v) => s + v, 0);
      return { cat, serie, atual, mediaAnt, variacao, total6m };
    });
    return linhas.sort((a, b) => b.total6m - a.total6m).slice(0, 8);
  }, [transacoes]);

  // ===== Maiores gastos do mês (transações individuais) =====
  const maioresGastos = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    return transacoes
      .filter(t => t.tipo === "despesa" && (t.data || "").startsWith(mes))
      .slice()
      .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0))
      .slice(0, 8)
      .map(t => ({
        descricao: t.descricao || t.categoria || "—",
        categoria: t.categoria || "Sem categoria",
        data: t.data,
        valor: Number(t.valor || 0),
        conta: t.conta || "",
      }));
  }, [transacoes]);

  // ===== Sobra mensal REAL (últimos 6 meses) = receita − despesa por mês =====
  const sobraMensal = useMemo(
    () => seisMeses.map(m => ({ label: m.label, value: m.value1 - m.value2 })),
    [seisMeses]
  );
  const sobraMediaReal = sobraMensal.length
    ? sobraMensal.reduce((s, m) => s + m.value, 0) / sobraMensal.length : 0;
  const sobraTotalReal = sobraMensal.reduce((s, m) => s + m.value, 0);

  // ===== Sobra acumulada no ano (REAL) — mês a mês do ano corrente =====
  const acumuladoAno = useMemo(() => {
    const ano = new Date().getFullYear();
    const mesAtualIdx = new Date().getMonth(); // 0..11
    const nomes = MESES_CURTO;
    const out = [];
    let acc = 0;
    for (let m = 0; m <= mesAtualIdx; m++) {
      const key = `${ano}-${String(m + 1).padStart(2, "0")}`;
      const tx = transacoes.filter(t => (t.data || "").startsWith(key));
      const rec = tx.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
      const desp = tx.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
      acc += rec - desp;
      out.push({ label: nomes[m], value: acc });
    }
    return out;
  }, [transacoes]);
  const sobraAnoTotal = acumuladoAno.length ? acumuladoAno[acumuladoAno.length - 1].value : 0;

  // ===== Projeção REAL · meses a vencer (compromissos já agendados) =====
  const projecaoReal = useMemo(() => {
    const hoje = new Date();
    const state = { transacoes, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques };
    const meses = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const nome = MESES_CURTO[d.getMonth()];
      const kpis = getKPIsMes(mesISO, state);
      meses.push({
        label: `${nome}/${String(d.getFullYear()).slice(2)}`,
        despesas: kpis.totalPrevisto,
        ganhos: kpis.totalGanhos,
        saldo: kpis.balancoPrevisto,
      });
    }
    return meses;
  }, [transacoes, fixas, fixaOcorrencias, parcelamentos, dividas, devedores]);

  // ===== Projeção · Meses a vencer — por categoria (matriz categoria × mês) =====
  const proximosMeses = useMemo(() => {
    const out = [];
    const now = new Date();
    // Ponto de partida: ano corrente → a partir do MÊS CORRENTE; outro ano → janeiro.
    const baseM = anoProj === now.getFullYear() ? now.getMonth() : 0;
    for (let i = 0; i < 6; i++) {
      const d = new Date(anoProj, baseM + i, 1);
      out.push({ iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MESES_PROJ[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
    }
    return out;
  }, [anoProj]);

  const projecao = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques };
    const map = {}; // chave: `${fonte}||${categoria}`
    proximosMeses.forEach(m => {
      let desp = [];
      try { desp = getDespesasDoMes(m.iso, state, escopoAtivo); } catch {}
      desp.forEach(d => {
        const fonte = FONTE_LABEL[d.fonte] ? d.fonte : "transacao";
        // Com subcategoria (filha), mostra "Pai › Filha"; senão só a categoria.
        const base = d.categoria || "Outros";
        const sub = (d.subcategoria || "").trim();
        const cat = sub ? `${base} › ${sub}` : base;
        const key = `${fonte}||${cat}`;
        const r = map[key] || (map[key] = { fonte, cat, porMes: {}, pagoPorMes: {}, total: 0, pagoTotal: 0 });
        const v = Number(d.valor) || 0;
        r.porMes[m.iso] = (r.porMes[m.iso] || 0) + v;
        r.total += v;
        if (d.status === "paga") { r.pagoPorMes[m.iso] = (r.pagoPorMes[m.iso] || 0) + v; r.pagoTotal += v; }
      });
    });
    const n = proximosMeses.length || 1;
    // `aberto` = só o que ainda NÃO foi pago. Tanto os totais quanto as células
    // mostram o aberto: o que já foi pago/recebido no mês vira "—" (não risca).
    const abertoMes = (r, iso) => (r.porMes[iso] || 0) - (r.pagoPorMes[iso] || 0);
    const todas = Object.values(map).filter(r => r.total > 0)
      .map(r => ({ ...r, aberto: r.total - (r.pagoTotal || 0), media: r.total / n }));
    // Agrupa por fonte (Fixas, Parcelas, Dívidas, Avulsas), com subtotais.
    const grupos = FONTE_ORDEM.map(fonte => {
      const rows = todas.filter(r => r.fonte === fonte).sort((a, b) => b.total - a.total);
      if (!rows.length) return null;
      const subTotal = rows.reduce((s, r) => s + r.aberto, 0);
      const subPorMes = proximosMeses.map(m => rows.reduce((s, r) => s + abertoMes(r, m.iso), 0));
      return { fonte, label: FONTE_LABEL[fonte], rows, subTotal, subMedia: subTotal / n, subPorMes };
    }).filter(Boolean);
    const totaisMes = proximosMeses.map(m => todas.reduce((s, r) => s + abertoMes(r, m.iso), 0));
    const totalGeral = todas.reduce((s, r) => s + r.aberto, 0);

    // ===== A receber (entradas previstas) — por categoria =====
    const recMap = {};
    proximosMeses.forEach((m, idx) => {
      let gan = [];
      // 1º mês da janela puxa também os ATRASADOS (a-receber vencidos em meses
      // anteriores — inclusive parciais), mas SÓ dentro do ano da projeção
      // (pra não amontoar parcelas do ano anterior no 1º mês).
      try { gan = getGanhosDoMes(m.iso, state, escopoAtivo, { incluirAtrasados: idx === 0, atrasadosDesde: `${anoProj}-01` }); } catch {}
      gan.forEach(g => {
        const baseG = g.categoria || "Receita";
        const subG = (g.subcategoria || "").trim();
        const cat = subG ? `${baseG} › ${subG}` : baseG;
        const r = recMap[cat] || (recMap[cat] = { cat, porMes: {}, pagoPorMes: {}, total: 0, pagoTotal: 0 });
        const v = Number(g.valor) || 0;
        r.porMes[m.iso] = (r.porMes[m.iso] || 0) + v;
        r.total += v;
        if (g.status === "paga") { r.pagoPorMes[m.iso] = (r.pagoPorMes[m.iso] || 0) + v; r.pagoTotal += v; }
      });
    });
    const recRows = Object.values(recMap).filter(r => r.total > 0)
      .map(r => ({ ...r, aberto: r.total - (r.pagoTotal || 0), media: r.total / n })).sort((a, b) => b.total - a.total);
    const recAbertoMes = (r, iso) => (r.porMes[iso] || 0) - (r.pagoPorMes[iso] || 0);
    const recSubTotal = recRows.reduce((s, r) => s + r.aberto, 0);
    const receber = recRows.length ? {
      rows: recRows,
      subPorMes: proximosMeses.map(m => recRows.reduce((s, r) => s + recAbertoMes(r, m.iso), 0)),
      subTotal: recSubTotal,
      subMedia: recSubTotal / n,
    } : null;

    // ===== Saldo previsto (entradas − saídas) =====
    const saldoMes = proximosMeses.map((m, i) => (receber ? receber.subPorMes[i] : 0) - totaisMes[i]);
    const saldoTotal = (receber ? receber.subTotal : 0) - totalGeral;

    return { grupos, totaisMes, totalGeral, media: totalGeral / n, receber, saldoMes, saldoTotal, saldoMedia: saldoTotal / n, vazio: todas.length === 0 && !receber };
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques, escopoAtivo, proximosMeses, anoProj]);

  // ===== Cheques a receber — TODOS, independente da janela de projeção =====
  // A matriz acima só cobre 6 meses; um cheque com vencimento fora dessa janela
  // (ex.: ano seguinte) não aparece lá. Lista aguardando + compensados (estes
  // riscados, já recebidos). O total conta só os aguardando.
  const chequesAReceber = useMemo(() => {
    const noEsc = (c) => escopoAtivo === "tudo" || (c.escopo || "pessoal") === escopoAtivo;
    const hoje = new Date().toISOString().slice(0, 10);
    const lista = (cheques || [])
      .filter(c => (c.status === "aguardando" || c.status === "compensado") && noEsc(c))
      .slice()
      .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
      .map(c => ({
        ...c,
        compensado: c.status === "compensado",
        vencido: c.status === "aguardando" && (c.vencimento || "") < hoje,
      }));
    const total = lista.filter(c => !c.compensado).reduce((s, c) => s + (Number(c.valor) || 0), 0);
    return { lista, total };
  }, [cheques, escopoAtivo]);
  const fmtData = (d) => d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "—";

  // ===== Cenários de Saldo previsto =====
  // Parte do SALDO ATUAL das contas e acumula (A receber − Saídas) mês a mês.
  // Dois cenários: Pessoal (só contas/dados pessoais) e Pessoal + Negócio (tudo).
  // Usa a MESMA base do Painel (somaContasBRL): respeita "fora do patrimônio"
  // (flag do usuário em Contas, não um chute por nome) e converte contas em
  // moeda estrangeira pra BRL pela cotação.
  const cenarios = useMemo(() => {
    const stateRaw = { transacoes: transacoesRaw, contas: contasRaw, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques };
    const cenario = (escopo) => {
      const contasEsc = filtrarPorEscopo(contasRaw || [], escopo);
      const saldoInicial = somaContasBRL(contasEsc);
      let acc = saldoInicial;
      const porMes = proximosMeses.map((m, idx) => {
        // Só o que ainda está EM ABERTO (não pago/recebido) — o que já foi
        // pago/recebido já está refletido no saldo das contas (saldoInicial),
        // contá-lo de novo aqui somaria/descontaria em dobro.
        // 1º mês também soma os a-receber ATRASADOS (vencidos antes da janela).
        let saidas = 0, receber = 0;
        try { saidas = getDespesasDoMes(m.iso, stateRaw, escopo).filter(d => d.status !== "paga").reduce((s, d) => s + (Number(d.valor) || 0), 0); } catch {}
        try { receber = getGanhosDoMes(m.iso, stateRaw, escopo, { incluirAtrasados: idx === 0, atrasadosDesde: `${anoProj}-01` }).filter(g => g.status !== "paga").reduce((s, g) => s + (Number(g.valor) || 0), 0); } catch {}
        acc += receber - saidas;
        return acc;
      });
      return { saldoInicial, porMes, saldoFinal: porMes[porMes.length - 1] ?? saldoInicial };
    };
    const foraPatrimonio = (contasRaw || []).filter(c => c?.foraPatrimonio);
    return {
      pessoal: cenario("pessoal"),
      tudo: cenario("tudo"),
      bensTotal: foraPatrimonio.reduce((s, c) => s + saldoContaBRL(c), 0),
      bensNomes: foraPatrimonio.map(c => c.nome).join(", "),
    };
  }, [transacoesRaw, contasRaw, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques, proximosMeses, anoProj]);

  const periodoLabel = proximosMeses.length
    ? `${proximosMeses[0].label} a ${proximosMeses[proximosMeses.length - 1].label}` : "";

  // Imprime a projeção (agrupada) numa única folha A4 (paisagem).
  const imprimirProjecao = () => {
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const cel = (v) => v ? esc(fmt(v)) : "—";
    // célula abatendo o já pago/recebido no mês — pago vira "—", igual ao app
    const celAberto = (r, iso) => {
      const aberto = (r.porMes[iso] || 0) - (r.pagoPorMes?.[iso] || 0);
      return aberto > 0.005 ? esc(fmt(aberto)) : "—";
    };
    const ths = proximosMeses.map(m => `<th>${esc(m.label)}</th>`).join("");
    const corpo = projecao.grupos.map(g => {
      const linhas = g.rows.map(r =>
        `<tr><td class="cat">${esc(r.cat)}</td>${proximosMeses.map(m => `<td class="n">${celAberto(r, m.iso)}</td>`).join("")}<td class="n tot">${esc(fmt(r.aberto ?? r.total))}</td></tr>`
      ).join("");
      const sub = `<tr class="sub"><td>${esc(g.label)} · subtotal</td>${g.subPorMes.map(v => `<td class="n">${cel(v)}</td>`).join("")}<td class="n">${esc(fmt(g.subTotal))}</td></tr>`;
      const head = `<tr class="grp"><td colspan="${proximosMeses.length + 3}">${esc(g.label)}</td></tr>`;
      return head + linhas + sub;
    }).join("");
    const rodape = `<tr class="tfoot"><td>TOTAL SAÍDAS</td>${proximosMeses.map((m, i) => `<td class="n">${cel(projecao.totaisMes[i])}</td>`).join("")}<td class="n">${esc(fmt(projecao.totalGeral))}</td></tr>`;
    let receberHtml = "";
    if (projecao.receber) {
      const r = projecao.receber;
      const linhas = r.rows.map(x =>
        `<tr><td class="cat">${esc(x.cat)}</td>${proximosMeses.map(m => `<td class="n">${celAberto(x, m.iso)}</td>`).join("")}<td class="n tot">${esc(fmt(x.aberto ?? x.total))}</td></tr>`
      ).join("");
      const sub = `<tr class="sub"><td>A receber · subtotal</td>${r.subPorMes.map(v => `<td class="n">${cel(v)}</td>`).join("")}<td class="n">${esc(fmt(r.subTotal))}</td></tr>`;
      receberHtml = `<tr class="grp grp-rec"><td colspan="${proximosMeses.length + 3}">A receber (entradas previstas)</td></tr>${linhas}${sub}`;
    }
    const linhaSaldo = (label, cen) => `<tr class="saldo"><td>${esc(label)} · início ${esc(fmt(cen.saldoInicial))}</td>${cen.porMes.map(v => `<td class="n ${v < 0 ? "neg" : "pos"}">${esc(fmt(v))}</td>`).join("")}<td class="n ${cen.saldoFinal < 0 ? "neg" : "pos"}">${esc(fmt(cen.saldoFinal))}</td></tr>`;
    const saldo = linhaSaldo("SALDO PREVISTO · PESSOAL", cenarios.pessoal)
      + linhaSaldo("SALDO PREVISTO · PESSOAL + NEGÓCIO", cenarios.tudo)
      + (cenarios.bensTotal > 0 ? `<tr><td>BENS (à parte)</td>${proximosMeses.map(() => '<td class="n">—</td>').join("")}<td class="n">${esc(fmt(cenarios.bensTotal))}</td></tr>` : "");
    printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Projeção · Meses a Vencer</title>
<style>
@page { size: A4 landscape; margin: 9mm; }
body { font-family:${FONTE_ARRED_PRINT}; color:#111; margin:0; }
h1 { font-size:15px; margin:0 0 2px; }
.sub-head { color:#666; font-size:10.5px; margin:0 0 8px; }
table { width:100%; border-collapse:collapse; font-size:10.5px; }
th,td { padding:3px 6px; border-bottom:1px solid #e5e5e5; }
th { text-transform:uppercase; font-size:8.5px; letter-spacing:.04em; color:#666; text-align:right; }
th:first-child, td.cat { text-align:left; }
td.cat { padding-left:14px; }
td.n { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
td.tot { font-weight:700; }
tr.grp td { background:#f1ede6; font-weight:700; text-transform:uppercase; font-size:9px; letter-spacing:.05em; border-bottom:1px solid #d8cfbf; }
tr.grp-rec td { background:#e9f0ea; border-bottom:1px solid #cfe0d2; }
tr.sub td { font-weight:600; border-top:1px solid #ccc; background:#faf8f4; }
.tfoot td { font-weight:700; border-top:2px solid #111; border-bottom:none; font-size:11px; }
tr.saldo td { font-weight:700; border-top:1px solid #111; border-bottom:none; font-size:11px; background:#fbfaf7; }
td.pos { color:#1f7a44; }
td.neg { color:#b3261e; }
</style></head><body>
<h1>Projeção · Meses a Vencer — por categoria</h1>
<div class="sub-head">Saídas previstas (fixas, parcelas, dívidas, avulsas) e entradas a receber · ${esc(periodoLabel)} · gerado em ${esc(new Date().toLocaleString("pt-BR"))}</div>
<table><thead><tr><th>Categoria</th>${ths}<th>Total</th></tr></thead>
<tbody>${corpo}${rodape}${receberHtml}${saldo}</tbody></table>
</body></html>`);
  };

  // Imprime SÓ a relação de cheques a receber (A4 retrato). Lista os aguardando
  // e os já compensados (riscados), com o total aguardando ao pé.
  const imprimirCheques = () => {
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const linhas = chequesAReceber.lista.map(c => {
      const situ = c.compensado ? "compensado" : c.vencido ? "vencido" : "aguardando";
      const banco = [c.banco, c.numero ? `nº ${c.numero}` : ""].filter(Boolean).join(" · ") || "—";
      return `<tr class="${c.compensado ? "comp" : ""}"><td>${esc(fmtData(c.vencimento))}</td><td>${esc(c.de || "—")}</td><td>${esc(banco)}</td><td class="situ">${esc(situ)}</td><td class="n">${esc(fmt(Number(c.valor) || 0))}</td></tr>`;
    }).join("");
    const total = `<tr class="tfoot"><td colspan="4">Total aguardando</td><td class="n">${esc(fmt(chequesAReceber.total))}</td></tr>`;
    printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Cheques a receber</title>
<style>
@page { size: A4 portrait; margin: 12mm; }
body { font-family:${FONTE_ARRED_PRINT}; color:#111; margin:0; }
h1 { font-size:16px; margin:0 0 2px; }
.sub-head { color:#666; font-size:10.5px; margin:0 0 10px; }
table { width:100%; border-collapse:collapse; font-size:11px; }
th,td { padding:5px 8px; border-bottom:1px solid #e5e5e5; text-align:left; }
th { text-transform:uppercase; font-size:8.5px; letter-spacing:.04em; color:#666; }
td.n, th.n { text-align:right; white-space:nowrap; font-variant-numeric:tabular-nums; }
td.situ { text-transform:uppercase; font-size:8.5px; letter-spacing:.04em; color:#666; }
tr.comp td { color:#888; text-decoration:line-through; }
tr.comp td.situ { text-decoration:none; color:#1f7a44; }
.tfoot td { font-weight:700; border-top:2px solid #111; border-bottom:none; font-size:12px; text-decoration:none; }
</style></head><body>
<h1>Cheques a receber</h1>
<div class="sub-head">Relação de cheques · gerado em ${esc(new Date().toLocaleString("pt-BR"))}</div>
<table><thead><tr><th>Vencimento</th><th>Emitente</th><th>Banco · nº</th><th>Situação</th><th class="n">Valor</th></tr></thead>
<tbody>${linhas || `<tr><td colspan="5">Nenhum cheque.</td></tr>`}${total}</tbody></table>
</body></html>`);
  };

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Finanças · Relatórios</div>
      <h1 className="h1">Análises <em>do período.</em></h1>
      <p className="hs">Projeção dos próximos meses por categoria.</p>

      {/* Projeção · Meses a vencer — por categoria (matriz, imprime em 1 folha A4) */}
      <div style={{ marginTop: 16, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: CARD_SHADOW, fontFamily: FONTE_ARRED }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Projeção · Meses a vencer</div>
            <div style={{ fontFamily: FONTE_ARRED, fontSize: 17, fontWeight: 700, color: T.ink }}>Por categoria · {periodoLabel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select value={anoProj} onChange={e => setAnoProj(parseInt(e.target.value))}
                    style={{ padding: "8px 11px", background: T.bgSoft, border: `1px solid ${T.border}`,
                             color: T.ink, fontSize: 12, borderRadius: 10, cursor: "pointer" }}>
              {[anoAtualProj - 1, anoAtualProj, anoAtualProj + 1, anoAtualProj + 2].map(y =>
                <option key={y} value={y}>{y}</option>
              )}
            </select>
            <button onClick={imprimirProjecao} className="btn-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
              🖨️ Imprimir (A4 · 1 folha)
            </button>
          </div>
        </div>
        {!projecao.vazio && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 14 }}>
            <StatTile label="A receber (previsto)" valor={projecao.receber?.subTotal || 0} hidden={hidden} cor={T.green} icon={ArrowDownLeft} sub={periodoLabel} spark={projecao.receber?.subPorMes} />
            <StatTile label="Saídas (previstas)" valor={projecao.totalGeral} hidden={hidden} cor={T.red} icon={ArrowUpRight} sub={periodoLabel} spark={projecao.totaisMes} />
            <StatTile label="Saldo previsto" valor={projecao.saldoTotal} hidden={hidden} cor={projecao.saldoTotal >= 0 ? T.green : T.red} icon={Wallet} sub="receber − saídas" spark={projecao.saldoMes} />
          </div>
        )}
        {projecao.vazio ? (
          <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
            Sem compromissos previstos (fixas, parcelas, dívidas) nos próximos 6 meses.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%", minWidth: 760, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Categoria</th>
                  {proximosMeses.map(m => <th key={m.iso} style={{ textAlign: "right" }}>{m.label}</th>)}
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {projecao.grupos.map(g => (
                  <React.Fragment key={g.fonte}>
                    <tr>
                      <td colSpan={proximosMeses.length + 2} style={{ background: T.bgSoft, color: T.ink, fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: ".08em", padding: "6px 8px" }}>
                        {g.label}
                      </td>
                    </tr>
                    {g.rows.map((r, idx) => {
                      const totQuit = r.total > 0 && (r.pagoTotal || 0) >= r.total - 0.005;
                      return (
                      <tr key={r.cat}>
                        <td style={{ color: T.ink, fontWeight: idx === 0 ? 700 : 500, paddingLeft: 14 }}>{r.cat}</td>
                        {proximosMeses.map(m => {
                          // Mostra o que FALTA pagar no mês (abatendo o já pago) —
                          // consistente com o subtotal; pago vira "—".
                          const aberto = (r.porMes[m.iso] || 0) - (r.pagoPorMes?.[m.iso] || 0);
                          return (
                            <td key={m.iso} className="num" style={{ textAlign: "right", color: aberto > 0.005 ? T.muted : T.faint }}>
                              {aberto > 0.005 ? (hidden ? "•••" : fmt(aberto)) : "—"}
                            </td>
                          );
                        })}
                        <td className="num" style={{ textAlign: "right", color: totQuit ? T.green : T.ink, fontWeight: 700, textDecoration: totQuit ? "line-through" : "none", textDecorationColor: totQuit ? `${T.green}99` : undefined }} title={totQuit ? "Já pago" : "Em aberto"}>{hidden ? "•••" : fmt(r.aberto ?? r.total)}</td>
                      </tr>
                      );
                    })}
                    <tr>
                      <td style={{ fontWeight: 600, color: T.muted, fontSize: 11.5, paddingLeft: 14, borderTop: `1px solid ${T.border}` }}>{g.label} · subtotal</td>
                      {g.subPorMes.map((v, i) => (
                        <td key={i} className="num" style={{ textAlign: "right", fontWeight: 600, color: T.muted, borderTop: `1px solid ${T.border}` }}>{hidden ? "•••" : (v ? fmt(v) : "—")}</td>
                      ))}
                      <td className="num" style={{ textAlign: "right", fontWeight: 700, color: T.ink, borderTop: `1px solid ${T.border}` }}>{hidden ? "•••" : fmt(g.subTotal)}</td>
                    </tr>
                  </React.Fragment>
                ))}
                <tr style={{ borderTop: `2px solid ${T.border}` }}>
                  <td style={{ fontWeight: 700, color: T.ink, textTransform: "uppercase", fontSize: 10.5, letterSpacing: ".05em" }}>Total saídas</td>
                  {proximosMeses.map((m, i) => (
                    <td key={m.iso} className="num" style={{ textAlign: "right", fontWeight: 700, color: T.ink }}>{hidden ? "•••" : fmt(projecao.totaisMes[i])}</td>
                  ))}
                  <td className="num" style={{ textAlign: "right", fontWeight: 700, color: T.gold }}>{hidden ? "•••" : fmt(projecao.totalGeral)}</td>
                </tr>

                {projecao.receber && (
                  <>
                    <tr>
                      <td colSpan={proximosMeses.length + 2} style={{ background: "rgba(31,122,68,.08)", color: T.ink, fontWeight: 700, textTransform: "uppercase", fontSize: 10, letterSpacing: ".08em", padding: "6px 8px" }}>
                        A receber (entradas previstas)
                      </td>
                    </tr>
                    {projecao.receber.rows.map((r, idx) => {
                      const totQuit = r.total > 0 && (r.pagoTotal || 0) >= r.total - 0.005;
                      return (
                      <tr key={r.cat}>
                        <td style={{ color: T.ink, fontWeight: idx === 0 ? 700 : 500, paddingLeft: 14 }}>{r.cat}</td>
                        {proximosMeses.map(m => {
                          // Mostra o que FALTA receber no mês (abatendo o já recebido)
                          // — consistente com o subtotal; recebido vira "—".
                          const aberto = (r.porMes[m.iso] || 0) - (r.pagoPorMes?.[m.iso] || 0);
                          return (
                            <td key={m.iso} className="num" style={{ textAlign: "right", color: aberto > 0.005 ? T.muted : T.faint }}>
                              {aberto > 0.005 ? (hidden ? "•••" : fmt(aberto)) : "—"}
                            </td>
                          );
                        })}
                        <td className="num" style={{ textAlign: "right", color: totQuit ? T.green : T.ink, fontWeight: 700, textDecoration: totQuit ? "line-through" : "none", textDecorationColor: totQuit ? `${T.green}99` : undefined }} title={totQuit ? "Já pago" : "Em aberto"}>{hidden ? "•••" : fmt(r.aberto ?? r.total)}</td>
                      </tr>
                      );
                    })}
                    <tr>
                      <td style={{ fontWeight: 600, color: T.muted, fontSize: 11.5, paddingLeft: 14, borderTop: `1px solid ${T.border}` }}>A receber · subtotal</td>
                      {projecao.receber.subPorMes.map((v, i) => (
                        <td key={i} className="num" style={{ textAlign: "right", fontWeight: 600, color: T.muted, borderTop: `1px solid ${T.border}` }}>{hidden ? "•••" : (v ? fmt(v) : "—")}</td>
                      ))}
                      <td className="num" style={{ textAlign: "right", fontWeight: 700, color: T.ink, borderTop: `1px solid ${T.border}` }}>{hidden ? "•••" : fmt(projecao.receber.subTotal)}</td>
                    </tr>
                  </>
                )}

                {/* Saldo previsto · 2 cenários — parte do saldo atual das contas e acumula (receber − saídas). */}
                {[
                  { label: "Saldo previsto · Pessoal", cen: cenarios.pessoal },
                  { label: "Saldo previsto · Pessoal + Negócio", cen: cenarios.tudo },
                ].map((sc, idx) => (
                  <tr key={sc.label} style={{ borderTop: idx === 0 ? `2px solid ${T.ink}` : "none" }}>
                    <td style={{ fontWeight: 700, color: T.ink, fontSize: 10.5, letterSpacing: ".03em" }}>
                      {sc.label}
                      <span style={{ display: "block", fontSize: 9, color: T.muted, fontWeight: 400 }}>
                        início {hidden ? "•••" : fmt(sc.cen.saldoInicial)}
                      </span>
                    </td>
                    {sc.cen.porMes.map((v, i) => (
                      <td key={i} className="num" style={{ textAlign: "right", fontWeight: 700, color: v < 0 ? "#b3261e" : "#1f7a44" }}>{hidden ? "•••" : fmt(v)}</td>
                    ))}
                    <td className="num" style={{ textAlign: "right", fontWeight: 700, color: sc.cen.saldoFinal < 0 ? "#b3261e" : "#1f7a44" }}>{hidden ? "•••" : fmt(sc.cen.saldoFinal)}</td>
                  </tr>
                ))}
                {cenarios.bensTotal > 0 && (
                  <tr>
                    <td style={{ fontWeight: 600, color: T.muted, fontSize: 10.5 }} title={cenarios.bensNomes}>
                      Bens (à parte, fora do saldo)
                    </td>
                    {proximosMeses.map((m, i) => <td key={i} className="num" style={{ textAlign: "right", color: T.faint }}>—</td>)}
                    <td className="num" style={{ textAlign: "right", fontWeight: 700, color: T.ink }}>{hidden ? "•••" : fmt(cenarios.bensTotal)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cheques a receber — todos os aguardando, independente do ano/janela */}
      <div style={{ marginTop: 16, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: CARD_SHADOW, fontFamily: FONTE_ARRED }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Recebíveis</div>
            <div style={{ fontFamily: FONTE_ARRED, fontSize: 17, fontWeight: 700, color: T.ink }}>Cheques a receber</div>
          </div>
          {chequesAReceber.lista.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Total aguardando</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 700, color: T.gold }}>{hidden ? "•••" : fmt(chequesAReceber.total)}</div>
              </div>
              <button onClick={imprimirCheques} className="btn-gold" style={{ padding: "8px 14px", fontSize: 12, whiteSpace: "nowrap" }}>
                🖨️ Imprimir cheques
              </button>
            </div>
          )}
        </div>
        {chequesAReceber.lista.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
            Nenhum cheque aguardando compensação.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tbl" style={{ width: "100%", minWidth: 520, fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Vencimento</th>
                  <th style={{ textAlign: "left" }}>Emitente</th>
                  <th style={{ textAlign: "left" }}>Banco · nº</th>
                  <th style={{ textAlign: "right" }}>Valor</th>
                </tr>
              </thead>
              <tbody>
                {chequesAReceber.lista.map(c => {
                  // Compensado = já recebido → linha riscada.
                  const deco = c.compensado ? "line-through" : "none";
                  const corBase = c.compensado ? T.faint : T.ink;
                  return (
                  <tr key={c.id} style={{ opacity: c.compensado ? 0.75 : 1 }}>
                    <td style={{ color: c.compensado ? T.green : (c.vencido ? T.red : T.ink), fontWeight: 700, whiteSpace: "nowrap", textDecoration: deco }}>
                      {fmtData(c.vencimento)}{c.compensado ? " · compensado" : c.vencido ? " · vencido" : ""}
                    </td>
                    <td style={{ color: corBase, fontWeight: 500, textDecoration: deco }}>{c.de || "—"}</td>
                    <td style={{ color: T.muted, textDecoration: deco }}>{[c.banco, c.numero ? `nº ${c.numero}` : ""].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="num" style={{ textAlign: "right", color: corBase, fontWeight: 600, textDecoration: deco }}>{hidden ? "•••" : fmt(c.valor)}</td>
                  </tr>
                  );
                })}
                <tr>
                  <td colSpan={3} style={{ fontWeight: 700, color: T.ink, borderTop: `2px solid ${T.ink}` }}>Total</td>
                  <td className="num" style={{ textAlign: "right", fontWeight: 700, color: T.gold, borderTop: `2px solid ${T.ink}` }}>{hidden ? "•••" : fmt(chequesAReceber.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ExportableCard({ id, title, children, footer, csvData, csvName, pngOk }) {
  return (
    <div id={id}>
      <ReportCard
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>{title}</span>
            <div className="no-print" style={{ display: "inline-flex", gap: 4 }}>
              <ExportBtn label="📄 PDF" onClick={() => { try { toPDF(id); toast.info("Abrindo impressão — escolha “Salvar como PDF”."); } catch { toast.error("Não foi possível gerar o PDF."); } }} />
              <ExportBtn label="📊 CSV" onClick={() => { try { toCSV(csvData, csvName); toast.success("CSV baixado."); } catch { toast.error("Não foi possível gerar o CSV."); } }} />
              {pngOk && <ExportBtn label="🖼️ PNG" onClick={async () => { try { await toPNG(id, csvName.replace(".csv", ".png")); toast.success("Imagem (PNG) baixada."); } catch { toast.error("Não foi possível gerar a imagem."); } }} />}
            </div>
          </div>
        }
        footer={footer}
      >
        {children}
      </ReportCard>
    </div>
  );
}

function ExportBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: "transparent", color: T.muted,
        border: `1px solid ${T.border}`, borderRadius: 5,
        padding: "5px 10px", fontSize: 9.5, fontWeight: 600,
        letterSpacing: ".05em", cursor: "pointer", whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
      {label}
    </button>
  );
}
