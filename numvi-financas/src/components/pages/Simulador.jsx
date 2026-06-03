import React, { useState, useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { parseValorBR } from "../../lib/importExport.js";
import PageHeader from "../ui/PageHeader.jsx";
import Field from "../ui/Field.jsx";
import Stat from "../ui/Stat.jsx";

export default function Simulador() {
  const [inicial, setInicial] = useState("10000");
  const [aporte, setAporte] = useState("1000");
  const [taxa, setTaxa] = useState("0,85"); // % ao mês
  const [meses, setMeses] = useState(120);

  // Parsers seguros (aceitam vírgula BR)
  const inicialN = parseValorBR(inicial) || 0;
  const aporteN = parseValorBR(aporte) || 0;
  const taxaN = parseValorBR(taxa) || 0;

  const dados = useMemo(() => {
    const out = [];
    let acumulado = inicialN;
    let aportado = inicialN;
    const r = taxaN / 100;
    for (let i = 0; i <= meses; i++) {
      out.push({
        mes: i,
        ano: Math.floor(i / 12),
        total: +acumulado.toFixed(2),
        aportado: +aportado.toFixed(2),
        juros: +(acumulado - aportado).toFixed(2),
      });
      acumulado = acumulado * (1 + r) + aporteN;
      aportado += aporteN;
    }
    return out;
  }, [inicialN, aporteN, taxaN, meses]);

  const final = dados[dados.length - 1];
  const taxaAA = ((1 + taxaN / 100) ** 12 - 1) * 100;

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VI"
        title="Simulador"
        sub="Juros compostos sob medida. Veja seu capital crescer mês a mês."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controles */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
          <div className="label-eyebrow mb-4">Parâmetros</div>
          <Field label="Investimento inicial (R$)" hint="Aceita 10000 · 10.000,00">
            <input type="text" inputMode="decimal" value={inicial} onChange={e => setInicial(e.target.value)} placeholder="10.000,00" />
          </Field>
          <Field label="Aporte mensal (R$)" hint="Aceita 1000 · 1.000,00">
            <input type="text" inputMode="decimal" value={aporte} onChange={e => setAporte(e.target.value)} placeholder="1.000,00" />
          </Field>
          <Field label={`Taxa de juros (% ao mês) · ${fmtN(taxaAA, 2)}% a.a.`}>
            <input type="text" inputMode="decimal" value={taxa} onChange={e => setTaxa(e.target.value)} placeholder="0,85" />
          </Field>
          <Field label={`Período · ${meses} meses (${(meses/12).toFixed(1)} anos)`}>
            <input type="range" min="6" max="360" value={meses} onChange={e => setMeses(parseInt(e.target.value))}
                   style={{ accentColor: T.gold }} />
          </Field>

          <div className="mt-6 pt-6 space-y-3" style={{ borderTop: `1px solid ${T.border}` }}>
            <Stat label="Aportado" value={fmt(final.aportado)} cor={T.muted} />
            <Stat label="Juros gerados" value={fmt(final.juros)} cor={T.gold} />
            <Stat label="Total acumulado" value={fmt(final.total)} cor={T.green} grande />
          </div>
        </div>

        {/* Gráfico */}
        <div className="lg:col-span-2" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
          <div className="label-eyebrow mb-4">Projeção</div>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={dados}>
              <defs>
                <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.gold} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.muted} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={T.muted} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="mes" stroke={T.muted} fontSize={11}
                     tickFormatter={m => m % 12 === 0 ? `${m/12}a` : ""}
                     tickLine={false} axisLine={false} />
              <YAxis stroke={T.muted} fontSize={11}
                     tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`}
                     tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12 }}
                       formatter={(v) => fmt(v)} labelFormatter={(m) => `Mês ${m} (${(m/12).toFixed(1)} anos)`}
                       labelStyle={{ color: T.gold }} />
              <Legend wrapperStyle={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }} />
              <Area type="monotone" dataKey="total" name="Total acumulado" stroke={T.gold} fill="url(#gT)" strokeWidth={2} />
              <Area type="monotone" dataKey="aportado" name="Aportado" stroke={T.muted} fill="url(#gA)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

