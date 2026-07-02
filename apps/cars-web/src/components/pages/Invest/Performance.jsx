import React, { useMemo, useState, useEffect } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { sharpeRatio, sortinoRatio, beta, valueAtRisk, stressTest } from "../../../lib/invest-metrics.js";
import { buscarBenchmarks12m } from "../../../lib/bcb.js";

export default function Performance({ ativos = [], hidden }) {
  const sharpe = useMemo(() => sharpeRatio(ativos), [ativos]);
  const sortino = useMemo(() => sortinoRatio(ativos), [ativos]);
  const betaVal = useMemo(() => beta(ativos), [ativos]);
  const varVal = useMemo(() => valueAtRisk(ativos), [ativos]);
  const stress = useMemo(() => stressTest(ativos), [ativos]);

  // Retorno REAL da carteira sobre o custo (desde a compra, não anualizado):
  // (valor de mercado − investido) / investido.
  const carteiraPct = useMemo(() => {
    let custo = 0, valor = 0;
    (ativos || []).forEach((a) => {
      const qtd = Number(a.qtd) || 0;
      custo += qtd * (Number(a.pm ?? a.precoMedio) || 0);
      valor += qtd * (Number(a.preco) || 0);
    });
    return custo > 0 ? ((valor - custo) / custo) * 100 : null;
  }, [ativos]);

  // Benchmarks REAIS (Banco Central · API SGS): CDI, IPCA e IBOV 12 meses.
  const [bm, setBm] = useState(null);
  const [bmErro, setBmErro] = useState(false);
  useEffect(() => {
    let vivo = true;
    buscarBenchmarks12m()
      .then((r) => { if (vivo) setBm(r); })
      .catch(() => { if (vivo) setBmErro(true); });
    return () => { vivo = false; };
  }, []);

  const fmtBm = (v) => (v == null ? (bmErro ? "—" : "…") : `${v >= 0 ? "+ " : "− "}${Math.abs(v).toFixed(1)}%`);
  const alphaPP = carteiraPct != null && bm?.cdi12m != null ? carteiraPct - bm.cdi12m : null;

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Investimentos · Performance</div>
      <h1 className="h1">Performance <em>vs benchmarks.</em></h1>
      <p className="hs">Sua rentabilidade comparada com CDI, IBOV e inflação reais (fonte: Banco Central) · stress test em cenários macro.</p>

      <div className="kg">
        <div className="k">
          <div className="kh"><div className="kl">Carteira · sobre o custo</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 17 9 11 13 15 21 7"/></svg>
          </div>
          <div className="kv" style={{ color: carteiraPct != null && carteiraPct >= 0 ? T.green : T.ink }}>
            {carteiraPct != null ? `${carteiraPct >= 0 ? "+ " : "− "}${Math.abs(carteiraPct).toFixed(1)}%` : "—"}
          </div>
          <div className="ku">Desde a compra (não anualizado)</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">CDI (12m)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12h18"/></svg>
          </div>
          <div className="kv">{fmtBm(bm?.cdi12m)}</div>
          <div className="ku">Banco Central · SGS</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">IBOV (12m)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="3 17 8 12 13 16 21 8"/></svg>
          </div>
          <div className="kv">{fmtBm(bm?.ibov12m)}</div>
          <div className="ku">Banco Central · SGS</div>
        </div>
        <div className="k">
          <div className="kh"><div className="kl">IPCA (12m)</div>
            <svg className="ki" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 20V4M5 11l7-7 7 7"/></svg>
          </div>
          <div className="kv">{fmtBm(bm?.ipca12m)}</div>
          <div className="ku">Inflação oficial · SGS</div>
        </div>
      </div>

      <div className="st"><h2>Stress Test</h2><div className="mt">Cenários hipotéticos (impacto típico por classe)</div></div>
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

      <div className="st"><h2>Métricas de Risco</h2><div className="mt">Estimativas ilustrativas — sem histórico real de preços</div></div>
      <div className="pn" style={{ padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 18 }}>
          {[
            { label: "Sharpe Ratio*", value: sharpe ?? "—", desc: "Retorno por unidade de risco" },
            { label: "Sortino Ratio*", value: sortino ?? "—", desc: "Foca em risco negativo" },
            { label: "Beta vs IBOV*", value: betaVal ?? "—", desc: betaVal < 1 ? "Menos volátil que IBOV" : betaVal > 1 ? "Mais volátil que IBOV" : "Igual ao IBOV" },
            { label: "VaR 95% (1 mês)*", value: varVal ? (hidden ? "•••" : fmt(varVal)) : "—", desc: "Perda máxima provável" },
            { label: "Vs CDI 12m", value: alphaPP != null ? `${alphaPP >= 0 ? "+" : "−"}${Math.abs(alphaPP).toFixed(1)}pp` : "—", desc: "Carteira (sobre o custo) − CDI real" },
          ].map(m => (
            <div key={m.label}>
              <div className="label-eyebrow" style={{ marginBottom: 6, fontSize: 9 }}>{m.label}</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 300, color: T.ink }}>{m.value}</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{m.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: T.faint, marginTop: 14 }}>
          * Estimado por simulação determinística sobre o retorno atual da carteira e betas típicos por classe — o app não guarda o histórico diário de preços necessário pro cálculo exato.
        </div>
      </div>
    </div>
  );
}
