import React, { useMemo, useState, useEffect } from "react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { BarChartDouble, BarChart, HorizontalBarList, ReportCard, ReportGrid } from "../ui/Charts.jsx";
import { toPDF, toCSV, toPNG, hasPNGSupport } from "../../lib/exportRelatorio.js";
import { toast } from "../../lib/toast.js";
import { getKPIsMes, getDespesasDoMes, getGanhosDoMes } from "../../lib/agregador.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { printHTML } from "../../lib/importExport.js";

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
  fixas = [], fixaOcorrencias = [], parcelamentos = [], dividas = [], devedores = [],
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
  const mesAtualKey = new Date().toISOString().slice(0, 7);
  // ===== Receita vs Despesa últimos 6 meses =====
  const seisMeses = useMemo(() => {
    const hoje = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const nome = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()];
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
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores };
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
    const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
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
    const state = { transacoes, fixas, fixaOcorrencias, parcelamentos, dividas, devedores };
    const meses = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const nome = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()];
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
    for (let i = 1; i <= 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      out.push({ iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${MESES_PROJ[d.getMonth()]}/${String(d.getFullYear()).slice(2)}` });
    }
    return out;
  }, []);

  const projecao = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores };
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
        const r = map[key] || (map[key] = { fonte, cat, porMes: {}, total: 0 });
        const v = Number(d.valor) || 0;
        r.porMes[m.iso] = (r.porMes[m.iso] || 0) + v;
        r.total += v;
      });
    });
    const n = proximosMeses.length || 1;
    const todas = Object.values(map).filter(r => r.total > 0).map(r => ({ ...r, media: r.total / n }));
    // Agrupa por fonte (Fixas, Parcelas, Dívidas, Avulsas), com subtotais.
    const grupos = FONTE_ORDEM.map(fonte => {
      const rows = todas.filter(r => r.fonte === fonte).sort((a, b) => b.total - a.total);
      if (!rows.length) return null;
      const subTotal = rows.reduce((s, r) => s + r.total, 0);
      const subPorMes = proximosMeses.map(m => rows.reduce((s, r) => s + (r.porMes[m.iso] || 0), 0));
      return { fonte, label: FONTE_LABEL[fonte], rows, subTotal, subMedia: subTotal / n, subPorMes };
    }).filter(Boolean);
    const totaisMes = proximosMeses.map(m => todas.reduce((s, r) => s + (r.porMes[m.iso] || 0), 0));
    const totalGeral = todas.reduce((s, r) => s + r.total, 0);

    // ===== A receber (entradas previstas) — por categoria =====
    const recMap = {};
    proximosMeses.forEach(m => {
      let gan = [];
      try { gan = getGanhosDoMes(m.iso, state, escopoAtivo); } catch {}
      gan.forEach(g => {
        const baseG = g.categoria || "Receita";
        const subG = (g.subcategoria || "").trim();
        const cat = subG ? `${baseG} › ${subG}` : baseG;
        const r = recMap[cat] || (recMap[cat] = { cat, porMes: {}, total: 0 });
        const v = Number(g.valor) || 0;
        r.porMes[m.iso] = (r.porMes[m.iso] || 0) + v;
        r.total += v;
      });
    });
    const recRows = Object.values(recMap).filter(r => r.total > 0)
      .map(r => ({ ...r, media: r.total / n })).sort((a, b) => b.total - a.total);
    const receber = recRows.length ? {
      rows: recRows,
      subPorMes: proximosMeses.map(m => recRows.reduce((s, r) => s + (r.porMes[m.iso] || 0), 0)),
      subTotal: recRows.reduce((s, r) => s + r.total, 0),
      subMedia: recRows.reduce((s, r) => s + r.total, 0) / n,
    } : null;

    // ===== Saldo previsto (entradas − saídas) =====
    const saldoMes = proximosMeses.map((m, i) => (receber ? receber.subPorMes[i] : 0) - totaisMes[i]);
    const saldoTotal = (receber ? receber.subTotal : 0) - totalGeral;

    return { grupos, totaisMes, totalGeral, media: totalGeral / n, receber, saldoMes, saldoTotal, saldoMedia: saldoTotal / n, vazio: todas.length === 0 && !receber };
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, escopoAtivo, proximosMeses]);

  // ===== Cenários de Saldo previsto =====
  // Parte do SALDO ATUAL das contas e acumula (A receber − Saídas) mês a mês.
  // Dois cenários: Pessoal (só contas/dados pessoais) e Pessoal + Negócio (tudo).
  // A conta "bem" (imóvel/veículo/patrimônio físico) fica fora do saldo líquido.
  const ehBem = (c) => /\bbem\b|\bbens\b|im[oó]ve|ve[ií]cul|autom[oó]ve|\bcarro\b|patrim/i.test(c?.nome || "");
  const cenarios = useMemo(() => {
    const stateRaw = { transacoes: transacoesRaw, contas: contasRaw, fixas, fixaOcorrencias, parcelamentos, dividas, devedores };
    const cenario = (escopo) => {
      const contasEsc = filtrarPorEscopo(contasRaw || [], escopo).filter(c => !ehBem(c));
      const saldoInicial = contasEsc.reduce((s, c) => s + (Number(c.saldo) || 0), 0);
      let acc = saldoInicial;
      const porMes = proximosMeses.map(m => {
        let saidas = 0, receber = 0;
        try { saidas = getDespesasDoMes(m.iso, stateRaw, escopo).reduce((s, d) => s + (Number(d.valor) || 0), 0); } catch {}
        try { receber = getGanhosDoMes(m.iso, stateRaw, escopo).reduce((s, g) => s + (Number(g.valor) || 0), 0); } catch {}
        acc += receber - saidas;
        return acc;
      });
      return { saldoInicial, porMes, saldoFinal: porMes[porMes.length - 1] ?? saldoInicial };
    };
    const bens = (contasRaw || []).filter(ehBem);
    return {
      pessoal: cenario("pessoal"),
      tudo: cenario("tudo"),
      bensTotal: bens.reduce((s, c) => s + (Number(c.saldo) || 0), 0),
      bensNomes: bens.map(c => c.nome).join(", "),
    };
  }, [transacoesRaw, contasRaw, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, proximosMeses]);

  const periodoLabel = proximosMeses.length
    ? `${proximosMeses[0].label} a ${proximosMeses[proximosMeses.length - 1].label}` : "";

  // Imprime a projeção (agrupada) numa única folha A4 (paisagem).
  const imprimirProjecao = () => {
    const esc = (s) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
    const cel = (v) => v ? esc(fmt(v)) : "—";
    const ths = proximosMeses.map(m => `<th>${esc(m.label)}</th>`).join("");
    const corpo = projecao.grupos.map(g => {
      const linhas = g.rows.map(r =>
        `<tr><td class="cat">${esc(r.cat)}</td>${proximosMeses.map(m => `<td class="n">${cel(r.porMes[m.iso])}</td>`).join("")}<td class="n tot">${esc(fmt(r.total))}</td></tr>`
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
        `<tr><td class="cat">${esc(x.cat)}</td>${proximosMeses.map(m => `<td class="n">${cel(x.porMes[m.iso])}</td>`).join("")}<td class="n tot">${esc(fmt(x.total))}</td></tr>`
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

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Finanças · Relatórios</div>
      <h1 className="h1">Análises <em>do período.</em></h1>
      <p className="hs">Evolução · categorias · sobra mensal · tendências · maiores gastos.</p>

      {/* Evolução do patrimônio (snapshot diário) — visão de longo prazo */}
      <div style={{ marginTop: 16 }}>
        <EvolucaoPatrimonio historico={patrimonioHistorico} hidden={hidden} />
      </div>

      {/* Projeção · Meses a vencer — por categoria (matriz, imprime em 1 folha A4) */}
      <div style={{ marginTop: 16, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)", fontFamily: FONTE_ARRED }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Projeção · Meses a vencer</div>
            <div style={{ fontFamily: FONTE_ARRED, fontSize: 17, fontWeight: 700, color: T.ink }}>Por categoria · {periodoLabel}</div>
          </div>
          <button onClick={imprimirProjecao} className="btn-gold" style={{ padding: "8px 14px", fontSize: 12 }}>
            🖨️ Imprimir (A4 · 1 folha)
          </button>
        </div>
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
                    {g.rows.map((r, idx) => (
                      <tr key={r.cat}>
                        <td style={{ color: T.ink, fontWeight: idx === 0 ? 700 : 500, paddingLeft: 14 }}>{r.cat}</td>
                        {proximosMeses.map(m => (
                          <td key={m.iso} className="num" style={{ textAlign: "right", color: r.porMes[m.iso] ? T.muted : T.faint }}>
                            {r.porMes[m.iso] ? (hidden ? "•••" : fmt(r.porMes[m.iso])) : "—"}
                          </td>
                        ))}
                        <td className="num" style={{ textAlign: "right", color: T.ink, fontWeight: 700 }}>{hidden ? "•••" : fmt(r.total)}</td>
                      </tr>
                    ))}
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
                    {projecao.receber.rows.map((r, idx) => (
                      <tr key={r.cat}>
                        <td style={{ color: T.ink, fontWeight: idx === 0 ? 700 : 500, paddingLeft: 14 }}>{r.cat}</td>
                        {proximosMeses.map(m => (
                          <td key={m.iso} className="num" style={{ textAlign: "right", color: r.porMes[m.iso] ? T.muted : T.faint }}>
                            {r.porMes[m.iso] ? (hidden ? "•••" : fmt(r.porMes[m.iso])) : "—"}
                          </td>
                        ))}
                        <td className="num" style={{ textAlign: "right", color: T.ink, fontWeight: 700 }}>{hidden ? "•••" : fmt(r.total)}</td>
                      </tr>
                    ))}
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

      <ReportGrid>
        <ExportableCard
          id="rep-receita-despesa"
          title="Receita vs Despesa (6 meses)"
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Receitas", "Despesas"],
            rows: seisMeses.map(m => [m.label, m.value1, m.value2]),
          }}
          csvName={`af4-receita-vs-despesa-${mesAtualKey}.csv`}
        >
          <BarChartDouble
            data={seisMeses}
            colors={[T.gold, T.red]}
            labels={["Receitas", "Despesas"]}
            formatValue={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
          />
        </ExportableCard>

        <ExportableCard
          id="rep-top-categorias"
          title="Top categorias do mês"
          pngOk={pngOk}
          csvData={{
            headers: ["Categoria", "Total"],
            rows: topCategorias.map(c => [c.label, c.value]),
          }}
          csvName={`af4-top-categorias-${mesAtualKey}.csv`}
        >
          {topCategorias.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem despesas categorizadas este mês.
            </div>
          ) : (
            <HorizontalBarList
              data={topCategorias.map(c => ({ ...c, color: T.gold }))}
              formatValue={v => hidden ? "•••" : fmt(v)}
            />
          )}
        </ExportableCard>

        <ExportableCard
          id="rep-sobra-mensal"
          title="Sobra mensal (6 meses)"
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Sobra (receita − despesa)"],
            rows: sobraMensal.map(m => [m.label, m.value.toFixed(2)]),
          }}
          csvName={`af4-sobra-mensal-${mesAtualKey}.csv`}
          footer={
            <>💰 Sobra média real: <strong style={{ color: sobraMediaReal >= 0 ? T.green : T.red }}>{hidden ? "•••" : fmt(sobraMediaReal)}</strong>/mês ·
              acumulado 6m: {hidden ? "•••" : fmt(sobraTotalReal)}
            </>
          }
        >
          <BarChart
            data={sobraMensal}
            color={T.gold}
            formatValue={v => Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
          />
        </ExportableCard>

        <ExportableCard
          id="rep-acumulado-ano"
          title={`Sobra acumulada no ano (${new Date().getFullYear()})`}
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Acumulado no ano"],
            rows: acumuladoAno.map(c => [c.label, c.value.toFixed(2)]),
          }}
          csvName={`af4-acumulado-ano-${mesAtualKey}.csv`}
          footer={
            <>📊 Resultado acumulado do ano até agora:&nbsp;
              <strong style={{ color: sobraAnoTotal >= 0 ? T.green : T.red }}>{hidden ? "•••" : fmt(sobraAnoTotal)}</strong>
            </>
          }
        >
          <BarChart
            data={acumuladoAno}
            color={T.gold}
            formatValue={v => hidden ? "•••" : (Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0))}
          />
        </ExportableCard>

        <ExportableCard
          id="rep-projecao-real"
          title="Projeção · meses a vencer"
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Despesas previstas", "Ganhos previstos", "Saldo"],
            rows: projecaoReal.map(m => [m.label, m.despesas.toFixed(2), m.ganhos.toFixed(2), m.saldo.toFixed(2)]),
          }}
          csvName={`af4-projecao-meses-${mesAtualKey}.csv`}
          footer={
            <>📅 Baseado em compromissos já agendados (fixas, parcelas, dívidas, devedores) nos próximos 6 meses.</>
          }
        >
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 6, padding: "6px 0",
          }}>
            {projecaoReal.map(m => (
              <div key={m.label} style={{
                background: T.bgSoft, padding: 9, borderRadius: 11,
                borderTop: `3px solid ${m.saldo >= 0 ? T.green : T.red}`,
              }}>
                <div style={{
                  fontSize: 9.5, letterSpacing: ".1em", color: T.muted,
                  textTransform: "uppercase", fontWeight: 700,
                }}>{m.label}</div>
                <div className="num" style={{ fontSize: 11, color: T.green, marginTop: 4 }}>
                  + {hidden ? "•••" : fmt(m.ganhos)}
                </div>
                <div className="num" style={{ fontSize: 11, color: T.red }}>
                  − {hidden ? "•••" : fmt(m.despesas)}
                </div>
                <div className="num" style={{
                  fontSize: 12.5, fontWeight: 700, marginTop: 4,
                  color: m.saldo >= 0 ? T.green : T.red,
                  borderTop: `1px solid ${T.border}`, paddingTop: 3,
                }}>
                  = {m.saldo >= 0 ? "+ " : "− "}{hidden ? "•••" : fmt(Math.abs(m.saldo))}
                </div>
              </div>
            ))}
          </div>
        </ExportableCard>

        {/* Tendência por categoria (6 meses) */}
        <ExportableCard
          id="rep-tendencia-categorias"
          title="Tendência por categoria (6m)"
          pngOk={pngOk}
          csvData={{
            headers: ["Categoria", "Mês atual", "Média 5m ant.", "Variação %", "Total 6m"],
            rows: tendenciaCategorias.map(l => [l.cat, l.atual.toFixed(2), l.mediaAnt.toFixed(2), l.variacao.toFixed(1), l.total6m.toFixed(2)]),
          }}
          csvName={`af4-tendencia-categorias-${mesAtualKey}.csv`}
          footer={<>↑ subindo · ↓ caindo — variação do mês atual vs média dos 5 meses anteriores.</>}
        >
          {tendenciaCategorias.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem despesas nos últimos 6 meses.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {tendenciaCategorias.map(l => {
                const sobe = l.variacao > 5, cai = l.variacao < -5;
                const cor = sobe ? T.red : cai ? T.green : T.muted;
                const max = Math.max(...l.serie, 1);
                return (
                  <div key={l.cat} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", padding: "6px 8px", background: T.bgSoft, borderRadius: 11 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.cat}</div>
                      {/* Sparkline simples (6 barrinhas) */}
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 16, marginTop: 3 }}>
                        {l.serie.map((v, i) => (
                          <div key={i} title={hidden ? "" : fmt(v)} style={{ width: 6, height: `${Math.max(8, (v / max) * 100)}%`, background: i === l.serie.length - 1 ? cor : T.border, borderRadius: 1 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="num" style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{hidden ? "•••" : fmt(l.atual)}</div>
                      <div className="num" style={{ fontSize: 10.5, color: cor, fontWeight: 600 }}>
                        {sobe ? "↑" : cai ? "↓" : "→"} {l.variacao >= 0 ? "+" : ""}{l.variacao.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ExportableCard>

        {/* Maiores gastos do mês */}
        <ExportableCard
          id="rep-maiores-gastos"
          title="Maiores gastos do mês"
          pngOk={pngOk}
          csvData={{
            headers: ["Descrição", "Categoria", "Data", "Conta", "Valor"],
            rows: maioresGastos.map(g => [g.descricao, g.categoria, g.data, g.conta, g.valor.toFixed(2)]),
          }}
          csvName={`af4-maiores-gastos-${mesAtualKey}.csv`}
          footer={<>🔎 As 8 maiores despesas individuais do mês atual.</>}
        >
          {maioresGastos.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem despesas este mês.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {maioresGastos.map((g, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", padding: "6px 8px", background: T.bgSoft, borderRadius: 11 }}>
                  <span style={{ fontSize: 10, color: T.faint, fontFamily: T.mono, width: 16, textAlign: "center" }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.descricao}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{g.categoria} · {(g.data || "").split("-").reverse().slice(0, 2).join("/")}</div>
                  </div>
                  <span className="num" style={{ fontSize: 12.5, color: T.red, fontWeight: 600 }}>{hidden ? "•••" : fmt(g.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </ExportableCard>
      </ReportGrid>
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
