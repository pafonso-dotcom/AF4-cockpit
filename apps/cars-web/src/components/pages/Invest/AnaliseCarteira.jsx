import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus, LineChart } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN } from "../../../lib/format.js";
import { getKlines, getTicker24h } from "../../../lib/binance.js";
import { getHistorico, getQuotes } from "../../../lib/brapi.js";
import { calcRSI, calcMACD, calcTrend, calcVolumeChange, calcEMA } from "../../../lib/indicadores.js";
import { calcularScore, direcaoSinal, confiancaSinal } from "../../../lib/score.js";
import { toast } from "../../../lib/toast.js";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "../../../lib/invest-constants.js";
import PageHeader from "../../ui/PageHeader.jsx";

const INTERVALOS_BINANCE = [
  { v: "15m", l: "15m" }, { v: "1h", l: "1h" }, { v: "4h", l: "4h" },
  { v: "1d",  l: "1d"  }, { v: "1w", l: "1w" },
];
const BRAPI_TF = { "1d": { range: "3mo", interval: "1d" }, "1w": { range: "3mo", interval: "1wk" } };

const TIPOS_ANALISAVEIS = ["acao", "fii", "stock", "reit", "etf", "cripto"];

async function analisarAtivo(asset, intervaloUI) {
  // Roteia a fonte de dados pelo tipo do ativo
  const isCripto = asset.tipo === "cripto";
  const symbol = isCripto ? `${String(asset.ticker || "").toUpperCase()}USDT` : String(asset.ticker || "").toUpperCase();
  if (!symbol) throw new Error("Ativo sem ticker.");

  let candles, ticker;
  if (isCripto) {
    [candles, ticker] = await Promise.all([
      getKlines(symbol, intervaloUI, 100),
      getTicker24h(symbol).catch(() => null),
    ]);
  } else {
    const tf = BRAPI_TF[INTERVALOS_BINANCE.find(i => i.v === intervaloUI)?.v] || BRAPI_TF["1d"];
    const [hist, quotes] = await Promise.all([
      getHistorico(symbol, tf.range, tf.interval),
      getQuotes([symbol]).catch(() => []),
    ]);
    candles = hist;
    const q = quotes?.[0];
    ticker = q ? { lastPrice: q.price, priceChangePercent: q.changePercent, highPrice: q.dayHigh, lowPrice: q.dayLow } : null;
  }

  if (!candles || candles.length === 0) throw new Error("Sem histórico disponível.");
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const trend = calcTrend(closes);
  const volumeChange = calcVolumeChange(volumes);
  const ema20 = calcEMA(closes, 20);
  const ema50 = calcEMA(closes, 50);
  const { score } = calcularScore({ rsi, macd, volumeChange, trend });
  const direcao = direcaoSinal({ rsi, macd, trend });
  const confianca = confiancaSinal(score);

  const preco = Number(ticker?.lastPrice ?? closes[closes.length - 1] ?? 0);
  const variacao24h = Number(ticker?.priceChangePercent ?? 0);

  return { rsi, macd, trend, score, direcao, confianca, ema20, ema50, preco, variacao24h };
}

