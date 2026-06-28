import React, { useState, useEffect } from "react";
import { Search, Star, TrendingUp, TrendingDown, Loader2, ArrowUpRight } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtP } from "../../lib/format.js";
import PageHeader from "../ui/PageHeader.jsx";
import { getQuotes, getHistorico } from "../../lib/brapi.js";
import { carregarWatchlist, salvarWatchlist, adicionarPapel } from "../../lib/mercadoWatchlist.js";

const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };

// Posição do preço dentro da faixa de 52 semanas (0–100%).
function posFaixa(price, low, high) {
  if (!(high > low)) return 50;
  return Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
}

// Leitura rápida heurística — sem IA externa, sempre disponível.
function leituraRapida(q) {
  const partes = [];
  if (Number.isFinite(q.changePercent)) {
    partes.push(`hoje ${q.changePercent >= 0 ? "subindo" : "caindo"} ${Math.abs(q.changePercent).toFixed(2)}%`);
  }
  if (q.fiftyTwoWeekLow != null && q.fiftyTwoWeekHigh != null && q.price != null) {
    const p = posFaixa(q.price, q.fiftyTwoWeekLow, q.fiftyTwoWeekHigh);
    if (p >= 85) partes.push("negociando perto da máxima de 52 semanas");
    else if (p <= 15) partes.push("perto da mínima de 52 semanas");
    else partes.push(`a ${p.toFixed(0)}% da faixa de 52 semanas`);
  }
  return partes.length ? `${q.symbol} está ${partes.join(", ")}.` : `Cotação de ${q.symbol} carregada.`;
}

function Sparkline({ pontos }) {
  if (!pontos || pontos.length < 2) return null;
  const closes = pontos.map((p) => p.close);
  const min = Math.min(...closes), max = Math.max(...closes);
  const span = max - min || 1;
  const W = 320, H = 64;
  const path = closes
    .map((c, i) => `${(i / (closes.length - 1)) * W},${H - ((c - min) / span) * H}`)
    .join(" ");
  const subiu = closes[closes.length - 1] >= closes[0];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 64 }} preserveAspectRatio="none">
      <polyline points={path} fill="none" stroke={subiu ? T.green : T.red} strokeWidth="2" />
    </svg>
  );
}

/**
 * Pesquisador de mercado — consulta um papel (ação/FII) via BRAPI.
 * Cotação, faixa de 52 semanas, mini-gráfico e leitura rápida. Botão pra
 * acompanhar (alimenta o Construtor de mercado).
 */
export default function PesquisadorMercado({ onIrConstrutor }) {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [quote, setQuote] = useState(null);
  const [hist, setHist] = useState([]);
  const [watch, setWatch] = useState(() => carregarWatchlist());

  useEffect(() => { salvarWatchlist(watch); }, [watch]);

  const naWatchlist = quote && watch.some((x) => x.symbol === quote.symbol);

  async function pesquisar(e) {
    e?.preventDefault();
    const tk = ticker.trim().toUpperCase();
    if (!tk) return;
    setLoading(true); setErro(null); setQuote(null); setHist([]);
    try {
      const [qs, h] = await Promise.all([
        getQuotes([tk]),
        getHistorico(tk, "6mo", "1d").catch(() => []),
      ]);
      if (!qs || qs.length === 0) {
        setErro(`Nada encontrado para "${tk}". Confira o ticker (ex.: PETR4, ITUB4, HGLG11).`);
      } else {
        setQuote(qs[0]);
        setHist(h);
      }
    } catch (err) {
      setErro(err?.message || "Falha ao consultar a BRAPI.");
    } finally {
      setLoading(false);
    }
  }

  function acompanhar() {
    if (!quote) return;
    setWatch((prev) => adicionarPapel(prev, { symbol: quote.symbol, name: quote.name || quote.symbol }));
  }

  const sobe = quote && Number(quote.changePercent) >= 0;
  const pos = quote ? posFaixa(quote.price, quote.fiftyTwoWeekLow, quote.fiftyTwoWeekHigh) : 50;

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Pesquisador de mercado"
        title={<>Pesquisador de <em>mercado.</em></>}
        sub="Consulte um papel: cotação, faixa de 52 semanas e mini-gráfico. Acompanhe pra montar carteira."
        action={
          <button onClick={onIrConstrutor} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}>
            <Star size={13} /> {watch.length} acompanhados
          </button>
        }
      />

      <form onSubmit={pesquisar} style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12, padding: "0 12px" }}>
          <Search size={16} style={{ color: T.muted }} />
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value)}
            placeholder="Ticker (ex.: PETR4, VALE3, HGLG11)"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T.ink, fontSize: 15, padding: "10px 0", fontFamily: "inherit", textTransform: "uppercase" }}
          />
        </div>
        <button type="submit" disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, background: T.gold, color: "#fff", border: "none", borderRadius: 12, padding: "0 18px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
          {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />} Pesquisar
        </button>
      </form>

      {erro && (
        <div style={{ ...CARD, marginTop: 12, background: `${T.red}12`, border: `1px solid ${T.red}40`, color: T.ink, fontSize: 13 }}>
          {erro}
        </div>
      )}

      {quote && (
        <div style={{ ...CARD, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: T.ink }}>{quote.symbol}</div>
              <div style={{ fontSize: 12.5, color: T.muted }}>{quote.name || "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: T.ink }}>{fmt(quote.price)}</div>
              {Number.isFinite(quote.changePercent) && (
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", color: sobe ? T.green : T.red, fontWeight: 700, fontSize: 13 }}>
                  {sobe ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {fmtP(quote.changePercent)}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 14 }}><Sparkline pontos={hist} /></div>

          {/* Faixa de 52 semanas */}
          {quote.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.faint, marginBottom: 4 }}>
                <span>{fmt(quote.fiftyTwoWeekLow)}</span>
                <span style={{ letterSpacing: ".06em", textTransform: "uppercase" }}>52 semanas</span>
                <span>{fmt(quote.fiftyTwoWeekHigh)}</span>
              </div>
              <div style={{ position: "relative", height: 8, background: T.bgSoft, borderRadius: 5 }}>
                <div style={{ position: "absolute", left: `calc(${pos}% - 5px)`, top: -2, width: 12, height: 12, borderRadius: "50%", background: T.gold, border: `2px solid ${T.card}` }} />
              </div>
            </div>
          )}

          <div style={{ marginTop: 14, padding: "10px 12px", background: T.bgSoft, borderRadius: 10, color: T.ink, fontSize: 13 }}>
            {leituraRapida(quote)}
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button
              onClick={acompanhar}
              disabled={naWatchlist}
              style={{ display: "flex", alignItems: "center", gap: 6, background: naWatchlist ? "transparent" : T.gold, color: naWatchlist ? T.muted : "#fff", border: naWatchlist ? `1px solid ${T.border}` : "none", borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 700, cursor: naWatchlist ? "default" : "pointer" }}>
              <Star size={15} fill={naWatchlist ? T.gold : "none"} /> {naWatchlist ? "Acompanhando" : "Acompanhar"}
            </button>
            {watch.length > 0 && (
              <button onClick={onIrConstrutor} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", color: T.gold, border: `1px solid ${T.border}`, borderRadius: 10, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                Montar carteira <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      )}

      {!quote && !erro && !loading && (
        <div style={{ ...CARD, marginTop: 12, color: T.faint, fontSize: 13, fontStyle: "italic" }}>
          Digite um ticker da B3 e clique em Pesquisar. Precisa do token BRAPI configurado em ⚙ Configurações.
        </div>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
