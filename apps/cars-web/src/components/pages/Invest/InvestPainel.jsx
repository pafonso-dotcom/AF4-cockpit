import React, { useMemo } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import {
  sharpeRatio, sortinoRatio, maxDrawdown, volatilidade,
  valueAtRisk, beta, alpha, calendarioProventos,
} from "../../../lib/invest-metrics.js";

/**
 * Painel de Investimentos · estilo demo v3.
 * Mostra métricas profissionais: Sharpe, drawdown, VaR, beta, alpha.
 */
export default function InvestPainel({ ativos = [], transacoes = [], hidden }) {
  const totais = useMemo(() => {
    const valor = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
    const investido = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.precoMedio || a.preco || 0), 0);
    const variacao = investido > 0 ? ((valor - investido) / investido) * 100 : 0;
    return { valor, investido, variacao, ganho: valor - investido };
  }, [ativos]);

  // Alocação por classe
  const alocacao = useMemo(() => {
    if (totais.valor === 0) return [];
    const grupos = {};
    ativos.forEach(a => {
      const tipo = (a.tipo || "outro").toLowerCase();
      const valor = Number(a.qtd || 0) * Number(a.preco || 0);
      grupos[tipo] = (grupos[tipo] || 0) + valor;
    });
    const CORES = { acao: T.gold, fii: "#10b981", stock: "#3b82f6", reit: "#0ea5e9", cripto: "#8b5cf6", rf: "#06b6d4", etf: "#fbbf24", tesouro: "#22c55e", cdb: "#14b8a6", outro: T.muted };
    const NOMES = { acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", cripto: "Cripto", rf: "Renda Fixa", etf: "ETFs", tesouro: "Tesouro", cdb: "CDB", outro: "Outros" };
    return Object.entries(grupos)
      .map(([tipo, valor]) => ({
        tipo, nome: NOMES[tipo] || tipo, valor,
        pct: (valor / totais.valor) * 100,
        cor: CORES[tipo] || T.muted,
      }))
      .sort((a, b) => b.valor - a.valor);
  }, [ativos, totais.valor]);

  // Métricas
  const sharpe = useMemo(() => sharpeRatio(ativos), [ativos]);
  const sortino = useMemo(() => sortinoRatio(ativos), [ativos]);
  const dd = useMemo(() => maxDrawdown(ativos), [ativos]);
  const vol = useMemo(() => volatilidade(ativos), [ativos]);
  const varValue = useMemo(() => valueAtRisk(ativos), [ativos]);
  const betaVal = useMemo(() => beta(ativos), [ativos]);
  const alphaVal = useMemo(() => alpha(ativos), [ativos]);
  const proventos = useMemo(() => calendarioProventos(ativos), [ativos]);
  const proventosMes = proventos.filter(p => {
    const d = new Date(p.data);
    const hoje = new Date();
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  });

  // SVG donut
  const circ = 2 * Math.PI * 40;
  let offsetAcc = 0;

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Investimentos · Painel</div>
      <h1 className="h1">Sua carteira, <em>com métricas pro.</em></h1>
      <p className="hs">Sharpe, drawdown, volatilidade · benchmarks contra CDI/IBOV · proventos a receber.</p>

      <div className="hm">
        <div className="hc">
          <div className="hl">Patrimônio investido</div>
          <div className="hv"><span className="cy">R$</span>{hidden ? "•••" : fmt(totais.valor).replace("R$", "").trim()}</div>
          <div className={`dl ${totais.variacao < 0 ? "neg" : ""}`}>
            {totais.variacao >= 0 ? "+" : ""}{totais.variacao.toFixed(2)}% no período
          </div>
        </div>
        <div className="hc">
          <div className="hl">Ganho total</div>
          <div className="hv"><span className="cy">R$</span>{hidden ? "•••" : fmt(totais.ganho).replace("R$", "").trim()}</div>
          <div className={`dl ${totais.ganho < 0 ? "neg" : ""}`}>vs custo: {hidden ? "•••" : fmt(totais.investido)}</div>
        </div>
        <div className="hc">
          <div className="hl">Proventos (mês)</div>
          <div className="hv"><span className="cy">R$</span>{hidden ? "•••" : fmt(proventosMes.reduce((s, p) => s + p.total, 0)).replace("R$", "").trim()}</div>
          <div className="dl">{proventosMes.length} pagamento(s)</div>
        </div>
      </div>

      <div className="st"><h2>Métricas Profissionais</h2><div className="mt">Últimos 12 meses</div></div>
      <div className="kg">
        <div className="k">
          <div className="kh">
            <div className="kl">Sharpe Ratio</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          </div>
          <div className="kv">{sharpe ?? "—"}</div>
          <div className={`ku ${sharpe > 1 ? "pos" : sharpe < 0 ? "neg" : ""}`}>
            {sharpe == null ? "Sem dados" : sharpe > 1 ? "Excelente (>1)" : sharpe > 0 ? "Aceitável" : "Negativo"}
          </div>
        </div>
        <div className="k">
          <div className="kh">
            <div className="kl">Volatilidade</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/></svg>
          </div>
          <div className="kv">{vol ?? "—"}{vol ? "%" : ""}</div>
          <div className="ku">{vol < 10 ? "Baixa" : vol < 20 ? "Moderada" : "Alta"}</div>
        </div>
        <div className="k">
          <div className="kh">
            <div className="kl">Drawdown máx</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 7 8 12 13 8 21 17"/></svg>
          </div>
          <div className="kv">{dd ?? "—"}{dd ? "%" : ""}</div>
          <div className="ku">Maior queda</div>
        </div>
        <div className="k">
          <div className="kh">
            <div className="kl">vs CDI (alpha)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h18"/></svg>
          </div>
          <div className="kv">{alphaVal ? `${alphaVal > 0 ? "+" : ""}${alphaVal}pp` : "—"}</div>
          <div className={`ku ${alphaVal > 0 ? "pos" : alphaVal < 0 ? "neg" : ""}`}>
            {alphaVal > 0 ? "Bate o CDI" : alphaVal < 0 ? "Abaixo do CDI" : "Em linha"}
          </div>
        </div>
      </div>

      <div className="ar">
        <div className="ai">📊</div>
        <div className="at">
          <strong>Análise resumida</strong>
          <p>
            Beta {betaVal ?? "—"} · Sortino {sortino ?? "—"} · VaR 95%: {varValue ? fmt(varValue) : "—"} (perda máxima provável em 1 mês).
            {sharpe > 1 && " Carteira com retorno superior ao risco assumido."}
          </p>
        </div>
      </div>

      {/* Alocação donut */}
      <div className="st"><h2>Alocação Atual</h2></div>
      <div className="pn" style={{ padding: 24 }}>
        {alocacao.length === 0 ? (
          <div className="empty-state">
            <div className="ic">📈</div>
            Nenhum ativo cadastrado ainda.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
              <svg viewBox="0 0 100 100" width="160" height="160" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="50" cy="50" r="40" stroke={T.border} strokeWidth="14" fill="none" />
                {alocacao.map((a, i) => {
                  const dashLen = (a.pct / 100) * circ;
                  const el = (
                    <circle key={i}
                            cx="50" cy="50" r="40"
                            stroke={a.cor} strokeWidth="14" fill="none"
                            strokeDasharray={`${dashLen} ${circ}`}
                            strokeDashoffset={-offsetAcc} />
                  );
                  offsetAcc += dashLen;
                  return el;
                })}
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
                <div>
                  <div className="num" style={{ fontSize: 18, fontWeight: 300, color: T.ink }}>
                    {hidden ? "•••" : fmt(totais.valor).replace("R$", "").trim()}
                  </div>
                  <div className="label-eyebrow" style={{ marginTop: 2, fontSize: 9 }}>Total</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 220 }}>
              {alocacao.map(a => (
                <div key={a.tipo} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 0", borderBottom: `1px solid ${T.border}`,
                  fontSize: 12,
                }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: a.cor, flexShrink: 0 }} />
                  <div style={{ flex: 1, color: T.ink }}>{a.nome}</div>
                  <div className="num" style={{ color: T.muted }}>
                    {a.pct.toFixed(0)}% · {hidden ? "•••" : fmt(a.valor)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
