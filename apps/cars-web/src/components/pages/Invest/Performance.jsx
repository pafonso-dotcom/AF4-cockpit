import React, { useMemo } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { sharpeRatio, sortinoRatio, beta, alpha, valueAtRisk, stressTest } from "../../../lib/invest-metrics.js";

export default function Performance({ ativos = [], hidden }) {
  const sharpe = useMemo(() => sharpeRatio(ativos), [ativos]);
  const sortino = useMemo(() => sortinoRatio(ativos), [ativos]);
  const betaVal = useMemo(() => beta(ativos), [ativos]);
  const alphaVal = useMemo(() => alpha(ativos), [ativos]);
  const varVal = useMemo(() => valueAtRisk(ativos), [ativos]);
  const stress = useMemo(() => stressTest(ativos), [ativos]);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Investimentos · Performance</div>
      <h1 className="h1">Performance <em>vs benchmarks.</em></h1>
      <p className="hs">Sua rentabilidade comparada com CDI, IBOV e inflação · stress test em cenários macro.</p>

      <div className="kg">
        <div className="k">
          <div className="kh"><div className="kl">Você (12m)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          </div>
          <div className={`kv ${alphaVal > 0 ? "" : ""}`} style={{ color: alphaVal > 0 ? T.green : T.ink }}>
            {alphaVal != null ? `${alphaVal > 0 ? "+" : ""}${(parseFloat(alphaVal) + 10).toFixed(1)}%` : "—"}
          </div>
          <div className="ku">Carteira total</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">CDI (12m)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h18"/></svg>
          </div>
          <div className="kv">+ 10,5%</div>
          <div className="ku">Benchmark RF</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">IBOV (12m)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 17 8 12 13 16 21 8"/></svg>
          </div>
          <div className="kv">+ 9,1%</div>
          <div className="ku">Bolsa BR</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">IPCA (12m)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20V4M5 11l7-7 7 7"/></svg>
          </div>
          <div className="kv">+ 4,2%</div>
          <div className="ku">Inflação</div>
        </div>
      </div>

      <div className="st"><h2>Stress Test</h2><div className="mt">Cenários macro</div></div>
      <div className="pn">
        {ativos.length === 0 ? (
          <div className="empty-state">
            <div className="ic">⚠️</div>
            Adicione ativos para simular cenários.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Cenário</th>
                <th>Probabilidade</th>
                <th style={{ textAlign: "right" }}>Impacto carteira</th>
                <th style={{ textAlign: "right" }}>Valor estimado</th>
              </tr>
            </thead>
            <tbody>
              {stress.map((c, i) => (
                <tr key={i}>
                  <td>{c.nome}</td>
                  <td>
                    <span className={`bg-c ${c.prob === "Moderada" ? "bgp" : c.prob === "Alta" ? "bgg" : "bgi"}`}>
                      {c.prob}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }} className={parseFloat(c.impactoPct) >= 0 ? "pos" : "neg"}>
                    {parseFloat(c.impactoPct) >= 0 ? "+ " : ""}{c.impactoPct}%
                  </td>
                  <td style={{ textAlign: "right" }} className="num">{hidden ? "•••" : fmt(c.valorEstimado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="st"><h2>Métricas de Risco Detalhadas</h2></div>
      <div className="pn" style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 18 }}>
          {[
            { label: "Sortino Ratio", value: sortino ?? "—", desc: "Foca em risco negativo" },
            { label: "Beta vs IBOV", value: betaVal ?? "—", desc: betaVal < 1 ? "Menos volátil que IBOV" : betaVal > 1 ? "Mais volátil que IBOV" : "Igual ao IBOV" },
            { label: "VaR 95% (1 mês)", value: varVal ? fmt(varVal) : "—", desc: "Perda máxima provável" },
            { label: "Alpha (vs CDI)", value: alphaVal != null ? `${alphaVal > 0 ? "+" : ""}${alphaVal}pp` : "—", desc: alphaVal > 0 ? "Retorno extra positivo" : "Abaixo do benchmark" },
          ].map(m => (
            <div key={m.label}>
              <div className="label-eyebrow" style={{ marginBottom: 6, fontSize: 9 }}>{m.label}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 300, color: T.ink }}>{m.value}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
