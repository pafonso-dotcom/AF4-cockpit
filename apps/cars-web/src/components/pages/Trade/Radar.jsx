import React, { useState, useMemo } from "react";
import { RefreshCw, Sparkles, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { getTickers24h, getKlines } from "../../../lib/binance.js";
import { calcRSI, calcMACD, calcVolumeChange, calcTrend } from "../../../lib/indicadores.js";
import { calcularScore, direcaoSinal, confiancaSinal } from "../../../lib/score.js";
import { getWatchlist } from "../../../lib/watchlist.js";
import { gerarJSONGemini } from "../../../lib/gemini.js";
import { toast } from "../../../lib/toast.js";
import PageHeader from "../../ui/PageHeader.jsx";

const INTERVALOS = [
  { v: "1h", l: "1h" },
  { v: "4h", l: "4h" },
  { v: "1d", l: "1d" },
];

export default function Radar({
  tradeWatchlist = [],
  tradeHistorico = [],
  setTradeHistorico,
}) {
  const watchlist = getWatchlist(tradeWatchlist);
  const [intervalo, setIntervalo] = useState("4h");
  const [sinais, setSinais] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [explicacoes, setExplicacoes] = useState({});
  const [explicandoSym, setExplicandoSym] = useState(null);

  const analisar = async () => {
    setLoading(true);
    try {
      const symbols = watchlist.map(w => w.symbol);
      const tickers = await getTickers24h(symbols);

      const resultados = await Promise.all(watchlist.map(async (w) => {
        try {
          const candles = await getKlines(w.symbol, intervalo, 100);
          const closes = candles.map(c => c.close);
          const volumes = candles.map(c => c.volume);
          const ticker = tickers.find(t => t.symbol === w.symbol);
          const rsi = calcRSI(closes);
          const macd = calcMACD(closes);
          const volumeChange = calcVolumeChange(volumes);
          const trend = calcTrend(closes);
          const { score, breakdown } = calcularScore({ rsi, macd, volumeChange, trend });
          const direcao = direcaoSinal({ rsi, macd, trend });
          const confianca = confiancaSinal(score);
          return {
            ...w,
            preco: parseFloat(ticker?.lastPrice || 0),
            variacao24h: parseFloat(ticker?.priceChangePercent || 0),
            volume24h: parseFloat(ticker?.quoteVolume || 0),
            score, direcao, confianca, breakdown,
            rsi: rsi?.toFixed(0),
            macd_val: macd?.macd?.toFixed(2),
            volumeChange: volumeChange?.toFixed(0),
            trend,
            erro: false,
          };
        } catch (e) {
          return { ...w, erro: true, score: 0 };
        }
      }));

      resultados.sort((a, b) => (b.score || 0) - (a.score || 0));
      setSinais(resultados);
      const agora = new Date();
      setUltimaAtualizacao(agora);

      // Salva histórico (rolling 30)
      if (setTradeHistorico) {
        const novaEntrada = {
          timestamp: agora.toISOString(),
          intervalo,
          top5: resultados.slice(0, 5).map(r => ({
            symbol: r.symbol, score: r.score, direcao: r.direcao, preco: r.preco,
          })),
        };
        setTradeHistorico([novaEntrada, ...(tradeHistorico || [])].slice(0, 30));
      }
    } catch (e) {
      toast.error(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const explicar = async (sinal) => {
    setExplicandoSym(sinal.symbol);
    const prompt = `Você é um analista de cripto. Analise esses indicadores técnicos e gere uma narrativa CURTA em português brasileiro (máximo 3 frases) explicando o cenário atual.

Ativo: ${sinal.name} (${sinal.display})
Preço: US$ ${sinal.preco}
Variação 24h: ${sinal.variacao24h}%
Score: ${sinal.score}/100
Direção: ${sinal.direcao}
Indicadores:
- RSI: ${sinal.rsi}
- MACD: ${sinal.macd_val}
- Volume vs média: ${sinal.volumeChange}%
- Tendência: ${sinal.trend}

Retorne EXATAMENTE este JSON (sem markdown):
{
  "headline": "frase curta de 1 linha resumindo o cenário",
  "narrativa": "3 frases explicando o porquê",
  "suporte": "valor numérico em USD (se identificável)",
  "resistencia": "valor numérico em USD (se identificável)",
  "risco": "1 frase sobre o principal risco"
}`;
    try {
      const resp = await gerarJSONGemini(prompt, { temperature: 0.3, maxOutputTokens: 800 });
      setExplicacoes(prev => ({ ...prev, [sinal.symbol]: resp }));
    } catch (e) {
      setExplicacoes(prev => ({ ...prev, [sinal.symbol]: { erro: e.message } }));
    } finally {
      setExplicandoSym(null);
    }
  };

  const stats = useMemo(() => {
    const scoreAlto = sinais.filter(s => (s.score || 0) >= 70).length;
    return { total: sinais.length, scoreAlto };
  }, [sinais]);

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="AF4 Trade · Radar de cripto"
        title={<>Radar · <em>cripto.</em></>}
        sub="Analisa sua watchlist em tempo real combinando RSI, MACD, volume e tendência. Score 0-100 + explicação via IA."
        action={
          <button onClick={analisar} disabled={loading} className="btn-gold"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <RefreshCw size={14} />}
            {loading ? "Analisando…" : "Atualizar"}
          </button>
        }
      />

      {/* KPIs + Toggle de intervalo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <KpiCard label="Analisadas" valor={stats.total} sub={`${watchlist.length} na watchlist`} cor={T.muted} />
        <KpiCard label="Score alto (≥70)" valor={stats.scoreAlto} sub="oportunidades" cor={T.green} />
        <KpiCard label="Última varredura" valor={ultimaAtualizacao ? ultimaAtualizacao.toLocaleTimeString("pt-BR").slice(0, 5) : "—"} sub={ultimaAtualizacao ? ultimaAtualizacao.toLocaleDateString("pt-BR") : "execute"} cor={T.gold} />
        <KpiCard label="Timeframe" valor={
          <div style={{ display: "inline-flex", gap: 4 }}>
            {INTERVALOS.map(i => (
              <button key={i.v} onClick={() => setIntervalo(i.v)}
                style={{
                  padding: "4px 10px", borderRadius: 5, fontSize: 11.5,
                  background: intervalo === i.v ? T.gold : "transparent",
                  color: intervalo === i.v ? T.bg : T.muted,
                  border: `1px solid ${intervalo === i.v ? T.gold : T.border}`,
                  fontWeight: 600, cursor: "pointer",
                }}>{i.l}</button>
            ))}
          </div>
        } sub="janela" cor={T.blue || "#60a5fa"} />
      </div>

      {/* Lista de sinais */}
      {sinais.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
        }}>
          {loading
            ? "Buscando dados da Binance…"
            : "Clique em Atualizar pra analisar sua watchlist."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sinais.map(s => (
            <SinalCard
              key={s.symbol} s={s}
              explicacao={explicacoes[s.symbol]}
              explicando={explicandoSym === s.symbol}
              onExplicar={() => explicar(s)}
            />
          ))}
        </div>
      )}

      <div style={{
        marginTop: 18, padding: 10, fontSize: 11, color: T.faint,
        fontStyle: "italic", textAlign: "center",
      }}>
        ⓘ Apoio à decisão · não é recomendação de investimento.
        Dados públicos da Binance (até 1min de atraso).
      </div>
    </div>
  );
}

