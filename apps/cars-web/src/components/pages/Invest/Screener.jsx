import React, { useMemo, useState } from "react";
import { RefreshCw, Sparkles, Search, Bookmark, CalendarPlus, ArrowUp, ArrowDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import PageHeader from "../../ui/PageHeader.jsx";
import { getListaMercado, getDividendos, getFundamentosLote } from "../../../lib/brapi.js";
import { gerarJSONGemini } from "../../../lib/gemini.js";
import { proventosPorCota12m } from "../../../lib/mapaDividendos.js";
import { carregarWatchlist, salvarWatchlist, adicionarPapel } from "../../../lib/mercadoWatchlist.js";
import {
  normalizarLista, filtrarOrdenar, setoresDaLista,
  lerCacheLista, cacheValido, gravarCacheLista,
  indicadoresDoResultado, lotes,
  montarPromptFiltros, montarPromptShortlist,
} from "../../../lib/screener.js";

const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };
const KEY_CAND = "af4:mapa-div:candidatos:v1";
const KEY_PROV = "af4:mapa-div:proventos-brapi:v1"; // compartilhado com Mapa de Dividendos/YoC
const KEY_FUND = "af4:screener-fundamentos:v1"; // indicadores P/L·P/VP·ROE por ticker
const TIPOS = [
  { v: "todos", l: "Todos" },
  { v: "stock", l: "Ações" },
  { v: "fund", l: "FIIs" },
  { v: "bdr", l: "BDRs" },
];
const FILTROS_VAZIOS = {
  busca: "", tipo: "todos", setor: "",
  precoMin: null, precoMax: null, volumeMin: null,
  variacaoMin: null, variacaoMax: null, marketCapMin: null,
  plMax: null, pvpMax: null, roeMin: null,
  ordenarPor: "volume", direcao: "desc",
};

const fmtCap = (v) => {
  if (v == null) return "—";
  if (v >= 1e9) return `${fmtN(v / 1e9, 1)} B`;
  if (v >= 1e6) return `${fmtN(v / 1e6, 1)} M`;
  return fmtN(v, 0);
};
const fmtVol = (v) => (v >= 1e6 ? `${fmtN(v / 1e6, 1)} M` : v >= 1e3 ? `${fmtN(v / 1e3, 0)} k` : fmtN(v, 0));

/**
 * Screener de Mercado — o universo da B3 inteiro (ações, FIIs, BDRs) numa
 * tabela filtrável. Custa 1 requisição brapi por dia (cache 24h): a lista
 * completa vem de /quote/list. IA em duas camadas: pergunta em linguagem
 * natural → filtros; e parecer da shortlist visível.
 */
