import React, { useState, useEffect, useMemo } from "react";
import { Sparkles, Loader2, RefreshCw } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { getKlines, getTicker24h } from "../../../lib/binance.js";
import { getHistorico, getQuotes } from "../../../lib/brapi.js";
import { calcRSI, calcMACD, calcVolumeChange, calcTrend, calcEMA } from "../../../lib/indicadores.js";
import { calcularScore, direcaoSinal, confiancaSinal } from "../../../lib/score.js";
import { getWatchlist } from "../../../lib/watchlist.js";
import { gerarJSONGemini } from "../../../lib/gemini.js";
import { toast } from "../../../lib/toast.js";
import { TIPOS_ANALISAVEIS } from "../../../lib/invest-constants.js";
import PageHeader from "../../ui/PageHeader.jsx";

const INTERVALOS = [
  { v: "15m", l: "15m" },
  { v: "1h",  l: "1h" },
  { v: "4h",  l: "4h" },
  { v: "1d",  l: "1d" },
  { v: "1w",  l: "1w" },
];

// Timeframes disponíveis por fonte
const INTERVALOS_BINANCE = ["15m", "1h", "4h", "1d", "1w"];
const INTERVALOS_BRAPI = ["1d", "1w"];

// Mapeia o timeframe da UI para os parâmetros da BRAPI (range + interval)
// Ranges limitados a "3mo" (compatível com plano gratuito/básico da Brapi).
const BRAPI_TF = {
  "1d": { range: "3mo", interval: "1d" },
  "1w": { range: "3mo", interval: "1wk" },
};

// Constrói a lista unificada de itens analisáveis (watchlist cripto + carteira)
function buildItens(watchlist, ativos) {
  const itens = [];
  const vistos = new Set();
  const add = (it) => {
    if (!it.symbol || vistos.has(it.symbol)) return;
    vistos.add(it.symbol);
    itens.push(it);
  };
  // (a) Watchlist de cripto
  for (const w of watchlist) {
    add({
      key: `bin:${w.symbol}`,
      label: `${w.icon || "•"} ${w.name} (${w.symbol})`,
      symbol: w.symbol,
      tipo: "cripto",
      fonte: "binance",
    });
  }
  // (b) Ativos da carteira
  for (const a of (ativos || [])) {
    if (!a?.ticker || !TIPOS_ANALISAVEIS.includes(a.tipo)) continue;
    if (a.tipo === "cripto") {
      add({
        key: `bin:${a.ticker}USDT`,
        label: `${a.nome || a.ticker} (${a.ticker})`,
        symbol: `${a.ticker}USDT`,
        tipo: "cripto",
        fonte: "binance",
      });
    } else {
      add({
        key: `bra:${a.ticker}`,
        label: `${a.nome || a.ticker} (${a.ticker})`,
        symbol: a.ticker,
        tipo: a.tipo,
        fonte: "brapi",
      });
    }
  }
  return itens;
}

// Símbolo da moeda conforme o tipo de ativo
function moedaDe(tipo) {
  return (tipo === "acao" || tipo === "fii") ? "R$" : "US$";
}

