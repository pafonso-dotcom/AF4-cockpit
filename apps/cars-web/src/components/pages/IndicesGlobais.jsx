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
      if (!cancel) setItens(out);
    })();
    return () => { cancel = true; };
  }, [apiKeys.brapi]);

  // Nada carregado ainda → não ocupa espaço; sem dados → esconde.
  if (itens === null) return null;
  const visiveis = itens.filter(i => !excluir.includes(i.nome));
  if (visiveis.length === 0) return null;

  const fmtVal = (i) => i.moeda === "R$"
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
            border: `1px solid ${T.border}`, borderRadius: 10, padding: "8px 12px",
          }}>
            <div style={{ fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, marginBottom: 2 }}>
              {i.nome}
            </div>
            <div className="num" style={{ fontSize: 15, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>
              {fmtVal(i)}
            </div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: cor, marginTop: 2 }}>
              {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {up ? "+" : ""}{(i.var ?? 0).toFixed(2)}%
            </div>
          </div>
        );
      })}
    </div>
  );
}
