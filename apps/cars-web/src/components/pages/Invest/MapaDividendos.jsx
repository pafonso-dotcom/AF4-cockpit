import React, { useMemo, useState, useEffect } from "react";
import { CalendarDays, Plus, Trash2, Info, RefreshCw, TrendingUp } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import PageHeader from "../../ui/PageHeader.jsx";
import { carregarFundamentos } from "../../../lib/fundamentosLocal.js";
import { getDividendos } from "../../../lib/brapi.js";
import { montarMapaDividendos, metaProventos, rendaFixaMensal, aporteProporcional, mesesAteMeta, MESES_PT } from "../../../lib/mapaDividendos.js";
import { buscarBenchmarks12m } from "../../../lib/bcb.js";

const KEY_OV = "af4:mapa-div:overrides:v1";
const KEY_CAND = "af4:mapa-div:candidatos:v1";
const KEY_REAL = "af4:mapa-div:proventos-brapi:v1";
const KEY_META = "af4:mapa-div:meta-mensal:v1";
const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };
const TIPOS = [{ v: "acao", l: "Ação" }, { v: "fii", l: "FII" }, { v: "stock", l: "Stock (US)" }, { v: "reit", l: "REIT (US)" }];

// Tabelas da calculadora — mesmo visual alinhado dos relatórios (Projeção).
const thCal = (align = "right") => ({ textAlign: align, padding: "8px 12px", fontSize: 9.5, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 700, borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" });
const tdCal = (align = "right") => ({ textAlign: align, padding: "7px 12px", borderBottom: `1px solid ${T.border}`, whiteSpace: "nowrap" });

const LABEL_PROJ = { ativos: "Ações / FIIs", cdb: "CDB", tesouro: "Tesouro IPCA+" };
const fmtCompactBRL = (v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${Math.round(v)}`);
const ler = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const grava = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const oculto = (v, h) => (h ? "•••" : v);

/**
 * Mapa de Dividendos — grade Ativo × Mês com renda estimada, pra montar uma
 * carteira que paga o ano todo. Híbrido: FII mensal, ação trimestral, meses
 * inferidos do histórico de proventos e ajustáveis no clique. Inclui candidatos
 * (planejados) pra preencher as lacunas antes de comprar.
 */
export default function MapaDividendos({ ativos = [], proventosManuais = [], hidden = false }) {
  const [overrides, setOverrides] = useState(() => ler(KEY_OV, {}));
  const [candidatos, setCandidatos] = useState(() => ler(KEY_CAND, []));
  const [form, setForm] = useState({ ticker: "", tipo: "fii", valorPlanejado: "", dy: "" });
  const [verDicas, setVerDicas] = useState(false);
  // Proventos anunciados de verdade (brapi) — { atualizadoEm, porTicker: { TK: [{pagamento, valor}] } }
  const [realCache, setRealCache] = useState(() => ler(KEY_REAL, null));
  const [buscandoReal, setBuscandoReal] = useState(false);

  useEffect(() => grava(KEY_OV, overrides), [overrides]);
  useEffect(() => grava(KEY_CAND, candidatos), [candidatos]);

  const fundamentos = useMemo(() => carregarFundamentos(), []);
  const mapa = useMemo(
    () => montarMapaDividendos({ ativos, candidatos, overrides, proventosManuais, fundamentos, historicoReal: realCache?.porTicker || {} }),
    [ativos, candidatos, overrides, proventosManuais, fundamentos, realCache]
  );

  // ===== Calculadora de meta de renda mensal =====
  const [metaMensal, setMetaMensal] = useState(() => { try { return Number(localStorage.getItem(KEY_META)) || 0; } catch { return 0; } });
  useEffect(() => { try { localStorage.setItem(KEY_META, String(metaMensal || 0)); } catch {} }, [metaMensal]);
  const precosPorTicker = useMemo(() => {
    const m = {};
    (ativos || []).forEach((a) => { const p = Number(a.preco); if (p > 0) m[(a.ticker || "").toUpperCase()] = p; });
    return m;
  }, [ativos]);
  // Juros da renda fixa (tesouro/CDB) entram no total mensal da calculadora.
  const rf = useMemo(() => rendaFixaMensal(ativos), [ativos]);
  const meta = useMemo(
    () => metaProventos({ rows: mapa.rows, metaMensal, precos: precosPorTicker, rendaExtraMensal: rf.total }),
    [mapa.rows, metaMensal, precosPorTicker, rf.total]
  );
  // Aporte mantendo o MIX atual da carteira (dividido entre os seus ativos).
  const [aporteMensalSim, setAporteMensalSim] = useState(0);
  const proporcional = useMemo(
    () => (meta.gapMensal > 0 ? aporteProporcional({ rows: mapa.rows, rfPorAtivo: rf.porAtivo, gapMensal: meta.gapMensal, precos: precosPorTicker }) : null),
    [mapa.rows, rf.porAtivo, meta.gapMensal, precosPorTicker]
  );
  const mesesSim = useMemo(() => {
    if (!proporcional || !(aporteMensalSim > 0)) return null;
    const capitalAtual = proporcional.total > 0 ? (meta.rendaMensalAtual / proporcional.yieldMensal) : 0;
    const capitalAlvo = metaMensal / proporcional.yieldMensal;
    return mesesAteMeta({ yieldMensal: proporcional.yieldMensal, capitalAtual, capitalAlvo, aporteMensal: aporteMensalSim });
  }, [proporcional, aporteMensalSim, meta.rendaMensalAtual, metaMensal]);

  // Renda mensal por ativo HOJE: proventos (grade) + juros (RF), maior primeiro.
  const rendaPorAtivoHoje = useMemo(() => {
    const divs = mapa.rows
      .filter((r) => !r.candidato && r.rendaAnual > 0)
      .map((r) => ({ ticker: r.ticker, tipo: r.tipo, rendaMensal: r.rendaAnual / 12, origem: r.real ? "real" : "estimado" }));
    const juros = rf.porAtivo.map((x) => ({ ticker: x.ticker, tipo: x.tipo, rendaMensal: x.rendaMensal, origem: "juros" }));
    return [...divs, ...juros].sort((a, b) => b.rendaMensal - a.rendaMensal);
  }, [mapa.rows, rf.porAtivo]);

  // CDI e IPCA 12m (Banco Central) — base do comparativo com renda fixa. Lê do
  // cache e atualiza em segundo plano (API pública do BCB, cache de 12h).
  const [cdiAnual, setCdiAnual] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af4:bcb-benchmarks:v1") || "null")?.cdi12m ?? null; } catch { return null; }
  });
  const [ipcaAnual, setIpcaAnual] = useState(() => {
    try { return JSON.parse(localStorage.getItem("af4:bcb-benchmarks:v1") || "null")?.ipca12m ?? null; } catch { return null; }
  });
  useEffect(() => { buscarBenchmarks12m().then((b) => { if (b?.cdi12m != null) setCdiAnual(b.cdi12m); if (b?.ipca12m != null) setIpcaAnual(b.ipca12m); }).catch(() => {}); }, []);
  // Ajustes: % do CDI, IR da renda fixa (regressivo), crescimento esperado dos
  // ativos (%/ano · valorização além dos dividendos) e juros real do Tesouro
  // IPCA+ (nominal = IPCA + juros real). FII/ação são isentos pra PF.
  const [pctCDI, setPctCDI] = useState(() => { try { return Number(localStorage.getItem("af4:mapa-div:cdb-pct")) || 100; } catch { return 100; } });
  const [irCDB, setIrCDB] = useState(() => { try { const v = localStorage.getItem("af4:mapa-div:cdb-ir"); return v == null ? 0.15 : Number(v) || 0; } catch { return 0.15; } });
  const [crescAtivos, setCrescAtivos] = useState(() => { try { const v = localStorage.getItem("af4:mapa-div:cresc"); return v == null ? 0 : Number(v) || 0; } catch { return 0; } });
  const [jurosRealTesouro, setJurosRealTesouro] = useState(() => { try { const v = localStorage.getItem("af4:mapa-div:tesouro-real"); return v == null ? 6 : Number(v) || 0; } catch { return 6; } });
  const [anosProj, setAnosProj] = useState(() => { try { return Number(localStorage.getItem("af4:mapa-div:anos")) || 10; } catch { return 10; } });
  useEffect(() => { try { localStorage.setItem("af4:mapa-div:cdb-pct", String(pctCDI)); localStorage.setItem("af4:mapa-div:cdb-ir", String(irCDB)); localStorage.setItem("af4:mapa-div:cresc", String(crescAtivos)); localStorage.setItem("af4:mapa-div:tesouro-real", String(jurosRealTesouro)); localStorage.setItem("af4:mapa-div:anos", String(anosProj)); } catch {} }, [pctCDI, irCDB, crescAtivos, jurosRealTesouro, anosProj]);
  const IR_FAIXAS = [
    { v: 0, l: "Bruto" },
    { v: 0.225, l: "22,5% · até 180d" },
    { v: 0.20, l: "20% · 181–360d" },
    { v: 0.175, l: "17,5% · 361–720d" },
    { v: 0.15, l: "15% · +720d" },
  ];

  // Comparativo: capital pra bater a meta de renda × e, sobre esse capital, qual
  // caminho MAIS cresce o patrimônio em 1 ano — ações/FIIs (dividendos +
  // valorização) × CDB (% do CDI) × Tesouro IPCA+ (IPCA + juros real), líq. de IR.
  const comparativo = useMemo(() => {
    if (!(metaMensal > 0)) return null;
    const divRows = mapa.rows.filter((r) => !r.candidato && Number(r.valor) > 0 && Number(r.rendaAnual) > 0);
    const capitalDiv = divRows.reduce((s, r) => s + r.valor, 0);
    const rendaAnualDiv = divRows.reduce((s, r) => s + r.rendaAnual, 0);
    const dyAnual = capitalDiv > 0 ? (rendaAnualDiv / capitalDiv) * 100 : null;
    const metaAnual = metaMensal * 12;
    const capMetaDiv = dyAnual > 0 ? metaAnual / (dyAnual / 100) : null;
    // Taxas efetivas líquidas (%/ano).
    const cdbAnual = cdiAnual > 0 ? cdiAnual * (pctCDI / 100) * (1 - irCDB) : null;
    const tesouroAnual = ipcaAnual != null ? (ipcaAnual + jurosRealTesouro) * (1 - irCDB) : null;
    const capMetaCDB = cdbAnual > 0 ? metaAnual / (cdbAnual / 100) : null;
    const capMetaTesouro = tesouroAnual > 0 ? metaAnual / (tesouroAnual / 100) : null;
    const rendaMensalCDBnoCapDiv = capMetaDiv != null && cdbAnual > 0 ? (capMetaDiv * (cdbAnual / 100)) / 12 : null;
    // Retorno total dos ativos = dividendos + valorização (crescimento).
    const retornoAtivos = dyAnual != null ? dyAnual + crescAtivos : null;
    // Crescimento de patrimônio em 1 ano sobre o capital-base (o da meta via div).
    const base = capMetaDiv;
    const ganho = base != null ? {
      ativosDiv: base * (dyAnual / 100),
      ativosVal: base * (crescAtivos / 100),
      ativosTotal: base * ((dyAnual + crescAtivos) / 100),
      cdb: cdbAnual != null ? base * (cdbAnual / 100) : null,
      tesouro: tesouroAnual != null ? base * (tesouroAnual / 100) : null,
    } : null;
    // Vencedor (maior crescimento de patrimônio no ano).
    let melhor = null;
    if (ganho) {
      const cand = [
        { id: "ativos", label: "Ações / FIIs", valor: ganho.ativosTotal },
        ...(ganho.cdb != null ? [{ id: "cdb", label: "CDB", valor: ganho.cdb }] : []),
        ...(ganho.tesouro != null ? [{ id: "tesouro", label: "Tesouro IPCA+", valor: ganho.tesouro }] : []),
      ];
      melhor = cand.reduce((a, b) => (b.valor > a.valor ? b : a), cand[0]);
    }
    return { capitalDiv, dyAnual, capMetaDiv, capMetaCDB, capMetaTesouro, cdbAnual, tesouroAnual, retornoAtivos, rendaMensalCDBnoCapDiv, metaAnual, base, ganho, melhor };
  }, [metaMensal, mapa.rows, cdiAnual, ipcaAnual, pctCDI, irCDB, crescAtivos, jurosRealTesouro]);

  // Projeção de patrimônio em N anos (juros compostos, reinvestindo tudo) —
  // parte do capital-base da meta e aplica a taxa efetiva de cada caminho.
  const projecao = useMemo(() => {
    const C = comparativo?.base;
    if (!(C > 0)) return null;
    const anos = Math.max(1, Math.min(50, Math.round(anosProj) || 10));
    const rA = (comparativo.retornoAtivos || 0) / 100;
    const rC = comparativo.cdbAnual != null ? comparativo.cdbAnual / 100 : null;
    const rT = comparativo.tesouroAnual != null ? comparativo.tesouroAnual / 100 : null;
    const pts = [];
    for (let y = 0; y <= anos; y++) {
      pts.push({
        ano: y,
        ativos: C * Math.pow(1 + rA, y),
        ...(rC != null ? { cdb: C * Math.pow(1 + rC, y) } : {}),
        ...(rT != null ? { tesouro: C * Math.pow(1 + rT, y) } : {}),
      });
    }
    const fim = pts[pts.length - 1];
    const cand = [
      { id: "ativos", label: "Ações / FIIs", cor: T.green, valor: fim.ativos },
      ...(fim.cdb != null ? [{ id: "cdb", label: "CDB", cor: T.blue || "#5b9bd5", valor: fim.cdb }] : []),
      ...(fim.tesouro != null ? [{ id: "tesouro", label: "Tesouro IPCA+", cor: T.gold, valor: fim.tesouro }] : []),
    ];
    const melhor = cand.reduce((a, b) => (b.valor > a.valor ? b : a), cand[0]);
    return { pts, anos, capital: C, cand, melhor };
  }, [comparativo, anosProj]);

  // Busca o histórico real de proventos na brapi pra cada ativo pagador da
  // carteira (1 requisição por ticker — por isso é manual, não automático).
  async function atualizarProventosReais() {
    const tickers = [...new Set(
      ativos.filter((a) => ["acao", "fii", "stock", "reit"].includes(a?.tipo)).map((a) => (a.ticker || "").toUpperCase()).filter(Boolean)
    )];
    if (!tickers.length) { toast.info("Nenhum ativo pagador de dividendos na carteira."); return; }
    setBuscandoReal(true);
    const porTicker = { ...(realCache?.porTicker || {}) };
    let ok = 0, falhas = 0;
    for (const tk of tickers) {
      try {
        const divs = await getDividendos(tk);
        if (divs.length) { porTicker[tk] = divs.map((d) => ({ pagamento: d.pagamento, valor: d.valor })); ok++; }
      } catch (e) {
        falhas++;
        // Erro de credencial/plano vale pra todos — aborta em vez de repetir.
        if (falhas === 1 && /token|plano|recusou/i.test(e.message || "")) {
          toast.error(e.message);
          setBuscandoReal(false);
          return;
        }
      }
    }
    const novo = { atualizadoEm: new Date().toISOString(), porTicker };
    setRealCache(novo);
    grava(KEY_REAL, novo);
    setBuscandoReal(false);
    toast.success(`Proventos reais atualizados: ${ok} ${ok === 1 ? "ativo" : "ativos"}${falhas ? ` · ${falhas} sem dados` : ""}.`);
  }

  function addCandidato(e) {
    e?.preventDefault();
    const tk = form.ticker.trim().toUpperCase();
    if (!tk) return;
    if (candidatos.some((c) => c.ticker.toUpperCase() === tk)) { setForm({ ...form, ticker: "" }); return; }
    setCandidatos((prev) => [...prev, {
      ticker: tk, tipo: form.tipo,
      valorPlanejado: Number(form.valorPlanejado) || 0,
      dy: form.dy ? Number(form.dy) : undefined,
    }]);
    setForm({ ticker: "", tipo: form.tipo, valorPlanejado: "", dy: "" });
  }
  const removerCandidato = (tk) => {
    setCandidatos((prev) => prev.filter((c) => c.ticker.toUpperCase() !== tk.toUpperCase()));
    setOverrides((prev) => { const n = { ...prev }; delete n[tk]; return n; });
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Investimentos · Mapa de Dividendos"
        title={<>Mapa de <em>Dividendos.</em></>}
        sub="Combine ativos com calendários complementares e monte uma renda que paga o ano todo."
        action={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={atualizarProventosReais} disabled={buscandoReal}
                    title="Busca na brapi os proventos anunciados de verdade (data e valor por cota) de cada ativo da carteira"
                    style={{ display: "flex", alignItems: "center", gap: 6, background: T.gold, border: "none", color: "#fff", borderRadius: 10, padding: "6px 12px", fontSize: 12.5, fontWeight: 700, cursor: buscandoReal ? "wait" : "pointer", opacity: buscandoReal ? 0.7 : 1 }}>
              <RefreshCw size={13} className={buscandoReal ? "spin" : ""} /> {buscandoReal ? "Buscando…" : "Atualizar proventos reais"}
            </button>
            <button onClick={() => setVerDicas((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}>
              <Info size={13} /> Como usar
            </button>
          </div>
        }
      />

      {verDicas && (
        <div style={{ ...CARD, marginTop: 8, fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
          <b style={{ color: T.ink }}>A lógica do mapa:</b> ao combinar empresas/FIIs que pagam em meses diferentes, você cria uma renda recorrente o ano todo. Pra usar bem:
          <div style={{ marginTop: 8 }}>1. <b style={{ color: T.ink }}>Consistência vs. data:</b> não escolha só pelo mês — veja histórico de lucros e política de dividendos sustentável.</div>
          <div>2. <b style={{ color: T.ink }}>Indicadores:</b> confira o <b>DY</b> (dividendos ÷ preço) e o <b>Payout</b> (% do lucro distribuído).</div>
          <div>3. <b style={{ color: T.ink }}>Data "Com" e "Ex":</b> pra receber, você precisa ter a ação até a Data Com. Comprou na Data Ex, não recebe aquele ciclo.</div>
        </div>
      )}

      {/* Resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
        <div style={CARD}>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Renda mensal média</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.green, marginTop: 4 }}>{oculto(fmt(mapa.rendaMensalMedia), hidden)}</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Renda anual estimada</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{oculto(fmt(mapa.rendaAnualTotal), hidden)}</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Meses sem renda</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: mapa.lacunas.length ? T.yellow : T.green, marginTop: 4 }}>
            {mapa.lacunas.length} {mapa.lacunas.length === 1 ? "mês" : "meses"}
          </div>
          {mapa.lacunas.length > 0 && (
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{mapa.lacunas.map((m) => MESES_PT[m]).join(", ")}</div>
          )}
        </div>
      </div>

      {/* ===== Calculadora de meta de proventos ===== */}
      <div style={{ ...CARD, marginTop: 12, borderLeft: `3px solid ${T.gold}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
              🎯 Meta de renda mensal
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 13, color: T.muted }}>R$</span>
              <input value={metaMensal || ""} onChange={(e) => setMetaMensal(Number(e.target.value) || 0)}
                     placeholder="Ex.: 2000" inputMode="numeric"
                     style={{ width: 130, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 15, fontWeight: 700, fontFamily: "inherit" }} />
              <span style={{ fontSize: 12, color: T.faint }}>/mês</span>
            </div>
          </div>
          {metaMensal > 0 && (
            <div style={{ flex: "2 1 300px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                <span style={{ color: T.muted }}>
                  Sua carteira gera <b style={{ color: T.green }}>{oculto(fmt(meta.rendaMensalAtual), hidden)}</b>/mês
                  {rf.total > 0 && (
                    <span style={{ color: T.faint, fontSize: 11 }}>
                      {" "}(proventos {oculto(fmt(meta.rendaMensalAtual - rf.total), hidden)} + juros RF {oculto(fmt(rf.total), hidden)})
                    </span>
                  )}
                </span>
                <span style={{ color: meta.atingida ? T.green : T.ink, fontWeight: 700 }}>
                  {meta.atingida ? "Meta atingida! 🎉" : `falta ${oculto(fmt(meta.gapMensal), hidden)}`}
                </span>
              </div>
              <div style={{ height: 10, borderRadius: 100, background: T.bgSoft, border: `1px solid ${T.border}`, overflow: "hidden" }}>
                <div style={{ width: `${meta.pctAtingido}%`, height: "100%", background: meta.atingida ? T.green : T.gold, transition: "width .3s ease" }} />
              </div>
              <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4 }}>{meta.pctAtingido.toFixed(0)}% da meta</div>
            </div>
          )}
        </div>

        {/* Renda mensal por ativo HOJE — proventos + juros, maior primeiro */}
        {rendaPorAtivoHoje.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
              O que cada ativo gera por mês <b>hoje</b>:
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 420, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thCal("left")}>Ativo</th>
                    <th style={thCal("left")}>Origem</th>
                    <th style={thCal()}>Renda / mês</th>
                  </tr>
                </thead>
                <tbody>
                  {rendaPorAtivoHoje.map((x) => (
                    <tr key={`${x.ticker}-${x.origem}`}
                        title={x.origem === "juros" ? "Juros estimados (renda fixa)" : x.origem === "real" ? "Proventos reais (últimos 12 meses)" : "Proventos estimados por DY"}>
                      <td style={{ ...tdCal("left"), fontWeight: 700, color: T.ink }}>{x.ticker}</td>
                      <td style={tdCal("left")}>
                        <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", padding: "1px 6px", borderRadius: 4,
                                       background: x.origem === "juros" ? `${T.blue || "#5b9bd5"}22` : x.origem === "real" ? `${T.green}22` : `${T.border}`,
                                       color: x.origem === "juros" ? (T.blue || "#5b9bd5") : x.origem === "real" ? T.green : T.muted }}>
                          {x.origem}
                        </span>
                      </td>
                      <td className="num" style={{ ...tdCal(), color: T.green, fontWeight: 700 }}>{oculto(fmt(x.rendaMensal), hidden)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...tdCal("left"), fontWeight: 700, color: T.ink, borderBottom: "none" }}>Total</td>
                    <td style={{ ...tdCal("left"), borderBottom: "none" }} />
                    <td className="num" style={{ ...tdCal(), fontWeight: 800, color: T.green, borderBottom: "none" }}>{oculto(fmt(meta.rendaMensalAtual), hidden)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {metaMensal > 0 && !meta.atingida && meta.sugestoes.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
              Quanto aportar pra fechar a meta <b>usando só aquele ativo</b> (DY maior = menos aporte — combine ativos pra diversificar):
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 520, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thCal("left")}>Ativo</th>
                    <th style={thCal()}>DY 12m</th>
                    <th style={thCal()}>Aporte necessário</th>
                    <th style={thCal()}>≈ Cotas</th>
                    <th style={thCal()}>Preço</th>
                  </tr>
                </thead>
                <tbody>
                  {meta.sugestoes.slice(0, 8).map((s, i, arr) => (
                    <tr key={s.ticker}>
                      <td style={{ ...tdCal("left"), borderBottom: i === arr.length - 1 ? "none" : tdCal().borderBottom }}>
                        <span style={{ fontWeight: 700, color: T.ink }}>{s.ticker}</span>
                        {s.candidato && <span style={{ marginLeft: 6, fontSize: 8.5, padding: "1px 5px", borderRadius: 4, background: `${T.gold}22`, color: T.gold, fontWeight: 700, textTransform: "uppercase" }}>plano</span>}
                        {s.real && <span style={{ marginLeft: 6, fontSize: 8.5, padding: "1px 5px", borderRadius: 4, background: `${T.green}22`, color: T.green, fontWeight: 700, textTransform: "uppercase" }}>real</span>}
                      </td>
                      <td className="num" style={{ ...tdCal(), color: T.green, fontWeight: 700, borderBottom: i === arr.length - 1 ? "none" : tdCal().borderBottom }}>{s.dy.toFixed(1)}%</td>
                      <td className="num" style={{ ...tdCal(), color: T.gold, fontWeight: 700, borderBottom: i === arr.length - 1 ? "none" : tdCal().borderBottom }}>{oculto(fmt(s.aporteNecessario), hidden)}</td>
                      <td className="num" style={{ ...tdCal(), color: T.ink, borderBottom: i === arr.length - 1 ? "none" : tdCal().borderBottom }}>{s.cotas ? s.cotas.toLocaleString("pt-BR") : "—"}</td>
                      <td className="num" style={{ ...tdCal(), color: T.muted, borderBottom: i === arr.length - 1 ? "none" : tdCal().borderBottom }}>{s.preco ? fmt(s.preco) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {metaMensal > 0 && !meta.atingida && meta.sugestoes.length === 0 && (
          <div style={{ marginTop: 12, fontSize: 12, color: T.faint, fontStyle: "italic" }}>
            Sem ativos com DY conhecido pra sugerir — use "Atualizar proventos reais" ou adicione candidatos com DY abaixo.
          </div>
        )}

        {/* Aporte MANTENDO O MIX da carteira — dividido entre os seus ativos */}
        {metaMensal > 0 && !meta.atingida && proporcional && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.border}` }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
              Ou <b>mantendo o mix atual da carteira</b> (yield ponderado {(proporcional.yieldMensal * 100).toFixed(2)}%/mês): aporte total de{" "}
              <b className="num" style={{ color: T.gold, fontSize: 13 }}>{oculto(fmt(proporcional.total), hidden)}</b>, dividido assim:
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={thCal("left")}>Ativo</th>
                    <th style={thCal()}>Peso</th>
                    <th style={thCal()}>Aporte</th>
                    <th style={thCal()}>≈ Cotas</th>
                  </tr>
                </thead>
                <tbody>
                  {proporcional.itens.map((x) => (
                    <tr key={x.ticker}>
                      <td style={{ ...tdCal("left"), fontWeight: 700, color: T.ink }}>{x.ticker}</td>
                      <td className="num" style={{ ...tdCal(), color: T.muted }}>{(x.peso * 100).toFixed(0)}%</td>
                      <td className="num" style={{ ...tdCal(), color: T.gold, fontWeight: 700 }}>{oculto(fmt(x.aporte), hidden)}</td>
                      <td className="num" style={{ ...tdCal(), color: T.ink }}>{x.cotas ? x.cotas.toLocaleString("pt-BR") : "—"}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...tdCal("left"), fontWeight: 700, color: T.ink, borderBottom: "none" }}>Total</td>
                    <td style={{ ...tdCal(), borderBottom: "none" }} />
                    <td className="num" style={{ ...tdCal(), fontWeight: 800, color: T.gold, borderBottom: "none" }}>{oculto(fmt(proporcional.total), hidden)}</td>
                    <td style={{ ...tdCal(), borderBottom: "none" }} />
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11.5, color: T.muted }}>Aportando</span>
              <span style={{ fontSize: 12, color: T.muted }}>R$</span>
              <input value={aporteMensalSim || ""} onChange={(e) => setAporteMensalSim(Number(e.target.value) || 0)}
                     placeholder="1.000" inputMode="numeric"
                     style={{ width: 100, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "6px 9px", color: T.ink, fontSize: 13, fontWeight: 700, fontFamily: "inherit" }} />
              <span style={{ fontSize: 11.5, color: T.muted }}>/mês nesse mix (reinvestindo os proventos), você alcança a meta em</span>
              <b style={{ fontSize: 13, color: aporteMensalSim > 0 && mesesSim != null ? T.green : T.faint }}>
                {aporteMensalSim > 0 && mesesSim != null
                  ? mesesSim <= 24 ? `≈ ${mesesSim} ${mesesSim === 1 ? "mês" : "meses"}` : `≈ ${(mesesSim / 12).toFixed(1)} anos`
                  : "—"}
              </b>
            </div>
          </div>
        )}
      </div>

      {/* ===== Comparativo: qual caminho cresce mais o patrimônio ===== */}
      {comparativo && (
        <div style={{ ...CARD, marginTop: 12, borderLeft: `3px solid ${T.gold}` }}>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
            🆚 Qual caminho cresce mais o patrimônio
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
            Dividendos (ações/FIIs, com valorização) × renda fixa (CDB · Tesouro IPCA+) — pra meta de <b style={{ color: T.ink }}>{oculto(fmt(metaMensal), hidden)}/mês</b>.
          </div>

          {/* Controles */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, marginTop: 10, fontSize: 11 }}>
            <span style={{ color: T.muted, fontWeight: 700 }}>CDB</span>
            <input value={pctCDI || ""} onChange={(e) => setPctCDI(Number(e.target.value) || 0)} inputMode="numeric"
                   style={{ width: 50, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 7px", color: T.ink, fontSize: 12, fontWeight: 700, fontFamily: "inherit", textAlign: "right" }} />
            <span style={{ color: T.muted }}>% CDI</span>
            {[90, 100, 110].map((p) => (
              <button key={p} onClick={() => setPctCDI(p)}
                      style={{ padding: "3px 8px", borderRadius: 100, fontSize: 10.5, fontWeight: 700, cursor: "pointer",
                               border: `1px solid ${pctCDI === p ? (T.blue || "#5b9bd5") : T.border}`,
                               background: pctCDI === p ? `${T.blue || "#5b9bd5"}22` : "transparent",
                               color: pctCDI === p ? (T.blue || "#5b9bd5") : T.muted }}>{p}%</button>
            ))}
            <span style={{ color: T.muted, fontWeight: 700, marginLeft: 4 }}>IR RF</span>
            <select value={irCDB} onChange={(e) => setIrCDB(Number(e.target.value))}
                    style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 7px", color: T.ink, fontSize: 11.5, fontFamily: "inherit" }}>
              {IR_FAIXAS.map((f) => <option key={f.v} value={f.v}>{f.l}</option>)}
            </select>
            <span style={{ color: T.muted, fontWeight: 700, marginLeft: 4 }}>Cresc. ativos</span>
            <input value={crescAtivos || ""} onChange={(e) => setCrescAtivos(Number(e.target.value) || 0)} inputMode="decimal" placeholder="0"
                   style={{ width: 46, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 7px", color: T.ink, fontSize: 12, fontWeight: 700, fontFamily: "inherit", textAlign: "right" }} />
            <span style={{ color: T.muted }}>%/ano</span>
            <span style={{ color: T.muted, fontWeight: 700, marginLeft: 4 }}>Tesouro IPCA+</span>
            <input value={jurosRealTesouro || ""} onChange={(e) => setJurosRealTesouro(Number(e.target.value) || 0)} inputMode="decimal"
                   style={{ width: 46, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 7px", color: T.ink, fontSize: 12, fontWeight: 700, fontFamily: "inherit", textAlign: "right" }} />
            <span style={{ color: T.muted }}>% real</span>
          </div>

          {/* A) Capital pra a renda mensal (só o que paga em dinheiro) */}
          <div style={{ fontSize: 10, color: T.faint, marginTop: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>Capital pra a renda mensal</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginTop: 6 }}>
            {[
              { l: "Ações / FIIs · dividendos", cor: T.green, r: comparativo.dyAnual, cap: comparativo.capMetaDiv, sub: "DY médio (renda)" },
              { l: `CDB · ${pctCDI}% CDI${irCDB > 0 ? " líq." : ""}`, cor: T.blue || "#5b9bd5", r: comparativo.cdbAnual, cap: comparativo.capMetaCDB, sub: cdiAnual != null ? `CDI ${cdiAnual.toFixed(1)}%` : "CDI · BCB" },
              { l: "Tesouro IPCA+", cor: T.gold, r: comparativo.tesouroAnual, cap: comparativo.capMetaTesouro, sub: ipcaAnual != null ? `IPCA ${ipcaAnual.toFixed(1)}% + ${jurosRealTesouro}%` : "IPCA · BCB" },
            ].map((t) => (
              <div key={t.l} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 14, padding: 12 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: t.cor }}>{t.l}</div>
                <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>{t.r != null ? <b style={{ color: t.cor }}>{t.r.toFixed(2)}%/ano</b> : "—"} <span style={{ color: T.faint }}>· {t.sub}</span></div>
                <div className="num" style={{ fontSize: 19, fontWeight: 800, color: t.cor, marginTop: 6 }}>{t.cap != null ? oculto(fmt(t.cap), hidden) : "—"}</div>
                <div style={{ fontSize: 10, color: T.faint }}>capital necessário</div>
              </div>
            ))}
          </div>

          {/* B) Patrimônio em 1 ano — o que responde "qual cresce mais" */}
          {comparativo.base != null && comparativo.ganho && (
            <>
              <div style={{ fontSize: 10, color: T.faint, marginTop: 14, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Em 1 ano, investindo {oculto(fmt(comparativo.base), hidden)} — quanto o patrimônio cresce
              </div>
              <div style={{ overflowX: "auto", marginTop: 6 }}>
                <table style={{ width: "100%", minWidth: 480, borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={thCal("left")}>Caminho</th>
                      <th style={thCal()}>Rentab.</th>
                      <th style={thCal()}>Ganho no ano</th>
                      <th style={thCal()}>Patrimônio (fim)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { id: "ativos", l: "Ações / FIIs", cor: T.green, r: comparativo.retornoAtivos, g: comparativo.ganho.ativosTotal, sub: `${comparativo.dyAnual.toFixed(1)}% div + ${crescAtivos}% cresc.` },
                      ...(comparativo.ganho.cdb != null ? [{ id: "cdb", l: "CDB", cor: T.blue || "#5b9bd5", r: comparativo.cdbAnual, g: comparativo.ganho.cdb, sub: `${pctCDI}% CDI${irCDB > 0 ? " líq." : ""}` }] : []),
                      ...(comparativo.ganho.tesouro != null ? [{ id: "tesouro", l: "Tesouro IPCA+", cor: T.gold, r: comparativo.tesouroAnual, g: comparativo.ganho.tesouro, sub: `IPCA+${jurosRealTesouro}%${irCDB > 0 ? " líq." : ""}` }] : []),
                    ].map((x) => {
                      const win = comparativo.melhor?.id === x.id;
                      return (
                        <tr key={x.id} style={{ background: win ? `${x.cor}12` : "transparent" }}>
                          <td style={{ ...tdCal("left") }}>
                            <span style={{ fontWeight: 700, color: x.cor }}>{x.l}</span>
                            {win && <span style={{ marginLeft: 6, fontSize: 8.5, padding: "1px 6px", borderRadius: 4, background: `${x.cor}22`, color: x.cor, fontWeight: 800, textTransform: "uppercase" }}>+ patrimônio</span>}
                            <div style={{ fontSize: 9.5, color: T.faint }}>{x.sub}</div>
                          </td>
                          <td className="num" style={{ ...tdCal(), color: x.cor, fontWeight: 700 }}>{x.r != null ? `${x.r.toFixed(2)}%` : "—"}</td>
                          <td className="num" style={{ ...tdCal(), color: x.cor, fontWeight: 700 }}>+{oculto(fmt(x.g), hidden)}</td>
                          <td className="num" style={{ ...tdCal(), color: T.ink, fontWeight: 700 }}>{oculto(fmt(comparativo.base + x.g), hidden)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {comparativo.melhor && (
                <div style={{ marginTop: 10, fontSize: 12, color: T.muted, lineHeight: 1.6 }}>
                  Pra <b style={{ color: T.ink }}>aumentar o patrimônio</b> no ano, o caminho que mais cresce é{" "}
                  <b style={{ color: comparativo.melhor.id === "ativos" ? T.green : comparativo.melhor.id === "cdb" ? (T.blue || "#5b9bd5") : T.gold }}>{comparativo.melhor.label}</b>{" "}
                  (<b>+{oculto(fmt(comparativo.melhor.valor), hidden)}</b>).{" "}
                  {crescAtivos === 0 && <span style={{ color: T.faint }}>Ative um <b>crescimento dos ativos</b> acima pra contar a valorização (não só os dividendos).</span>}
                </div>
              )}
            </>
          )}

          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>
            Ações/FIIs = dividendos (isentos pra PF) + valorização estimada. CDB a <b>{pctCDI}% do CDI</b> e Tesouro IPCA+ ({ipcaAnual != null ? `IPCA ${ipcaAnual.toFixed(1)}% + ` : "IPCA + "}<b>{jurosRealTesouro}%</b> real){irCDB > 0 ? <>, líquidos de <b>{(irCDB * 100).toFixed(1).replace(".", ",")}% de IR</b></> : ", brutos"}. CDI/IPCA de 12m (Banco Central). Estimativa — a valorização real varia.
          </div>
        </div>
      )}

      {/* ===== Gráfico: patrimônio projetado em N anos ===== */}
      {projecao && (
        <div style={{ ...CARD, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <TrendingUp size={14} style={{ color: T.gold }} /> Patrimônio projetado
              </div>
              <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                Partindo de <b style={{ color: T.ink }}>{oculto(fmt(projecao.capital), hidden)}</b>, reinvestindo tudo (juros compostos).
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {[5, 10, 20, 30].map((n) => (
                <button key={n} onClick={() => setAnosProj(n)}
                        style={{ padding: "4px 9px", borderRadius: 100, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                 border: `1px solid ${anosProj === n ? T.gold : T.border}`,
                                 background: anosProj === n ? `${T.gold}22` : "transparent",
                                 color: anosProj === n ? T.gold : T.muted }}>{n}a</button>
              ))}
              <input value={anosProj || ""} onChange={(e) => setAnosProj(Number(e.target.value) || 0)} inputMode="numeric"
                     style={{ width: 46, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 7px", color: T.ink, fontSize: 12, fontWeight: 700, fontFamily: "inherit", textAlign: "right" }} />
              <span style={{ fontSize: 11, color: T.muted }}>anos</span>
            </div>
          </div>

          <div style={{ width: "100%", height: 240, marginTop: 12 }}>
            <ResponsiveContainer>
              <LineChart data={projecao.pts} margin={{ top: 6, right: 14, bottom: 0, left: 4 }}>
                <CartesianGrid stroke={T.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="ano" tick={{ fontSize: 10, fill: T.muted }} tickFormatter={(y) => `${y}a`} />
                <YAxis tick={{ fontSize: 10, fill: T.muted }} width={46} tickFormatter={fmtCompactBRL} />
                <Tooltip
                  formatter={(v, name) => [hidden ? "•••" : fmt(v), LABEL_PROJ[name] || name]}
                  labelFormatter={(y) => `Ano ${y}`}
                  contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="ativos" name="ativos" stroke={T.green} strokeWidth={2.2} dot={false} />
                <Line type="monotone" dataKey="cdb" name="cdb" stroke={T.blue || "#5b9bd5"} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="tesouro" name="tesouro" stroke={T.gold} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Finais + vencedor */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 8 }}>
            {projecao.cand.map((c) => (
              <div key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <span style={{ width: 12, height: 3, borderRadius: 2, background: c.cor }} />
                <span style={{ color: T.muted }}>{c.label}</span>
                <b className="num" style={{ color: c.cor }}>{oculto(fmt(c.valor), hidden)}</b>
                {projecao.melhor.id === c.id && <span style={{ fontSize: 8.5, padding: "1px 6px", borderRadius: 4, background: `${c.cor}22`, color: c.cor, fontWeight: 800, textTransform: "uppercase" }}>melhor</span>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.6 }}>
            Em <b style={{ color: T.ink }}>{projecao.anos} anos</b>, o caminho que mais cresce é{" "}
            <b style={{ color: projecao.melhor.cor }}>{projecao.melhor.label}</b> — chegando a <b style={{ color: projecao.melhor.cor }}>{oculto(fmt(projecao.melhor.valor), hidden)}</b>.
            <span style={{ color: T.faint }}> Estimativa a taxa constante; retorno real varia ano a ano.</span>
          </div>
        </div>
      )}

      {/* Rodapé informativo (a grade Ativo × Mês foi removida a pedido —
          a calculadora acima cobre a leitura da renda) */}
      <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>
        Linhas com selo <b style={{ color: T.green }}>real</b> usam os proventos anunciados (brapi, últimos 12 meses); as demais estimam pelo DY.
        {realCache?.atualizadoEm && (
          <> · Proventos reais atualizados em {new Date(realCache.atualizadoEm).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.</>
        )}
      </div>

      {/* Candidatos / planejamento */}
      <div style={{ ...CARD, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <CalendarDays size={15} style={{ color: T.gold }} />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Planejar candidatos</h3>
          <span style={{ fontSize: 11, color: T.faint }}>papéis que você ainda não tem, pra preencher as lacunas</span>
        </div>
        <form onSubmit={addCandidato} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="Ticker (ex.: MXRF11)"
                 style={{ flex: "1 1 130px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, textTransform: "uppercase", fontFamily: "inherit" }} />
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, fontFamily: "inherit" }}>
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <input value={form.valorPlanejado} onChange={(e) => setForm({ ...form, valorPlanejado: e.target.value })} placeholder="R$ planejado" inputMode="numeric"
                 style={{ width: 120, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
          <input value={form.dy} onChange={(e) => setForm({ ...form, dy: e.target.value })} placeholder="DY% (opc.)" inputMode="decimal"
                 style={{ width: 90, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
          <button type="submit" style={{ display: "flex", alignItems: "center", gap: 6, background: T.gold, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={14} /> Adicionar
          </button>
        </form>
        {candidatos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {candidatos.map((c) => (
              <span key={c.ticker} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: "5px 6px 5px 12px", fontSize: 12, color: T.ink }}>
                <b>{c.ticker}</b>
                <span style={{ color: T.faint }}>{oculto(fmt(Number(c.valorPlanejado) || 0), hidden)}</span>
                <button onClick={() => removerCandidato(c.ticker)} title="Remover" style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", display: "flex" }}>
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
