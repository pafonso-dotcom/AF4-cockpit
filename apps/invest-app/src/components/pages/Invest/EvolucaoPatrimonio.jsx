import React, { useMemo, useState } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";

/**
 * Evolução do patrimônio — a partir dos snapshots diários gravados no App.
 * Cada ponto = { data: "YYYY-MM-DD", total, investido }.
 * Mostra o gráfico (patrimônio × aportado) + a variação no período escolhido.
 * Com < 2 dias de histórico, mostra aviso ("coletando dados").
 */
const PERIODOS = [
  { id: "30d", label: "30 dias", dias: 30 },
  { id: "90d", label: "90 dias", dias: 90 },
  { id: "1a", label: "1 ano", dias: 365 },
  { id: "tudo", label: "Tudo", dias: null },
];

export default function EvolucaoPatrimonio({ historico = [], hidden }) {
  const [periodo, setPeriodo] = useState("90d");

  const calc = useMemo(() => {
    const hist = [...(historico || [])].filter(p => p && p.data).sort((a, b) => a.data.localeCompare(b.data));
    if (hist.length < 2) return { vazio: true, n: hist.length };
    const cfg = PERIODOS.find(p => p.id === periodo) || PERIODOS[1];
    let serie = hist;
    if (cfg.dias) {
      const corte = new Date(); corte.setDate(corte.getDate() - cfg.dias);
      const c = corte.toISOString().slice(0, 10);
      serie = hist.filter(p => p.data >= c);
    }
    if (serie.length < 2) serie = hist.slice(-2);
    const ini = serie[0], fim = serie[serie.length - 1];
    const delta = (fim.total || 0) - (ini.total || 0);
    const deltaPct = ini.total > 0 ? (delta / ini.total) * 100 : 0;
    const resultado = (fim.total || 0) - (fim.investido || 0);
    const resultadoPct = fim.investido > 0 ? (resultado / fim.investido) * 100 : 0;
    return { vazio: false, serie, delta, deltaPct, atual: fim.total || 0, investido: fim.investido || 0, resultado, resultadoPct };
  }, [historico, periodo]);

  const m = (v) => (hidden ? "•••" : fmt(v));
  const fmtDia = (iso) => { const [, mes, dia] = (iso || "").split("-"); return `${dia}/${mes}`; };

  return (
    <div className="fade-up py-8 px-6" style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>Evolução do patrimônio</h2>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4, flexWrap: "wrap" }}>
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              style={{
                padding: "5px 12px", borderRadius: 100, fontSize: 11.5, cursor: "pointer",
                border: `1px solid ${periodo === p.id ? T.gold : T.border}`,
                background: periodo === p.id ? `${T.gold}22` : "transparent",
                color: periodo === p.id ? T.gold : T.muted, fontWeight: periodo === p.id ? 600 : 400,
              }}>{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 12, color: T.muted, marginBottom: 16 }}>Seu patrimônio dia a dia (aportado × valor de mercado).</div>

      {calc.vazio ? (
        <div style={{
          padding: 40, textAlign: "center", color: T.muted, fontStyle: "italic",
          border: `1px dashed ${T.border}`, borderRadius: 12, background: T.card,
        }}>
          📈 Coletando dados… o gráfico aparece quando houver pelo menos <strong>2 dias</strong> de histórico.
          <div style={{ fontSize: 11.5, marginTop: 6 }}>
            O Aurum registra o seu patrimônio automaticamente todo dia que você abre o app. Volte amanhã pra ver a evolução começar. 🙂
          </div>
        </div>
      ) : (
        <>
          {/* KPIs de período */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
            <Kpi label="Patrimônio atual" valor={m(calc.atual)} cor={T.gold} />
            <Kpi label="Total aportado" valor={m(calc.investido)} cor={T.ink} />
            <Kpi label="Resultado" valor={`${calc.resultado >= 0 ? "+" : "−"} ${m(Math.abs(calc.resultado))}`}
                 sub={`${calc.resultadoPct >= 0 ? "+" : ""}${calc.resultadoPct.toFixed(2)}%`}
                 cor={calc.resultado >= 0 ? T.green : T.red} />
            <Kpi label={`Variação (${PERIODOS.find(p => p.id === periodo)?.label})`}
                 valor={`${calc.delta >= 0 ? "+" : "−"} ${m(Math.abs(calc.delta))}`}
                 sub={`${calc.deltaPct >= 0 ? "+" : ""}${calc.deltaPct.toFixed(2)}%`}
                 cor={calc.delta >= 0 ? T.green : T.red}
                 icon={calc.delta >= 0 ? TrendingUp : TrendingDown} />
          </div>

          {/* Gráfico */}
          <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={calc.serie} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradPatr" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.gold} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={T.border} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" tickFormatter={fmtDia} tick={{ fontSize: 10, fill: T.muted }} minTickGap={24} />
                <YAxis tickFormatter={(v) => hidden ? "•••" : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} tick={{ fontSize: 10, fill: T.muted }} width={44} />
                <Tooltip
                  formatter={(v, n) => [hidden ? "•••" : fmt(v), n === "total" ? "Patrimônio" : "Aportado"]}
                  labelFormatter={(l) => `Dia ${fmtDia(l)}`}
                  contentStyle={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="total" stroke={T.gold} strokeWidth={2} fill="url(#gradPatr)" name="total" />
                <Line type="monotone" dataKey="investido" stroke={T.muted} strokeWidth={1.5} strokeDasharray="4 3" dot={false} name="investido" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ marginTop: 8, fontSize: 10.5, color: T.faint, fontStyle: "italic" }}>
            Linha dourada = patrimônio (valor de mercado) · linha tracejada = total aportado.
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, valor, sub, cor, icon: Icon }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, marginBottom: 4, display: "flex", alignItems: "center", gap: 5 }}>
        {Icon && <Icon size={12} />}{label}
      </div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: cor }}>{valor}</div>
      {sub && <div className="num" style={{ fontSize: 11.5, color: cor, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