export default function AnaliseCarteira({ ativos = [], hidden, onAnalisar }) {
  const ativosAnalisaveis = useMemo(
    () => (ativos || []).filter(a => a?.ticker && TIPOS_ANALISAVEIS.includes(a.tipo)),
    [ativos]
  );

  const [intervalo, setIntervalo] = useState("1d");
  const [filterClasse, setFilterClasse] = useState("todos");
  const [filterSinal, setFilterSinal] = useState("todos");
  const [resultados, setResultados] = useState({}); // { [assetId]: { loading, data, erro } }
  const [scanning, setScanning] = useState(false);
  const scanIdRef = useRef(0);

  const scan = async () => {
    if (ativosAnalisaveis.length === 0) {
      toast.error("Nenhum ativo analisável na carteira.");
      return;
    }
    const myScanId = ++scanIdRef.current;
    setScanning(true);
    setResultados(prev => {
      const next = { ...prev };
      ativosAnalisaveis.forEach(a => { next[a.id] = { loading: true }; });
      return next;
    });

    // Analisa em paralelo (Promise.allSettled pra não cancelar tudo se um falhar)
    const promessas = ativosAnalisaveis.map(async (a) => {
      try {
        const data = await analisarAtivo(a, intervalo);
        if (scanIdRef.current !== myScanId) return; // novo scan disparou, ignora
        setResultados(prev => ({ ...prev, [a.id]: { loading: false, data } }));
      } catch (e) {
        if (scanIdRef.current !== myScanId) return;
        setResultados(prev => ({ ...prev, [a.id]: { loading: false, erro: e.message || "Erro" } }));
      }
    });
    await Promise.allSettled(promessas);
    if (scanIdRef.current === myScanId) setScanning(false);
  };

  // Scan inicial + quando troca o timeframe
  useEffect(() => { scan(); /* eslint-disable-next-line */ }, [intervalo]);

  // Aplica filtros e ordena por score desc
  const linhas = useMemo(() => {
    return ativosAnalisaveis
      .filter(a => filterClasse === "todos" || a.tipo === filterClasse)
      .map(a => ({ ativo: a, r: resultados[a.id] || { loading: true } }))
      .filter(({ r }) => {
        if (filterSinal === "todos") return true;
        if (!r?.data) return false;
        const dir = (r.data.direcao || "").toLowerCase();
        if (filterSinal === "compra") return dir.includes("compra") || dir.includes("long");
        if (filterSinal === "venda") return dir.includes("venda") || dir.includes("short");
        return !dir.includes("compra") && !dir.includes("venda") && !dir.includes("long") && !dir.includes("short");
      })
      .sort((x, y) => (y.r?.data?.score || 0) - (x.r?.data?.score || 0));
  }, [ativosAnalisaveis, resultados, filterClasse, filterSinal]);

  // KPIs do topo
  const kpi = useMemo(() => {
    const completos = ativosAnalisaveis.map(a => resultados[a.id]?.data).filter(Boolean);
    const compra = completos.filter(d => d.score >= 70).length;
    const venda = completos.filter(d => d.score <= 30).length;
    const media = completos.length > 0 ? completos.reduce((s,d) => s + (d.score || 0), 0) / completos.length : 0;
    return { total: ativosAnalisaveis.length, compra, venda, media };
  }, [ativosAnalisaveis, resultados]);

  const classesDisponiveis = useMemo(() => {
    const set = new Set(ativosAnalisaveis.map(a => a.tipo));
    return [...set];
  }, [ativosAnalisaveis]);

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="AF4 Trade · Carteira"
        title={<>Análise <em style={{ color: T.gold }}>da Carteira.</em></>}
        sub="Varredura técnica de todos os ativos da sua carteira — RSI, MACD, tendência e sinal."
        action={
          <button onClick={scan} disabled={scanning} className="btn-ghost"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {scanning
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
              : <RefreshCw size={13} />}
            {scanning ? "Analisando…" : "Recarregar"}
          </button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCell label="Ativos" valor={String(kpi.total)} cor={T.ink} />
        <KpiCell label="Sinais de compra" valor={String(kpi.compra)} cor={T.green} />
        <KpiCell label="Sinais de venda" valor={String(kpi.venda)} cor={T.red} />
        <KpiCell label="Score médio" valor={fmtN(kpi.media, 0)} cor={T.gold} />
      </div>

      {/* Filtros */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
        padding: 12, marginBottom: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
      }}>
        <div style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
          {["todos", ...classesDisponiveis].map(c => (
            <button key={c} onClick={() => setFilterClasse(c)}
              style={chip(filterClasse === c)}>
              {c === "todos" ? "Todas" : ASSET_CLASS_LABELS[c] || c}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "inline-flex", gap: 4 }}>
          {[{v:"todos",l:"Todos sinais"},{v:"compra",l:"🟢 Compra"},{v:"neutro",l:"🟡 Neutro"},{v:"venda",l:"🔴 Venda"}].map(s => (
            <button key={s.v} onClick={() => setFilterSinal(s.v)} style={chip(filterSinal === s.v)}>{s.l}</button>
          ))}
        </div>
        <div style={{ display: "inline-flex", gap: 4 }}>
          {INTERVALOS_BINANCE.map(i => (
            <button key={i.v} onClick={() => setIntervalo(i.v)} style={chipTf(intervalo === i.v)}>{i.l}</button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="analise-tabela-wrap" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div className="analise-tabela-scroll" style={{ overflowX: "auto" }}>
          <div className="analise-tabela-inner" style={{ minWidth: 620 }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1.6fr 0.9fr 0.7fr 0.7fr 0.8fr 0.9fr 0.7fr",
              padding: "9px 12px", borderBottom: `1px solid ${T.border}`,
              fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600,
            }}>
              <div>Ativo</div>
              <div className="text-right">Preço</div>
              <div className="text-right">RSI</div>
              <div className="text-right">MACD</div>
              <div className="text-right">Tendência</div>
              <div className="text-right">Score</div>
              <div className="text-right">Sinal</div>
            </div>
            {linhas.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 13 }}>
                {ativosAnalisaveis.length === 0
                  ? "Nenhum ativo analisável na carteira. Cadastre ações, FIIs, stocks, REITs, ETFs ou cripto."
                  : "Nenhum ativo bate com os filtros."}
              </div>
            ) : linhas.map(({ ativo, r }) => (
              <LinhaAtivo key={ativo.id} ativo={ativo} r={r} hidden={hidden} onAnalisar={onAnalisar} />
            ))}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: T.faint, textAlign: "center", fontStyle: "italic", marginTop: 12 }}>
        ⓘ Apoio à decisão · não é recomendação de investimento.
      </div>

      <style>{`
        @media (max-width: 640px) {
          .analise-tabela-scroll { -webkit-overflow-scrolling: touch; }
          .analise-tabela-scroll::after {
            content: "↔ deslize para ver mais";
            display: block;
            text-align: center;
            font-size: 10px;
            color: ${T.faint};
            font-style: italic;
            padding: 6px;
            border-top: 1px dashed ${T.border};
          }
        }
      `}</style>
    </div>
  );
}

