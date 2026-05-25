import React, { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";

/**
 * Evolução do patrimônio — gráfico temporal a partir dos snapshots
 * diários (gravados em App.jsx). O usuário escolhe o período (30d, 90d,
 * 1a, tudo). Mostra delta absoluto e % no canto.
 *
 * Quando o histórico tem < 2 pontos, mostra mensagem amigável
 * ("Coletando dados — volte amanhã").
 */

const PERIODOS = [
  { id: "30d",  label: "30d",  dias: 30 },
  { id: "90d",  label: "90d",  dias: 90 },
  { id: "1a",   label: "1a",   dias: 365 },
  { id: "tudo", label: "Tudo", dias: null },
];

export default function EvolucaoPatrimonio({ historico = [], hidden }) {
  const [periodo, setPeriodo] = useState("90d");

  const dados = useMemo(() => {
    if (!historico || historico.length === 0) return { vazio: true, motivo: "sem-snapshots" };
    if (historico.length < 2) return { vazio: true, motivo: "1-snapshot" };

    const cfg = PERIODOS.find(p => p.id === periodo) || PERIODOS[1];
    let filtrado = [...historico].sort((a, b) => a.data.localeCompare(b.data));
    if (cfg.dias) {
      const corte = new Date();
      corte.setDate(corte.getDate() - cfg.dias);
      const corteISO = corte.toISOString().slice(0, 10);
      filtrado = filtrado.filter(p => p.data >= corteISO);
    }
    if (filtrado.length < 2) return { vazio: true, motivo: "periodo-curto" };

    const primeiro = filtrado[0];
    const ultimo = filtrado[filtrado.length - 1];
    const delta = ultimo.total - primeiro.total;
    const deltaPct = primeiro.total > 0 ? (delta / primeiro.total) * 100 : 0;

    // Para o eixo X, gera label curto (DD/MM)
    const pontos = filtrado.map(p => ({
      ...p,
      label: `${p.data.slice(8, 10)}/${p.data.slice(5, 7)}`,
    }));

    return { vazio: false, pontos, primeiro, ultimo, delta, deltaPct };
  }, [historico, periodo]);

  return (
    <div className="no-print" style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
      padding: 14, marginBottom: 18,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div className="label-eyebrow" style={{ marginBottom: 4 }}>Evolução do patrimônio</div>
          {!dados.vazio && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
              <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: T.ink, fontVariantNumeric: "tabular-nums" }}>
                {hidden ? "•••••" : fmt(dados.ultimo.total)}
              </div>
              <div style={{
                fontSize: 12, fontWeight: 600,
                color: dados.delta >= 0 ? T.green : T.red,
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>
                {dados.delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {dados.delta >= 0 ? "+" : "−"}{hidden ? "•••" : fmt(Math.abs(dados.delta))}
                <span style={{ opacity: 0.8 }}>({dados.deltaPct >= 0 ? "+" : ""}{dados.deltaPct.toFixed(2)}%)</span>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "inline-flex", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 5, padding: 2 }}>
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              style={{
                padding: "4px 10px", fontSize: 10, letterSpacing: ".05em", textTransform: "uppercase",
                fontWeight: 600, border: "none", borderRadius: 3, cursor: "pointer",
                background: periodo === p.id ? T.gold : "transparent",
                color: periodo === p.id ? T.bg : T.muted,
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {dados.vazio ? (
        <div style={{
          padding: "32px 16px", textAlign: "center", color: T.muted, fontStyle: "italic",
          fontSize: 12.5, lineHeight: 1.55,
        }}>
          <Activity size={22} style={{ color: T.muted, marginBottom: 8 }} />
          <div>
            {dados.motivo === "sem-snapshots" && "Ainda não há snapshots. O primeiro será gravado quando você tiver ativos com preço."}
            {dados.motivo === "1-snapshot" && "Primeiro snapshot gravado hoje. Volte amanhã pra ver a evolução."}
            {dados.motivo === "periodo-curto" && "Sem dados suficientes nesse período. Escolha um período maior ou aguarde mais snapshots."}
          </div>
        </div>
      ) : (
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <AreaChart data={dados.pontos} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPatr" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor={T.gold} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label"
                     tick={{ fill: T.muted, fontSize: 10 }}
                     stroke={T.border}
                     interval="preserveStartEnd"
                     minTickGap={30} />
              <YAxis tick={{ fill: T.muted, fontSize: 10 }}
                     stroke={T.border}
                     tickFormatter={v => hidden ? "•••" : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11, color: T.ink }}
                labelStyle={{ color: T.muted, marginBottom: 4 }}
                formatter={(v) => [hidden ? "•••••" : fmt(v), "Patrimônio"]}
              />
              <Area type="monotone" dataKey="total" stroke={T.gold} strokeWidth={2}
                    fill="url(#gradPatr)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
