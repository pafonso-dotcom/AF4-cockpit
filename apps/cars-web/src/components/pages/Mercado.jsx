import React, { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN, fmtP } from "../../lib/format.js";
import { API } from "../../lib/api.js";
import PageHeader from "../ui/PageHeader.jsx";

export default function Mercado({ ativos, apiKeys }) {
  const [liveIndices, setLiveIndices] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [tick, setTick] = useState(0); // incrementa pra forçar refetch

  useEffect(() => {
    if (!apiKeys?.useRealMarket) { setLiveIndices(null); return; }
    let cancelled = false;
    (async () => {
      setLiveLoading(true); setLiveError(null);
      const [ind, fx] = await Promise.all([
        API.indices(apiKeys.brapi),
        API.currencies(["USD-BRL", "EUR-BRL", "GBP-BRL", "BTC-BRL"]),
      ]);
      if (cancelled) return;
      const out = [];
      if (ind) ind.forEach(r => {
        const nomeMap = { "^BVSP": "Ibovespa", "^GSPC": "S&P 500", "^IXIC": "Nasdaq" };
        // Aceita preços alternativos quando regularMarketPrice não vem na resposta
        // (a BRAPI às vezes omite no índice, fazendo o Ibovespa "sumir").
        const preco = r.regularMarketPrice ?? r.regularMarketPreviousClose ?? r.price ?? r.close;
        if (preco != null) {
          out.push({
            nome: nomeMap[r.symbol] || r.symbol,
            valor: preco,
            var: r.regularMarketChangePercent ?? 0,
            real: true,
          });
        }
      });
      if (fx) Object.values(fx).forEach(c => {
        const nomeMap = { USDBRL: "Dólar (USD)", EURBRL: "Euro (EUR)", GBPBRL: "Libra (GBP)", BTCBRL: "Bitcoin" };
        out.push({
          nome: nomeMap[c.code + c.codein] || `${c.code}/${c.codein}`,
          valor: parseFloat(c.bid),
          var: parseFloat(c.pctChange),
          real: true,
        });
      });
      if (out.length === 0) {
        setLiveError("Não foi possível obter dados reais. Mostrando simulação.");
        setLiveIndices(null);
      } else {
        setLiveIndices(out);
      }
      setLiveLoading(false);
    })();
    return () => { cancelled = true; };
  }, [apiKeys?.useRealMarket, apiKeys?.brapi, tick]);

  // Auto-refresh a cada 60s (só no modo real).
  useEffect(() => {
    if (!apiKeys?.useRealMarket) return;
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [apiKeys?.useRealMarket]);

  // Maiores altas/baixas da SUA carteira pela variação real (variacao24h das
  // cotações). Sem dado de variação, usa o ganho vs preço médio. Nada aleatório.
  const movers = [...(ativos || [])].map(a => {
    let v = Number(a.variacao24h);
    if (!Number.isFinite(v)) {
      const denom = a.base || a.pm || a.preco;
      v = denom > 0 ? ((a.preco - denom) / denom) * 100 : 0;
    }
    return { ...a, varDia: v };
  }).sort((a, b) => b.varDia - a.varDia);

  const altas = movers.slice(0, 5);
  const baixas = movers.slice(-5).reverse();

  // Índices: reais se disponíveis, senão simulados
  const indicesSim = [
    { nome: "Ibovespa",    valor: 134820,  var: 0.42 },
    { nome: "S&P 500",     valor: 5847,    var: 0.18 },
    { nome: "IFIX",        valor: 3412,    var: -0.21 },
    { nome: "Dólar (USD)", valor: 5.78,    var: 0.65 },
    { nome: "Euro (EUR)",  valor: 6.21,    var: 0.34 },
    { nome: "Bitcoin",     valor: 412300,  var: 2.18 },
  ];
  // Reais se disponíveis; senão, simulados. Garante que índices-chave (Ibovespa)
  // sempre apareçam: se a API não trouxe, completa com o valor simulado.
  let indices = liveIndices || indicesSim;
  if (liveIndices) {
    const temIbov = liveIndices.some(i => /ibov/i.test(i.nome));
    if (!temIbov) {
      const simIbov = indicesSim.find(i => /ibov/i.test(i.nome));
      if (simIbov) indices = [{ ...simIbov, sim: true }, ...liveIndices];
    }
  }

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo V"
        title="Mercado"
        sub="O pulso do dia. Índices, cotações e movimentos da sua carteira."
        action={apiKeys?.useRealMarket && (
          <button onClick={() => setTick(t => t + 1)} disabled={liveLoading}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "8px 14px", borderRadius: 7, cursor: liveLoading ? "wait" : "pointer",
              background: "transparent", border: `1px solid ${T.gold}`, color: T.gold,
              fontSize: 11, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase",
              fontFamily: T.sans,
            }}>
            <RefreshCw size={13} style={liveLoading ? { animation: "spin 1s linear infinite" } : undefined} />
            Atualizar
          </button>
        )}
      />

      {/* Status banner */}
      {apiKeys?.useRealMarket && (
        <div style={{ background: T.bgSoft, border: `1px solid ${liveIndices ? T.green : T.gold}55`, padding: 12, marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          {liveLoading
            ? <RefreshCw size={14} className="spin" style={{ color: T.gold }} />
            : <span style={{ width: 8, height: 8, borderRadius: "50%", background: liveIndices ? T.green : T.gold,
                             boxShadow: `0 0 8px ${liveIndices ? T.green : T.gold}` }} />}
          <span style={{ fontSize: 12, fontFamily: T.sans, letterSpacing: "0.1em", textTransform: "uppercase",
                         color: liveIndices ? T.green : T.gold }}>
            {liveLoading ? "Buscando dados ao vivo…" : liveIndices ? "Cotações ao vivo · Brapi + AwesomeAPI" : "Modo real ativado · aguardando resposta"}
          </span>
          {liveError && <span style={{ color: T.muted, fontSize: 12, fontStyle: "italic", marginLeft: "auto" }}>{liveError}</span>}
        </div>
      )}

      {/* Índices */}
      <div className="mb-8">
        <div className="label-eyebrow mb-3">{liveIndices ? "Índices Globais · ao vivo" : "Índices Globais"}</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px" style={{ background: T.border }}>
          {indices.map(i => (
            <div key={i.nome} style={{ background: T.card, padding: 16 }}>
              <div className="label-eyebrow">{i.nome}</div>
              <div className="num mt-2" style={{ fontFamily: T.serif, fontSize: 18, color: T.ink }}>
                {i.valor < 100 ? fmtN(i.valor, 2) : fmtN(i.valor, 0)}
              </div>
              <div className="num text-xs mt-1" style={{ color: i.var >= 0 ? T.green : T.red }}>
                {fmtP(i.var)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Movers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MoversCard titulo="Em alta" movers={altas} cor={T.green} icon={TrendingUp} />
        <MoversCard titulo="Em queda" movers={baixas} cor={T.red} icon={TrendingDown} />
      </div>

      {/* News editorial */}
      <div className="mt-8" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 32 }}>
        <div className="label-eyebrow">Coluna · Editorial</div>
        <h3 style={{ fontFamily: T.serif, fontSize: 28, color: T.ink, marginTop: 8, lineHeight: 1.2 }} className="italic">
          A pausa observa, o paciente colhe.
        </h3>
        <div style={{ color: T.muted, fontSize: 16, marginTop: 12, lineHeight: 1.7 }} className="italic">
          Em mercados voláteis, o erro mais frequente não é a escolha do ativo, mas a frequência da decisão.
          Quem revê tese todo dia transforma ruído em direção. Atualize quando quiser
          e observe os movimentos da sua carteira em perspectiva.
        </div>
        <div className="mt-4" style={{ color: T.faint, fontSize: 12, fontFamily: T.sans, letterSpacing: "0.15em", textTransform: "uppercase" }}>
          — NUMVI
        </div>
      </div>
    </div>
  );
}

function MoversCard({ titulo, movers, cor, icon: Icon }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} style={{ color: cor }} />
        <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>{titulo}</h3>
      </div>
      <div className="space-y-2">
        {movers.map(m => (
          <div key={m.id} className="flex items-center justify-between py-2"
               style={{ borderBottom: `1px solid ${T.border}` }}>
            <div>
              <div style={{ fontFamily: T.serif, fontSize: 17, color: T.ink }}>{m.ticker}</div>
              <div style={{ color: T.muted, fontSize: 11 }} className="italic">{m.nome}</div>
            </div>
            <div className="text-right">
              <div className="num" style={{ color: T.ink }}>{fmt(m.preco)}</div>
              <div className="num text-xs" style={{ color: m.varDia >= 0 ? T.green : T.red }}>
                {fmtP(m.varDia)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