function KpiCell({ label, valor, cor }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor}`, borderRadius: 8, padding: 12,
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, color: cor, fontWeight: 600, marginTop: 5, lineHeight: 1.1 }}>{valor}</div>
    </div>
  );
}

function LinhaAtivo({ ativo, r, hidden, onAnalisar }) {
  const moeda = (ativo.tipo === "stock" || ativo.tipo === "reit") ? "US$" : "R$";
  const corClasse = ASSET_CLASS_COLORS[ativo.tipo] || "#9ca3af";
  const d = r?.data;
  const dir = d?.direcao || "";
  const sinalCor = d ? (d.score >= 70 ? T.green : d.score <= 30 ? T.red : T.gold) : T.muted;
  const sinalEmoji = d ? (d.score >= 70 ? "🟢" : d.score <= 30 ? "🔴" : "🟡") : "·";

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "1.6fr 0.9fr 0.7fr 0.7fr 0.8fr 0.9fr 0.7fr",
      padding: "10px 12px", borderBottom: `1px solid ${T.border}`,
      alignItems: "center", fontSize: 12,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <span style={{ width: 6, height: 24, borderRadius: 2, background: corClasse, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: T.serif, fontSize: 14, color: T.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ativo.ticker}</div>
          <div style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {ASSET_CLASS_LABELS[ativo.tipo] || ativo.tipo} · {ativo.nome || "—"}
          </div>
        </div>
      </div>

      {/* Preço + var 24h */}
      <div style={{ textAlign: "right" }}>
        <div className="num" style={{ color: T.ink, fontSize: 12.5, whiteSpace: "nowrap" }}>
          {r?.loading ? "…" : d ? `${moeda} ${d.preco.toLocaleString("pt-BR", { maximumFractionDigits: d.preco < 1 ? 6 : 2 })}` : "—"}
        </div>
        <div className="num" style={{ fontSize: 10, color: d ? (d.variacao24h >= 0 ? T.green : T.red) : T.muted, whiteSpace: "nowrap" }}>
          {d ? `${d.variacao24h >= 0 ? "+" : ""}${fmtN(d.variacao24h, 2)}%` : ""}
        </div>
      </div>

      {/* RSI */}
      <div style={{ textAlign: "right" }}>
        {r?.loading ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite", color: T.muted, display: "inline" }}/>
         : r?.erro ? <AlertCircle size={12} style={{ color: T.red, display: "inline" }} />
         : d ? <span className="num" style={{ color: d.rsi >= 70 ? T.red : d.rsi <= 30 ? T.green : T.ink }}>{fmtN(d.rsi, 0)}</span>
         : "—"}
      </div>

      {/* MACD */}
      <div style={{ textAlign: "right" }}>
        {d ? (
          <span className="num" style={{ color: d.macd?.histogram >= 0 ? T.green : T.red, fontSize: 11 }}>
            {d.macd?.histogram >= 0 ? "↑" : "↓"} {fmtN(Math.abs(d.macd?.histogram || 0), 2)}
          </span>
        ) : "—"}
      </div>

      {/* Tendência */}
      <div style={{ textAlign: "right", color: T.muted, fontSize: 11 }}>
        {d ? (
          d.trend === "alta" ? <span style={{ color: T.green, display: "inline-flex", alignItems: "center", gap: 3 }}><TrendingUp size={12}/> Alta</span>
            : d.trend === "baixa" ? <span style={{ color: T.red, display: "inline-flex", alignItems: "center", gap: 3 }}><TrendingDown size={12}/> Baixa</span>
            : <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><Minus size={12}/> Lateral</span>
        ) : "—"}
      </div>

      {/* Score com barra */}
      <div>
        {d ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ flex: 1, height: 4, background: T.border, borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(0, Math.min(100, d.score))}%`, height: "100%", background: sinalCor }} />
            </div>
            <span className="num" style={{ color: sinalCor, fontWeight: 600, width: 28, textAlign: "right" }}>{fmtN(d.score, 0)}</span>
          </div>
        ) : r?.erro ? <span style={{ color: T.red, fontSize: 10 }} title={r.erro}>erro</span>
         : <Loader2 size={12} style={{ animation: "spin 1s linear infinite", color: T.muted }} />}
      </div>

      {/* Sinal + botão Analisar */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, color: sinalCor, fontWeight: 600 }}>{sinalEmoji} {d ? (d.confianca || "") : ""}</span>
        {onAnalisar && (
          <button onClick={() => onAnalisar(ativo)} aria-label={`Analisar ${ativo.ticker}`}
                  title="Análise detalhada"
                  style={{ color: T.gold, padding: 4, background: "transparent", border: `1px solid ${T.gold}`, borderRadius: 4, cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
            <LineChart size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

const chip = (active) => ({
  padding: "5px 11px", borderRadius: 5, fontSize: 11, fontWeight: 600,
  background: active ? T.gold : "transparent", color: active ? T.bg : T.muted,
  border: `1px solid ${active ? T.gold : T.border}`, cursor: "pointer", whiteSpace: "nowrap",
});

const chipTf = (active) => ({
  padding: "5px 11px", borderRadius: 5, fontSize: 11, fontWeight: 600,
  background: active ? T.ink : "transparent", color: active ? "#fff" : T.muted,
  border: `1px solid ${active ? T.ink : T.border}`, cursor: "pointer",
});
