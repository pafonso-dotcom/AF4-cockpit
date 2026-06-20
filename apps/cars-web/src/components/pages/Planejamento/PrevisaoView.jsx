import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, ReferenceLine } from "recharts";
import { T } from "../../../lib/theme.js";
import { KpiInline as Kpi } from "../../ui/KpiCard.jsx";
import { fmt } from "../../../lib/format.js";
import { getProjecaoSaldo } from "../../../lib/agregador.js";

/**
 * Previsão de saldo — projeta o saldo somado das contas nos próximos meses,
 * considerando ganhos previstos e despesas pendentes (fixas/parcelas/dívidas/
 * variáveis). Ajuda a ver se o dinheiro vai faltar antes que aconteça.
 */
export default function PrevisaoView(props) {
  const { contas = [], transacoes = [], categorias = [], devedores = [], dividas = [],
          fixas = [], fixaOcorrencias = [], parcelamentos = [], escopoAtivo, hidden } = props;
  const [horizonte, setHorizonte] = useState(6); // 3 | 6 | 12

  const proj = useMemo(() => {
    const state = { contas, transacoes, categorias, devedores, dividas, fixas, fixaOcorrencias, parcelamentos };
    return getProjecaoSaldo(state, escopoAtivo, horizonte);
  }, [contas, transacoes, categorias, devedores, dividas, fixas, fixaOcorrencias, parcelamentos, escopoAtivo, horizonte]);

  // Dados do gráfico: começa no saldo de hoje.
  const chartData = useMemo(() => {
    const arr = [{ label: "hoje", saldo: proj.saldoInicial }];
    proj.meses.forEach(m => arr.push({ label: m.label, saldo: m.saldoFim }));
    return arr;
  }, [proj]);

  const menorSaldo = useMemo(() => {
    const m = proj.meses.reduce((min, x) => (x.saldoFim < min.saldoFim ? x : min), { saldoFim: Infinity });
    return Number.isFinite(m.saldoFim) ? m : null;
  }, [proj]);
  const saldoFinal = proj.meses.length ? proj.meses[proj.meses.length - 1].saldoFim : proj.saldoInicial;
  const variacao = saldoFinal - proj.saldoInicial;
  const ficaNegativo = menorSaldo && menorSaldo.saldoFim < 0;

  return (
    <div className="fade-up">
      <div style={{ marginBottom: 16 }}>
        <div className="label-eyebrow">Finanças · Planejamento</div>
        <h1 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 300, letterSpacing: "-.02em", marginTop: 4 }}>
          Previsão de <em style={{ color: T.gold, fontStyle: "italic" }}>saldo.</em>
        </h1>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
          Projeção do saldo somado das contas, com ganhos previstos e contas a pagar pendentes.
        </p>
      </div>

      {/* Seletor de horizonte */}
      <div style={{ display: "inline-flex", gap: 0, marginBottom: 16, background: T.bgSoft, padding: 3, borderRadius: 14, border: `1px solid ${T.border}` }}>
        {[3, 6, 12].map(h => {
          const ativo = horizonte === h;
          return (
            <button key={h} onClick={() => setHorizonte(h)}
              style={{
                padding: "6px 16px", fontSize: 11.5, fontWeight: ativo ? 700 : 500,
                background: ativo ? T.card : "transparent",
                color: ativo ? T.gold : T.muted,
                border: ativo ? `1px solid ${T.gold}55` : "1px solid transparent",
                borderRadius: 11, cursor: "pointer",
              }}>
              {h} meses
            </button>
          );
        })}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px mb-4" style={{ background: T.border }}>
        <Kpi label="Saldo hoje" valor={hidden ? "•••••" : fmt(proj.saldoInicial)} cor={T.ink} icon={Wallet} />
        <Kpi label={`Saldo em ${horizonte} meses`} valor={hidden ? "•••••" : fmt(saldoFinal)}
             sub={`${variacao >= 0 ? "+" : ""}${hidden ? "•••" : fmt(variacao)} no período`}
             cor={saldoFinal >= 0 ? T.green : T.red} icon={variacao >= 0 ? TrendingUp : TrendingDown} />
        <Kpi label="Menor saldo previsto"
             valor={hidden ? "•••••" : (menorSaldo ? fmt(menorSaldo.saldoFim) : "—")}
             sub={menorSaldo ? `em ${menorSaldo.label}` : ""}
             cor={ficaNegativo ? T.red : T.gold} icon={TrendingDown} />
      </div>

      {/* Aviso se ficar negativo */}
      {ficaNegativo && (
        <div style={{
          padding: "10px 14px", marginBottom: 14, borderRadius: 14,
          background: `${T.red}11`, border: `1px solid ${T.red}55`,
          fontSize: 12.5, color: T.ink,
        }}>
          ⚠ <strong style={{ color: T.red }}>Atenção:</strong> no ritmo atual, o saldo das contas fica
          negativo em <strong>{menorSaldo.label}</strong> ({fmt(menorSaldo.saldoFim)}). Considere antecipar
          recebimentos ou adiar despesas.
        </div>
      )}

      {/* Gráfico de linha */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>Evolução do saldo</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 6, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: T.muted, fontSize: 10 }} stroke={T.border} />
              <YAxis tick={{ fill: T.muted, fontSize: 10 }} stroke={T.border}
                     tickFormatter={v => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11, color: T.ink }}
                formatter={(v) => [fmt(v), "Saldo"]} />
              <ReferenceLine y={0} stroke={T.red} strokeDasharray="3 3" />
              <Line type="monotone" dataKey="saldo" stroke={T.gold} strokeWidth={2}
                    dot={{ r: 3, fill: T.gold }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tabela mês a mês */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 8,
                      padding: "9px 14px", background: T.bgSoft, borderBottom: `1px solid ${T.border}`,
                      fontSize: 9.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>
          <span>Mês</span>
          <span style={{ textAlign: "right" }}>Entradas</span>
          <span style={{ textAlign: "right" }}>Saídas</span>
          <span style={{ textAlign: "right" }}>Líquido</span>
          <span style={{ textAlign: "right" }}>Saldo fim</span>
        </div>
        {proj.meses.map((m, i) => (
          <div key={m.mesISO} style={{
            display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: 8, alignItems: "center",
            padding: "9px 14px", borderTop: i === 0 ? "none" : `1px solid ${T.border}`,
            background: m.saldoFim < 0 ? `${T.red}0c` : "transparent",
          }}>
            <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, textTransform: "capitalize" }}>{m.label}</span>
            <span className="num" style={{ fontSize: 12, color: T.green, textAlign: "right" }}>{hidden ? "•••" : `+${fmt(m.entradas)}`}</span>
            <span className="num" style={{ fontSize: 12, color: T.red, textAlign: "right" }}>{hidden ? "•••" : `−${fmt(m.saidas)}`}</span>
            <span className="num" style={{ fontSize: 12, fontWeight: 600, color: m.liquido >= 0 ? T.green : T.red, textAlign: "right" }}>
              {hidden ? "•••" : `${m.liquido >= 0 ? "+" : "−"}${fmt(Math.abs(m.liquido))}`}
            </span>
            <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: m.saldoFim < 0 ? T.red : T.ink, textAlign: "right" }}>
              {hidden ? "•••" : fmt(m.saldoFim)}
            </span>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: T.faint, marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
        A previsão usa as contas a pagar pendentes (fixas, parcelas, dívidas) e os recebimentos previstos
        (devedores). O que já foi pago/recebido já está no saldo de hoje, então não é contado de novo.
      </div>
    </div>
  );
}