function KpiCard({ label, valor, sub, cor }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${cor}`, borderRadius: 8, padding: 14,
    }}>
      <div style={{
        fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
        color: T.muted, fontWeight: 600,
      }}>{label}</div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 22, color: cor,
        fontWeight: 600, marginTop: 6, lineHeight: 1.1,
      }}>{valor}</div>
      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function SinalCard({ s, explicacao, explicando, onExplicar }) {
  const scoreCor = s.score >= 70 ? T.green : s.score >= 50 ? T.gold : T.muted;
  const direcaoCfg = {
    long:   { bg: `${T.green}22`, fg: T.green, label: "ALTA",   Icon: TrendingUp },
    short:  { bg: `${T.red}22`,   fg: T.red,   label: "BAIXA",  Icon: TrendingDown },
    neutro: { bg: `${T.muted}22`, fg: T.muted, label: "NEUTRO", Icon: Minus },
  }[s.direcao] || { bg: `${T.muted}22`, fg: T.muted, label: "—", Icon: Minus };

  const DirIcon = direcaoCfg.Icon;

  if (s.erro) {
    return (
      <div style={{
        background: T.card, border: `1px dashed ${T.red}55`, borderRadius: 10,
        padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
        opacity: 0.6,
      }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: T.bgSoft,
                      display: "grid", placeItems: "center", fontSize: 16 }}>
          {s.icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: T.ink, fontWeight: 500, fontSize: 13 }}>{s.name}</div>
          <div style={{ color: T.red, fontSize: 11 }}>Falha ao buscar dados</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: T.card, border: `1px solid ${s.score >= 70 ? T.gold + "66" : T.border}`,
      borderLeft: `4px solid ${scoreCor}`, borderRadius: 10,
    }}>
      <div style={{
        padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: T.bgSoft,
          display: "grid", placeItems: "center", flexShrink: 0,
          fontSize: 18, fontWeight: 700, color: T.gold,
        }}>{s.icon}</div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ color: T.ink, fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {s.name}
            <span style={{ color: T.muted, fontWeight: 400, fontSize: 11 }}>{s.display}</span>
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            US$ {s.preco?.toLocaleString("en-US", { maximumFractionDigits: s.preco < 1 ? 6 : 2 })}
            <span style={{ marginLeft: 6, color: s.variacao24h >= 0 ? T.green : T.red, fontWeight: 600 }}>
              {s.variacao24h >= 0 ? "+" : ""}{s.variacao24h?.toFixed(2)}%
            </span>
          </div>
        </div>

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 100,
          background: direcaoCfg.bg, color: direcaoCfg.fg,
          fontSize: 10, fontWeight: 700, letterSpacing: ".1em",
        }}>
          <DirIcon size={12} /> {direcaoCfg.label}
        </div>

        <div style={{ minWidth: 60, textAlign: "right" }}>
          <div className="num" style={{
            fontFamily: T.serif, color: scoreCor,
            fontSize: 26, fontWeight: 700, lineHeight: 1,
          }}>{s.score}</div>
          <div style={{ fontSize: 9, color: T.faint, letterSpacing: ".1em", textTransform: "uppercase" }}>score</div>
        </div>

        <button onClick={onExplicar} disabled={explicando}
          style={{
            background: explicacao && !explicacao.erro ? `${T.gold}22` : "transparent",
            color: T.gold, border: `1px solid ${T.gold}55`,
            padding: "6px 11px", borderRadius: 6, fontSize: 10.5, fontWeight: 600,
            letterSpacing: ".05em", cursor: explicando ? "wait" : "pointer",
            display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
          }}>
          {explicando
            ? <><Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> Pensando…</>
            : <><Sparkles size={11} /> Explicar</>}
        </button>
      </div>

      {/* Linha de indicadores */}
      <div style={{
        padding: "0 14px 12px",
        display: "flex", gap: 14, fontSize: 10.5, color: T.muted, flexWrap: "wrap",
      }}>
        <span>RSI <strong style={{ color: T.ink }}>{s.rsi ?? "—"}</strong></span>
        <span>MACD <strong style={{ color: T.ink }}>{s.macd_val ?? "—"}</strong></span>
        <span>Vol <strong style={{ color: T.ink }}>{s.volumeChange != null ? `${s.volumeChange}%` : "—"}</strong></span>
        <span>Tend <strong style={{ color: T.ink }}>{s.trend}</strong></span>
      </div>

      {/* Box explicação Gemini */}
      {explicacao && !explicacao.erro && (
        <div style={{
          margin: "0 14px 14px", padding: 12,
          background: `${T.gold}11`, border: `1px solid ${T.gold}55`,
          borderRadius: 8,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
            color: T.gold, fontWeight: 600, fontSize: 12,
          }}>
            <Sparkles size={13} /> {explicacao.headline || "Análise IA"}
          </div>
          {explicacao.narrativa && (
            <div style={{ fontSize: 12, color: T.ink, lineHeight: 1.6, marginBottom: 8 }}>
              {explicacao.narrativa}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, fontSize: 11, color: T.muted, marginTop: 6 }}>
            {explicacao.suporte && <div>📉 Suporte: <strong style={{ color: T.ink }}>${explicacao.suporte}</strong></div>}
            {explicacao.resistencia && <div>📈 Resistência: <strong style={{ color: T.ink }}>${explicacao.resistencia}</strong></div>}
          </div>
          {explicacao.risco && (
            <div style={{ marginTop: 8, fontSize: 11, color: T.red, fontStyle: "italic" }}>
              ⚠ {explicacao.risco}
            </div>
          )}
          <div style={{ fontSize: 9.5, color: T.faint, marginTop: 8, fontStyle: "italic" }}>
            Gerado por Gemini · não é recomendação de investimento.
          </div>
        </div>
      )}
      {explicacao && explicacao.erro && (
        <div style={{
          margin: "0 14px 14px", padding: 10, fontSize: 11,
          background: `${T.red}11`, color: T.red, borderRadius: 6,
        }}>
          ✗ {explicacao.erro}
        </div>
      )}
    </div>
  );
}