export default function Analise({ tradeWatchlist = [], ativos = [], alvoInicial = null, onVoltar = null }) {
  const watchlist = getWatchlist(tradeWatchlist);
  const itens = useMemo(() => buildItens(watchlist, ativos), [watchlist, ativos]);

  // Resolve o item inicial: alvo vindo da carteira, ou o primeiro da lista
  const itemInicial = useMemo(() => {
    if (alvoInicial?.ticker) {
      const tickerUp = String(alvoInicial.ticker).toUpperCase();
      const symbolAlvo = alvoInicial.tipo === "cripto" ? `${tickerUp}USDT` : tickerUp;
      const match = itens.find(it =>
        it.symbol.toUpperCase() === symbolAlvo &&
        (it.tipo === alvoInicial.tipo || (it.tipo === "cripto" && alvoInicial.tipo === "cripto"))
      );
      if (match) return match;
    }
    return itens[0] || null;
  }, [alvoInicial, itens]);

  const [selectedKey, setSelectedKey] = useState(itemInicial?.key || "");
  const item = itens.find(it => it.key === selectedKey) || itemInicial || itens[0] || null;
  const [intervalo, setIntervalo] = useState("4h");
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [explicacao, setExplicacao] = useState(null);
  const [explicando, setExplicando] = useState(false);

  // Reage a um novo alvo vindo da carteira
  useEffect(() => {
    if (itemInicial?.key) setSelectedKey(itemInicial.key);
    // eslint-disable-next-line
  }, [itemInicial?.key]);

  // Timeframes válidos pra fonte atual; volta pra 1d se o ativo brapi não suporta o intervalo
  const intervalosDisponiveis = item?.fonte === "brapi" ? INTERVALOS_BRAPI : INTERVALOS_BINANCE;
  useEffect(() => {
    if (item?.fonte === "brapi" && !INTERVALOS_BRAPI.includes(intervalo)) {
      setIntervalo("1d");
    }
    // eslint-disable-next-line
  }, [item?.fonte]);

  const analisar = async () => {
    if (!item) return;
    setLoading(true);
    setExplicacao(null);
    try {
      let candles, ticker;
      if (item.fonte === "brapi") {
        const tf = BRAPI_TF[INTERVALOS_BRAPI.includes(intervalo) ? intervalo : "1d"];
        const [hist, quotes] = await Promise.all([
          getHistorico(item.symbol, tf.range, tf.interval),
          getQuotes([item.symbol]).catch(() => []),
        ]);
        candles = hist;
        const q = quotes?.[0];
        ticker = q ? {
          lastPrice: q.price,
          priceChangePercent: q.changePercent,
          highPrice: q.dayHigh,
          lowPrice: q.dayLow,
        } : null;
        if (!candles || candles.length === 0) {
          throw new Error(`Sem histórico disponível para ${item.symbol} na BRAPI.`);
        }
      } else {
        [candles, ticker] = await Promise.all([
          getKlines(item.symbol, intervalo, 100),
          getTicker24h(item.symbol).catch(() => null),
        ]);
      }
      const closes = candles.map(c => c.close);
      const volumes = candles.map(c => c.volume);
      const rsi = calcRSI(closes);
      const macd = calcMACD(closes);
      const volumeChange = calcVolumeChange(volumes);
      const trend = calcTrend(closes);
      const ema20 = calcEMA(closes, 20);
      const ema50 = calcEMA(closes, 50);
      const { score, breakdown } = calcularScore({ rsi, macd, volumeChange, trend });
      const direcao = direcaoSinal({ rsi, macd, trend });
      const confianca = confiancaSinal(score);

      setDados({
        candles,
        ticker,
        rsi, macd, volumeChange, trend,
        ema20, ema50, score, breakdown, direcao, confianca,
        preco: parseFloat(ticker?.lastPrice || closes[closes.length - 1] || 0),
        variacao24h: parseFloat(ticker?.priceChangePercent || 0),
        high24h: parseFloat(ticker?.highPrice || 0),
        low24h: parseFloat(ticker?.lowPrice || 0),
      });
    } catch (e) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Análise inicial
  useEffect(() => { analisar(); /* eslint-disable-next-line */ }, [selectedKey, intervalo]);

  const explicar = async () => {
    if (!dados || !item) return;
    setExplicando(true);
    const moeda = moedaDe(item.tipo);
    const nomeAtivo = item.label;
    const prompt = `Análise técnica detalhada do ativo ${nomeAtivo} no timeframe ${intervalo}.

Dados:
- Preço atual: ${moeda} ${dados.preco}
- Variação 24h: ${dados.variacao24h}%
- Máxima 24h: ${moeda} ${dados.high24h}
- Mínima 24h: ${moeda} ${dados.low24h}
- RSI: ${dados.rsi?.toFixed(1)}
- MACD: ${dados.macd?.macd?.toFixed(3)} (histograma ${dados.macd?.histogram?.toFixed(3)})
- Volume vs média 20: ${dados.volumeChange?.toFixed(1)}%
- Tendência (EMA20 vs EMA50): ${dados.trend}
- EMA20: ${dados.ema20?.toFixed(2)} | EMA50: ${dados.ema50?.toFixed(2)}
- Score: ${dados.score}/100 (direção ${dados.direcao}, confiança ${dados.confianca})

Retorne EXATAMENTE este JSON (sem markdown):
{
  "headline": "frase de 1 linha resumindo o cenário",
  "cenario": "2-3 frases sobre a situação atual",
  "argumento_long": "1-2 frases — quando comprar faria sentido",
  "argumento_short": "1-2 frases — quando vender faria sentido",
  "suporte_chave": "valor numérico em ${moeda}",
  "resistencia_chave": "valor numérico em ${moeda}",
  "stop_sugerido": "valor numérico em ${moeda} (proteção)",
  "alvo_sugerido": "valor numérico em ${moeda} (objetivo)",
  "risco_principal": "1 frase sobre o maior risco",
  "horizonte": "curto | médio | longo"
}`;
    try {
      const resp = await gerarJSONGemini(prompt, { temperature: 0.3, maxOutputTokens: 1200 });
      setExplicacao(resp);
    } catch (e) {
      setExplicacao({ erro: e.message });
    } finally {
      setExplicando(false);
    }
  };

  const scoreCor = dados ? (dados.score >= 70 ? T.green : dados.score >= 50 ? T.gold : T.muted) : T.muted;

  return (
    <div className="fade-up py-8 px-6">
      {onVoltar && (
        <button onClick={onVoltar} className="btn-ghost"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12 }}>
          ← Voltar para Análise da Carteira
        </button>
      )}
      <PageHeader
        eyebrow="AF4 Trade · Análise individual"
        title={<>Análise <em>técnica.</em></>}
        sub="Mergulho num único ativo com indicadores detalhados + análise IA profunda."
        action={
          <button onClick={analisar} disabled={loading} className="btn-ghost">
            {loading
              ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} className="inline mr-1.5" />
              : <RefreshCw size={13} className="inline mr-1.5" />}
            Recarregar
          </button>
        }
      />

      {/* Controles */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
        padding: 14, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
      }}>
        <select value={selectedKey} onChange={e => setSelectedKey(e.target.value)}
                style={{ flex: "0 0 260px", padding: "8px 11px", background: T.bgSoft,
                         border: `1px solid ${T.border}`, color: T.ink, fontSize: 12, borderRadius: 11 }}>
          {itens.length === 0 && <option value="">Nenhum ativo disponível</option>}
          {(() => {
            const cripto = itens.filter(it => it.fonte === "binance");
            const carteira = itens.filter(it => it.fonte === "brapi");
            return (
              <>
                {cripto.length > 0 && (
                  <optgroup label="Cripto">
                    {cripto.map(it => (
                      <option key={it.key} value={it.key}>{it.label}</option>
                    ))}
                  </optgroup>
                )}
                {carteira.length > 0 && (
                  <optgroup label="Carteira (B3 / EUA)">
                    {carteira.map(it => (
                      <option key={it.key} value={it.key}>{it.label}</option>
                    ))}
                  </optgroup>
                )}
              </>
            );
          })()}
        </select>
        <div style={{ display: "inline-flex", gap: 4 }}>
          {INTERVALOS.filter(i => intervalosDisponiveis.includes(i.v)).map(i => (
            <button key={i.v} onClick={() => setIntervalo(i.v)}
              style={{
                padding: "6px 11px", borderRadius: 5, fontSize: 11,
                background: intervalo === i.v ? T.gold : "transparent",
                color: intervalo === i.v ? T.bg : T.muted,
                border: `1px solid ${intervalo === i.v ? T.gold : T.border}`,
                fontWeight: 600, cursor: "pointer",
              }}>{i.l}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic" }}>
          <Loader2 size={28} style={{ animation: "spin 1s linear infinite", color: T.gold }} />
          <div style={{ marginTop: 12 }}>Buscando dados…</div>
        </div>
      )}

      {dados && !loading && (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Kpi label="Preço" valor={`${moedaDe(item?.tipo)} ${dados.preco.toLocaleString("pt-BR", { maximumFractionDigits: dados.preco < 1 ? 6 : 2 })}`} sub={`24h ${dados.variacao24h >= 0 ? "+" : ""}${dados.variacao24h.toFixed(2)}%`} cor={dados.variacao24h >= 0 ? T.green : T.red} />
            <Kpi label="Score" valor={`${dados.score}/100`} sub={`${dados.direcao} · ${dados.confianca}`} cor={scoreCor} />
            <Kpi label="RSI (14)" valor={dados.rsi?.toFixed(0)} sub={dados.breakdown?.rsi} cor={T.blue || "#60a5fa"} />
            <Kpi label="Volume" valor={dados.volumeChange != null ? `${dados.volumeChange.toFixed(0)}%` : "—"} sub={dados.breakdown?.volume} cor={T.gold} />
          </div>

          {/* Mini candle chart SVG */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <div className="label-eyebrow" style={{ marginBottom: 10 }}>Últimos 100 períodos · {intervalo}</div>
            <CandleChartSVG candles={dados.candles} ema20={dados.ema20} ema50={dados.ema50} />
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 }}>
              <div className="label-eyebrow" style={{ marginBottom: 10 }}>Indicadores</div>
              {[
                ["RSI (14)", dados.rsi?.toFixed(2), dados.breakdown?.rsi],
                ["MACD", dados.macd?.macd?.toFixed(3), dados.breakdown?.macd],
                ["Volume", `${dados.volumeChange?.toFixed(1)}%`, dados.breakdown?.volume],
                ["Tendência", dados.trend, dados.breakdown?.trend],
                ["EMA20", dados.ema20?.toFixed(2), null],
                ["EMA50", dados.ema50?.toFixed(2), null],
              ].map(([l, v, d]) => (
                <div key={l} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  padding: "8px 0", borderBottom: `1px dashed ${T.border}`,
                }}>
                  <span style={{ color: T.muted, fontSize: 12 }}>{l}</span>
                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ color: T.ink, fontSize: 13, fontWeight: 600 }}>{v ?? "—"}</div>
                    {d && <div style={{ fontSize: 10, color: T.faint }}>{d}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: `linear-gradient(135deg, ${T.gold}11, transparent)`,
              border: `1px solid ${T.gold}55`, borderRadius: 16, padding: 14,
              display: "flex", flexDirection: "column",
            }}>
              <div className="label-eyebrow" style={{ color: T.gold, marginBottom: 10 }}>✨ Análise IA</div>
              {!explicacao && !explicando && (
                <>
                  <p style={{ fontSize: 12, color: T.muted, lineHeight: 1.5, marginBottom: 14 }}>
                    Clique abaixo pra gerar uma análise detalhada do cenário, suporte/resistência, alvo sugerido e principais riscos.
                  </p>
                  <button onClick={explicar} className="btn-gold"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, alignSelf: "flex-start" }}>
                    <Sparkles size={13} /> Gerar análise
                  </button>
                </>
              )}
              {explicando && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: T.muted, fontSize: 12 }}>
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: T.gold }} />
                  Gemini pensando…
                </div>
              )}
              {explicacao && !explicacao.erro && (
                <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.6 }}>
                  <div style={{ color: T.gold, fontWeight: 600, marginBottom: 6 }}>{explicacao.headline}</div>
                  <div style={{ marginBottom: 8 }}>{explicacao.cenario}</div>
                  {explicacao.argumento_long && (
                    <div style={{ fontSize: 11.5, color: T.green, marginBottom: 4 }}>
                      <strong>Long:</strong> {explicacao.argumento_long}
                    </div>
                  )}
                  {explicacao.argumento_short && (
                    <div style={{ fontSize: 11.5, color: T.red, marginBottom: 8 }}>
                      <strong>Short:</strong> {explicacao.argumento_short}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 11, color: T.muted, marginTop: 6 }}>
                    {explicacao.suporte_chave && <div>📉 Suporte: <strong style={{ color: T.ink }}>{moedaDe(item?.tipo)} {explicacao.suporte_chave}</strong></div>}
                    {explicacao.resistencia_chave && <div>📈 Resistência: <strong style={{ color: T.ink }}>{moedaDe(item?.tipo)} {explicacao.resistencia_chave}</strong></div>}
                    {explicacao.stop_sugerido && <div>🛑 Stop: <strong style={{ color: T.red }}>{moedaDe(item?.tipo)} {explicacao.stop_sugerido}</strong></div>}
                    {explicacao.alvo_sugerido && <div>🎯 Alvo: <strong style={{ color: T.green }}>{moedaDe(item?.tipo)} {explicacao.alvo_sugerido}</strong></div>}
                  </div>
                  {explicacao.risco_principal && (
                    <div style={{ marginTop: 10, fontSize: 11, color: T.red, fontStyle: "italic" }}>
                      ⚠ {explicacao.risco_principal}
                    </div>
                  )}
                  {explicacao.horizonte && (
                    <div style={{ marginTop: 6, fontSize: 10.5, color: T.faint }}>
                      Horizonte: {explicacao.horizonte}
                    </div>
                  )}
                </div>
              )}
              {explicacao?.erro && (
                <div style={{ color: T.red, fontSize: 11.5 }}>✗ {explicacao.erro}</div>
              )}
            </div>
          </div>

          <div style={{ fontSize: 11, color: T.faint, textAlign: "center", fontStyle: "italic", marginTop: 8 }}>
            ⓘ Apoio à decisão · não é recomendação de investimento.
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, valor, sub, cor }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor}`, borderRadius: 14, padding: 12,
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
                    color: T.muted, fontWeight: 600 }}>{label}</div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 18, color: cor,
        fontWeight: 600, marginTop: 5, lineHeight: 1.1,
      }}>{valor}</div>
      {sub && <div style={{ fontSize: 10, color: T.faint, marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// Mini candle chart SVG (sem libs)
function CandleChartSVG({ candles, ema20, ema50 }) {
  if (!candles || candles.length === 0) return null;
  const W = 800, H = 200;
  const padX = 10, padY = 12;
  const innerW = W - padX * 2;
  const innerH = H - padY * 2;
  const minLow = Math.min(...candles.map(c => c.low));
  const maxHigh = Math.max(...candles.map(c => c.high));
  const range = maxHigh - minLow || 1;
  const cw = innerW / candles.length;

  const y = (price) => padY + (1 - (price - minLow) / range) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: "100%", height: "auto" }}>
      {candles.map((c, i) => {
        const x = padX + i * cw + cw / 2;
        const isUp = c.close >= c.open;
        const cor = isUp ? T.green : T.red;
        return (
          <g key={i}>
            <line x1={x} y1={y(c.high)} x2={x} y2={y(c.low)} stroke={cor} strokeWidth="1" />
            <rect
              x={x - cw / 3} y={y(Math.max(c.open, c.close))}
              width={Math.max(1, (cw / 3) * 2)} height={Math.max(1, Math.abs(y(c.open) - y(c.close)))}
              fill={cor}
            />
          </g>
        );
      })}
      {/* EMA20 e EMA50 como linhas horizontais de referência */}
      {ema20 && (
        <line x1={padX} y1={y(ema20)} x2={W - padX} y2={y(ema20)}
              stroke={T.gold} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
      )}
      {ema50 && (
        <line x1={padX} y1={y(ema50)} x2={W - padX} y2={y(ema50)}
              stroke={T.blue || "#60a5fa"} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
      )}
    </svg>
  );
}
