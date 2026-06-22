import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { T } from "../../lib/theme.js";
import { API } from "../../lib/api.js";

/**
 * Faixa de índices globais ao vivo (Ibovespa, S&P 500, Nasdaq, Dólar, Euro).
 * Usa o proxy /api/brapi (índices) + AwesomeAPI (câmbio). Cai pra valores
 * simulados/indisponíveis sem quebrar. Atualiza ao montar.
 */
const NOME_INDICE = {
  "^BVSP": "Ibovespa", "BVSP": "Ibovespa",
  "^GSPC": "S&P 500", "GSPC": "S&P 500",
  "^IXIC": "Nasdaq", "IXIC": "Nasdaq",
};
const NOME_FX = { USDBRL: "Dólar", EURBRL: "Euro" };

// Valor de referência do Ibovespa pra ele NUNCA sumir do painel quando a BRAPI
// não devolve o índice (mercado fechado / resposta sem preço / sem token).
const IBOV_REF = { nome: "Ibovespa", valor: 134820, var: 0, moeda: "pts", sim: true };

// Minigráfico de tendência (sparkline) a partir de uma série de números.
function Sparkline({ data, cor, w = 56, h = 22 }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, idx) => {
    const x = (idx / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function IndicesGlobais({ apiKeys = {}, excluir = [] }) {
  const [itens, setItens] = useState(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const out = [];
      try {
        const [ind, fx] = await Promise.all([
          API.indices(apiKeys.brapi),
          API.currencies(["USD-BRL", "EUR-BRL"]),
        ]);
        if (ind) ind.forEach(r => {
          const preco = r.regularMarketPrice ?? r.regularMarketPreviousClose ?? r.price ?? r.close;
          if (preco != null && NOME_INDICE[r.symbol]) {
            out.push({ nome: NOME_INDICE[r.symbol], valor: preco, var: r.regularMarketChangePercent ?? 0, moeda: "pts" });
          }
        });
        if (fx) Object.values(fx).forEach(c => {
          const k = (c.code || "") + (c.codein || "");
          if (NOME_FX[k]) out.push({ nome: NOME_FX[k], valor: parseFloat(c.bid), var: parseFloat(c.pctChange), moeda: "R$" });
        });
      } catch { /* silencioso */ }
      // Ibovespa SEMPRE presente (e no topo): se não veio ao vivo, usa referência.
      if (!out.some(i => /ibov/i.test(i.nome))) out.unshift({ ...IBOV_REF });
      // Taxa Selic (meta % a.a.) — BCB SGS série 432, sem token. Fica logo após o Ibovespa.
      try {
        const r = await fetch("https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json");
        if (r.ok) {
          const j = await r.json();
          const v = parseFloat(String(j?.[0]?.valor ?? "").replace(",", "."));
          if (Number.isFinite(v)) out.splice(1, 0, { nome: "Selic", valor: v, moeda: "taxa" });
        }
      } catch { /* silencioso */ }
      // Sparkline com DADO REAL só para câmbio: a AwesomeAPI tem série diária
      // sem token. Índices (Ibov/S&P/Nasdaq) não têm fonte fácil de série aqui,
      // então ficam sem minigráfico (sem inventar dados).
      try {
        const spark = async (pair) => {
          const r = await fetch(`https://economia.awesomeapi.com.br/json/daily/${pair}/14`);
          if (!r.ok) return null;
          const j = await r.json();
          const vals = (Array.isArray(j) ? j : []).map(d => parseFloat(d.bid)).filter(Number.isFinite).reverse();
          return vals.length >= 2 ? vals : null;
        };
        const [sUSD, sEUR] = await Promise.all([spark("USD-BRL"), spark("EUR-BRL")]);
        out.forEach(i => {
          if (i.nome === "Dólar" && sUSD) i.spark = sUSD;
          if (i.nome === "Euro" && sEUR) i.spark = sEUR;
        });
      } catch { /* silencioso */ }
      if (!cancel) setItens(out);
    })();
    return () => { cancel = true; };
  }, [apiKeys.brapi]);

  // Nada carregado ainda → não ocupa espaço; sem dados → esconde.
  if (itens === null) return null;
  const visiveis = itens.filter(i => !excluir.includes(i.nome));
  if (visiveis.length === 0) return null;

  const fmtVal = (i) => i.moeda === "taxa"
    ? `${i.valor.toFixed(2).replace(".", ",")}%`
    : i.moeda === "R$"
    ? `R$ ${i.valor.toFixed(2)}`
    : i.valor.toLocaleString("pt-BR", { maximumFractionDigits: 0 });

  return (
    <div style={{
      display: "flex", gap: 8, overflowX: "auto", padding: "2px 0 8px",
      WebkitOverflowScrolling: "touch",
    }}>
      {visiveis.map((i, idx) => {
        const up = (i.var ?? 0) >= 0;
        const cor = up ? T.green : T.red;
        return (
          <div key={idx} style={{
            flex: "0 0 auto", minWidth: 132, background: T.card,
            border: `1px solid ${T.border}`, borderRadius: 16, padding: "8px 12px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, marginBottom: 2 }}>
                {i.nome}
              </div>
              <div className="num" style={{ fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>
                {fmtVal(i)}
              </div>
              {i.moeda === "taxa" ? (
                <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginTop: 2 }}>meta · ao ano</div>
              ) : (
                <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: cor, marginTop: 2 }}>
                  {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {up ? "+" : ""}{(i.var ?? 0).toFixed(2)}%
                </div>
              )}
            </div>
            {i.spark && <Sparkline data={i.spark} cor={cor} />}
          </div>
        );
      })}
    </div>
  );
}