export default function Screener({ hidden }) {
  const [cache, setCache] = useState(() => lerCacheLista());
  const [carregando, setCarregando] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);
  const [pergunta, setPergunta] = useState("");
  const [iaRodando, setIaRodando] = useState(false);
  const [analise, setAnalise] = useState(null); // { analises:[{ticker,nota,parecer}], resumo }
  const [limite, setLimite] = useState(50);
  // Cache de proventos reais — COMPARTILHADO com o Mapa de Dividendos/YoC.
  const [provCache, setProvCache] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_PROV) || "null")?.porTicker || {}; } catch { return {}; }
  });
  const [buscandoDY, setBuscandoDY] = useState(false);
  // Indicadores fundamentalistas (P/L, P/VP, ROE, EV/EBITDA) por ticker —
  // plano pago da brapi: 20 tickers por requisição.
  const [fundCache, setFundCache] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_FUND) || "null")?.porTicker || {}; } catch { return {}; }
  });
  const [buscandoFund, setBuscandoFund] = useState(false);

  const lista = cache?.lista || [];
  const setores = useMemo(() => setoresDaLista(lista), [lista]);
  // Enriquece com DY 12m (proventos reais ÷ preço atual) quando o ticker já
  // tem histórico no cache — assim a coluna DY também é ordenável/filtrável.
  const listaComDy = useMemo(() => lista.map((x) => {
    const porCota = proventosPorCota12m(provCache[x.ticker]);
    const f = fundCache[x.ticker] || {};
    return {
      ...x,
      dy: porCota > 0 && x.preco > 0 ? (porCota / x.preco) * 100 : null,
      pl: f.pl ?? null, pvp: f.pvp ?? null, roe: f.roe ?? null, evEbitda: f.evEbitda ?? null,
    };
  }), [lista, provCache, fundCache]);
  const filtrada = useMemo(() => filtrarOrdenar(listaComDy, filtros), [listaComDy, filtros]);
  const visiveis = filtrada.slice(0, limite);

  // Busca proventos reais dos primeiros N papéis filtrados que ainda não têm
  // histórico (1 requisição POR papel — por isso é manual e limitado).
  async function buscarDYTopN(n = 20) {
    const alvos = filtrada.slice(0, n).map((x) => x.ticker).filter((tk) => !provCache[tk]);
    if (!alvos.length) { toast.info(`Os ${Math.min(n, filtrada.length)} primeiros já têm proventos buscados.`); return; }
    setBuscandoDY(true);
    const porTicker = { ...provCache };
    let ok = 0, semDados = 0;
    for (const tk of alvos) {
      try {
        const divs = await getDividendos(tk);
        if (divs.length) { porTicker[tk] = divs.map((d) => ({ pagamento: d.pagamento, valor: d.valor })); ok++; }
        else { porTicker[tk] = []; semDados++; } // marca como consultado, sem repetir a req
      } catch (e) {
        // Erro de credencial/plano vale pra todos os tickers — aborta na hora
        // em vez de queimar as requisições restantes no mesmo erro.
        if (/token|plano|recusou/i.test(e.message || "")) { toast.error(e.message); setBuscandoDY(false); return; }
        semDados++;
      }
    }
    setProvCache(porTicker);
    try { localStorage.setItem(KEY_PROV, JSON.stringify({ atualizadoEm: new Date().toISOString(), porTicker })); } catch {}
    setBuscandoDY(false);
    toast.success(`Proventos buscados: ${ok} com histórico${semDados ? ` · ${semDados} sem dados` : ""} (${alvos.length} req).`);
  }
  const analisePorTicker = useMemo(() => {
    const m = {};
    (analise?.analises || []).forEach((a) => { m[(a.ticker || "").toUpperCase()] = a; });
    return m;
  }, [analise]);

  async function carregarMercado(force = false) {
    if (!force && cacheValido(cache)) { toast.info("Lista ainda fresca (cache de 24h). Use ⟳ pra forçar."); return; }
    setCarregando(true);
    try {
      const raw = await getListaMercado();
      const norm = normalizarLista(raw);
      if (!norm.length) throw new Error("A brapi devolveu uma lista vazia.");
      setCache(gravarCacheLista(norm));
      toast.success(`${norm.length} papéis carregados (1 requisição).`);
    } catch (e) {
      toast.error(e.message || "Falha ao carregar o mercado.");
    } finally {
      setCarregando(false);
    }
  }

  // Enriquece os N primeiros papéis FILTRADOS com P/L·P/VP·ROE·EV/EBITDA —
  // 20 tickers por requisição (plano pago). 200 papéis = 10 requisições.
  async function buscarIndicadores(n = 200) {
    const alvos = filtrada.slice(0, n).map((x) => x.ticker).filter((tk) => !fundCache[tk]);
    if (!alvos.length) { toast.info(`Os ${Math.min(n, filtrada.length)} primeiros já têm indicadores.`); return; }
    setBuscandoFund(true);
    const porTicker = { ...fundCache };
    let ok = 0, reqs = 0;
    for (const lote of lotes(alvos, 20)) {
      try {
        reqs++;
        const results = await getFundamentosLote(lote);
        const vistos = new Set();
        for (const r of results) {
          const tk = String(r?.symbol || "").toUpperCase();
          if (!tk) continue;
          vistos.add(tk);
          porTicker[tk] = indicadoresDoResultado(r);
          ok++;
        }
        // marca os que a brapi não devolveu pra não repetir a requisição
        lote.forEach((tk) => { if (!vistos.has(tk)) porTicker[tk] = { pl: null, pvp: null, roe: null, evEbitda: null }; });
      } catch (e) {
        if (/token|plano|recusou/i.test(e.message || "")) { toast.error(e.message); setBuscandoFund(false); return; }
      }
    }
    setFundCache(porTicker);
    try { localStorage.setItem(KEY_FUND, JSON.stringify({ atualizadoEm: new Date().toISOString(), porTicker })); } catch {}
    setBuscandoFund(false);
    toast.success(`Indicadores buscados: ${ok} papéis em ${reqs} requisição(ões).`);
  }

  async function perguntarIA(e) {
    e?.preventDefault();
    const q = pergunta.trim();
    if (!q) return;
    if (!lista.length) { toast.info("Carregue o mercado primeiro."); return; }
    setIaRodando(true);
    try {
      const parsed = await gerarJSONGemini(montarPromptFiltros(q, setores), { temperature: 0.1, maxOutputTokens: 1024 });
      if (!parsed || typeof parsed !== "object") throw new Error("A IA não devolveu filtros válidos.");
      setFiltros({ ...FILTROS_VAZIOS, ...parsed });
      setAnalise(null);
      toast.success("Filtros aplicados pela IA.");
    } catch (err) {
      toast.error(err.message || "Falha ao interpretar a pergunta.");
    } finally {
      setIaRodando(false);
    }
  }

  async function analisarShortlist() {
    if (!filtrada.length) { toast.info("Nenhum papel na lista filtrada."); return; }
    setIaRodando(true);
    try {
      const parsed = await gerarJSONGemini(montarPromptShortlist(filtrada, pergunta), { temperature: 0.3, maxOutputTokens: 4096 });
      if (!parsed?.analises) throw new Error("A IA não devolveu a análise. Tente de novo.");
      setAnalise(parsed);
    } catch (err) {
      toast.error(err.message || "Falha na análise.");
    } finally {
      setIaRodando(false);
    }
  }

  function addWatchlist(x) {
    const w = carregarWatchlist();
    const nova = adicionarPapel(w, { symbol: x.ticker, name: x.nome });
    if (nova === w) { toast.info(`${x.ticker} já está na watchlist.`); return; }
    salvarWatchlist(nova);
    toast.success(`${x.ticker} adicionado à watchlist (Construtor de mercado).`);
  }

  function addCandidato(x) {
    let cands = [];
    try { cands = JSON.parse(localStorage.getItem(KEY_CAND) || "[]") || []; } catch {}
    if (cands.some((c) => (c.ticker || "").toUpperCase() === x.ticker)) { toast.info(`${x.ticker} já é candidato no Mapa de Dividendos.`); return; }
    const tipoMapa = x.tipo === "fund" ? "fii" : x.tipo === "bdr" ? "stock" : "acao";
    cands.push({ ticker: x.ticker, tipo: tipoMapa, valorPlanejado: 0 });
    try { localStorage.setItem(KEY_CAND, JSON.stringify(cands)); } catch {}
    toast.success(`${x.ticker} virou candidato no Mapa de Dividendos.`);
  }

  const setNum = (k) => (e) => {
    const v = e.target.value === "" ? null : Number(e.target.value);
    setFiltros((f) => ({ ...f, [k]: Number.isFinite(v) ? v : null }));
  };
  const th = (label, campo, right = true) => (
    <th onClick={() => setFiltros((f) => ({
          ...f, ordenarPor: campo,
          direcao: f.ordenarPor === campo && f.direcao === "desc" ? "asc" : "desc",
        }))}
        style={{ textAlign: right ? "right" : "left", padding: "9px 10px", fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: filtros.ordenarPor === campo ? T.gold : T.muted, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>
      {label}{filtros.ordenarPor === campo && (filtros.direcao === "desc" ? <ArrowDown size={9} className="inline ml-1" /> : <ArrowUp size={9} className="inline ml-1" />)}
    </th>
  );
  const inpStyle = { width: 90, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "7px 9px", color: T.ink, fontSize: 12, fontFamily: "inherit" };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Investimentos · Screener"
        title={<>Screener de <em>Mercado.</em></>}
        sub="A B3 inteira numa tabela: filtre por tipo, setor, preço e liquidez — ou pergunte em português e deixe a IA montar o filtro."
        action={
          <button onClick={() => carregarMercado(true)} disabled={carregando}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: T.gold, border: "none", color: "#fff", borderRadius: 10, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: carregando ? "wait" : "pointer", opacity: carregando ? 0.7 : 1 }}>
            <RefreshCw size={13} className={carregando ? "spin" : ""} />
            {carregando ? "Carregando…" : lista.length ? "Atualizar mercado" : "Carregar mercado (1 req)"}
          </button>
        }
      />

      {/* Pergunta em linguagem natural */}
      <form onSubmit={perguntarIA} style={{ ...CARD, marginTop: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Sparkles size={15} style={{ color: T.gold, flexShrink: 0 }} />
        <input value={pergunta} onChange={(e) => setPergunta(e.target.value)}
               placeholder={'Ex.: "FIIs com volume acima de 1 milhão" · "ações de energia abaixo de R$ 30" · "BDRs de tecnologia"'}
               style={{ flex: "1 1 320px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 12px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
        <button type="submit" disabled={iaRodando}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, borderRadius: 10, padding: "8px 13px", fontSize: 12, fontWeight: 700, cursor: iaRodando ? "wait" : "pointer" }}>
          <Search size={13} /> Filtrar com IA
        </button>
        <button type="button" onClick={analisarShortlist} disabled={iaRodando || !filtrada.length}
                title="A IA dá um parecer curto (nota 0-10) pra cada um dos 15 primeiros papéis filtrados"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.gold, border: "none", color: "#fff", borderRadius: 10, padding: "8px 13px", fontSize: 12, fontWeight: 700, cursor: iaRodando ? "wait" : "pointer", opacity: !filtrada.length ? 0.5 : 1 }}>
          <Sparkles size={13} className={iaRodando ? "spin" : ""} /> Analisar top 15
        </button>
        <button type="button" onClick={() => buscarIndicadores(200)} disabled={buscandoFund || !filtrada.length}
                title="Busca P/L, P/VP, ROE e EV/EBITDA dos 200 primeiros papéis filtrados — 20 tickers por requisição (10 req no total). Fica em cache."
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.gold}`, color: T.gold, borderRadius: 10, padding: "8px 13px", fontSize: 12, fontWeight: 700, cursor: buscandoFund ? "wait" : "pointer", opacity: !filtrada.length ? 0.5 : 1 }}>
          <RefreshCw size={13} className={buscandoFund ? "spin" : ""} /> {buscandoFund ? "Buscando…" : "Buscar indicadores (top 200)"}
        </button>
        <button type="button" onClick={() => buscarDYTopN(20)} disabled={buscandoDY || !filtrada.length}
                title="Busca os proventos anunciados dos 20 primeiros papéis filtrados e calcula o DY 12m real (1 requisição brapi POR papel; fica em cache e alimenta também o Mapa de Dividendos). Atenção: o histórico de dividendos pode não estar incluso no plano free da brapi."
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.green}`, color: T.green, borderRadius: 10, padding: "8px 13px", fontSize: 12, fontWeight: 700, cursor: buscandoDY ? "wait" : "pointer", opacity: !filtrada.length ? 0.5 : 1 }}>
          <RefreshCw size={13} className={buscandoDY ? "spin" : ""} /> {buscandoDY ? "Buscando…" : "Buscar DY (top 20)"}
        </button>
      </form>

      {/* Filtros manuais */}
      <div style={{ ...CARD, marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {TIPOS.map((t) => (
          <button key={t.v} onClick={() => setFiltros((f) => ({ ...f, tipo: t.v }))}
                  style={{ padding: "6px 13px", borderRadius: 100, fontSize: 11.5, fontWeight: 700, cursor: "pointer",
                           border: `1px solid ${filtros.tipo === t.v ? T.gold : T.border}`,
                           background: filtros.tipo === t.v ? `${T.gold}22` : "transparent",
                           color: filtros.tipo === t.v ? T.gold : T.muted }}>
            {t.l}
          </button>
        ))}
        <select value={filtros.setor} onChange={(e) => setFiltros((f) => ({ ...f, setor: e.target.value }))}
                style={{ ...inpStyle, width: "auto", maxWidth: 220 }}>
          <option value="">Setor · todos</option>
          {setores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input placeholder="Ticker/nome" value={filtros.busca} onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))} style={{ ...inpStyle, width: 130 }} />
        <input placeholder="R$ mín" inputMode="decimal" value={filtros.precoMin ?? ""} onChange={setNum("precoMin")} style={inpStyle} />
        <input placeholder="R$ máx" inputMode="decimal" value={filtros.precoMax ?? ""} onChange={setNum("precoMax")} style={inpStyle} />
        <input placeholder="Vol. mín" inputMode="numeric" value={filtros.volumeMin ?? ""} onChange={setNum("volumeMin")} style={inpStyle} />
        <input placeholder="P/L máx" inputMode="decimal" value={filtros.plMax ?? ""} onChange={setNum("plMax")} style={{ ...inpStyle, width: 78 }} title="Só papéis com P/L até este valor (requer indicadores buscados)" />
        <input placeholder="P/VP máx" inputMode="decimal" value={filtros.pvpMax ?? ""} onChange={setNum("pvpMax")} style={{ ...inpStyle, width: 82 }} title="Só papéis com P/VP até este valor" />
        <input placeholder="ROE mín %" inputMode="decimal" value={filtros.roeMin ?? ""} onChange={setNum("roeMin")} style={{ ...inpStyle, width: 86 }} title="Só papéis com ROE a partir deste %" />
        <button onClick={() => { setFiltros(FILTROS_VAZIOS); setAnalise(null); }}
                style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 9, padding: "7px 11px", fontSize: 11.5, cursor: "pointer" }}>
          Limpar
        </button>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: T.faint }}>
          {lista.length ? <>{filtrada.length} de {lista.length} papéis</> : "mercado não carregado"}
          {cache?.fetchedAt && <> · lista de {new Date(cache.fetchedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</>}
        </span>
      </div>

      {/* Resumo da análise IA */}
      {analise?.resumo && (
        <div style={{ ...CARD, marginTop: 10, borderLeft: `3px solid ${T.gold}`, fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
          <b style={{ color: T.gold }}>IA:</b> {analise.resumo}
        </div>
      )}

      {/* Tabela */}
      <div style={{ ...CARD, marginTop: 10, padding: 0, overflowX: "auto" }}>
        {!lista.length ? (
          <div style={{ padding: 40, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 13 }}>
            Clique em <b style={{ color: T.gold }}>Carregar mercado</b> — a lista completa da B3 custa só 1 requisição da sua cota brapi e fica em cache por 24h.
          </div>
        ) : (
          <table style={{ width: "100%", minWidth: 980, borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {th("Papel", "ticker", false)}
                {th("Preço", "preco")}
                {th("Var. dia", "variacaoPct")}
                {th("DY 12m", "dy")}
                {th("P/L", "pl")}
                {th("P/VP", "pvp")}
                {th("ROE", "roe")}
                {th("Volume", "volume")}
                {th("Mkt cap", "marketCap")}
                <th style={{ textAlign: "right", padding: "9px 10px", fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((x) => {
                const ia = analisePorTicker[x.ticker];
                return (
                  <tr key={x.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ padding: "9px 10px" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, color: T.ink }}>{x.ticker}</span>
                        <span style={{ fontSize: 9.5, letterSpacing: ".05em", textTransform: "uppercase", color: T.gold }}>{x.tipo === "fund" ? "FII" : x.tipo}</span>
                        <span style={{ fontSize: 11, color: T.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>{x.nome}{x.setor ? ` · ${x.setor}` : ""}</span>
                        {ia && (
                          <span title={ia.parecer} style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 100, background: `${ia.nota >= 7 ? T.green : ia.nota >= 4 ? T.yellow : T.red}22`, color: ia.nota >= 7 ? T.green : ia.nota >= 4 ? T.yellow : T.red }}>
                            IA {ia.nota}/10
                          </span>
                        )}
                      </div>
                      {ia && <div style={{ fontSize: 11, color: T.muted, marginTop: 2, lineHeight: 1.45 }}>{ia.parecer}</div>}
                    </td>
                    <td className="num" style={{ textAlign: "right", padding: "9px 10px", color: T.ink, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(x.preco)}</td>
                    <td className="num" style={{ textAlign: "right", padding: "9px 10px", whiteSpace: "nowrap", color: x.variacaoPct == null ? T.faint : x.variacaoPct >= 0 ? T.green : T.red }}>
                      {x.variacaoPct == null ? "—" : `${x.variacaoPct >= 0 ? "+" : ""}${fmtN(x.variacaoPct, 2)}%`}
                    </td>
                    <td className="num" title={x.dy != null ? "Proventos reais dos últimos 12 meses ÷ preço atual" : "Sem histórico buscado — use o botão 'Buscar DY'"}
                        style={{ textAlign: "right", padding: "9px 10px", whiteSpace: "nowrap", color: x.dy != null ? T.green : T.faint, fontWeight: x.dy != null ? 700 : 400 }}>
                      {x.dy != null ? `${fmtN(x.dy, 1)}%` : "—"}
                    </td>
                    <td className="num" title={x.evEbitda != null ? `EV/EBITDA ${fmtN(x.evEbitda, 1)}` : "Use 'Buscar indicadores'"}
                        style={{ textAlign: "right", padding: "9px 10px", whiteSpace: "nowrap", color: x.pl != null ? T.ink : T.faint }}>
                      {x.pl != null ? fmtN(x.pl, 1) : "—"}
                    </td>
                    <td className="num" style={{ textAlign: "right", padding: "9px 10px", whiteSpace: "nowrap", color: x.pvp != null ? T.ink : T.faint }}>
                      {x.pvp != null ? fmtN(x.pvp, 2) : "—"}
                    </td>
                    <td className="num" style={{ textAlign: "right", padding: "9px 10px", whiteSpace: "nowrap", color: x.roe != null ? (x.roe >= 10 ? T.green : T.ink) : T.faint }}>
                      {x.roe != null ? `${fmtN(x.roe, 1)}%` : "—"}
                    </td>
                    <td className="num" style={{ textAlign: "right", padding: "9px 10px", color: T.muted, whiteSpace: "nowrap" }}>{fmtVol(x.volume)}</td>
                    <td className="num" style={{ textAlign: "right", padding: "9px 10px", color: T.muted, whiteSpace: "nowrap" }}>{fmtCap(x.marketCap)}</td>
                    <td style={{ textAlign: "right", padding: "9px 10px", whiteSpace: "nowrap" }}>
                      <button onClick={() => addWatchlist(x)} title="Adicionar à watchlist (Construtor de mercado)"
                              style={{ color: T.gold, padding: 5, background: "transparent", border: "none", cursor: "pointer" }}><Bookmark size={14} /></button>
                      <button onClick={() => addCandidato(x)} title="Virar candidato no Mapa de Dividendos"
                              style={{ color: T.green, padding: 5, background: "transparent", border: "none", cursor: "pointer" }}><CalendarPlus size={14} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {filtrada.length > limite && (
          <div style={{ padding: 10, textAlign: "center" }}>
            <button onClick={() => setLimite((l) => l + 50)}
                    style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 9, padding: "7px 16px", fontSize: 12, cursor: "pointer" }}>
              Mostrar mais ({filtrada.length - limite} restantes)
            </button>
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>
        Fonte: brapi /quote/list (1 requisição, cache 24h) · DY 12m vem de "Buscar DY" (1 req/papel, cache compartilhado com o Mapa de Dividendos) · P/L, P/VP, ROE e EV/EBITDA vêm de "Buscar indicadores" (20 papéis/req) — filtre primeiro (ex.: FIIs) e depois busque, os filtros de P/L·P/VP·ROE passam a valer.
      </div>
    </div>
  );
}
