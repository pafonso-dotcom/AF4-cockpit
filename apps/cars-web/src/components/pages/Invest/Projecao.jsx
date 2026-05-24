import React, { useMemo, useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, Target, DollarSign, Calculator } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN } from "../../../lib/format.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";

const CLASS_LABEL = {
  acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs",
  cripto: "Cripto", rf: "Renda Fixa", tesouro: "Tesouro", cdb: "CDB", outro: "Outros",
};

// Taxa mensal sugerida por classe (heurística — usuário pode ajustar)
const TAXA_SUGERIDA = {
  acao: 0.95, fii: 0.85, stock: 0.85, reit: 0.80, etf: 0.85,
  cripto: 1.50, rf: 0.80, tesouro: 0.75, cdb: 0.85, outro: 0.85,
};

export default function Projecao({ ativos = [], hidden }) {
  // Carteira com posição (qtd > 0)
  const ativosComPosicao = useMemo(
    () => (ativos || []).filter(a => Number(a.qtd || 0) > 0),
    [ativos]
  );

  const [ativoId, setAtivoId] = useState(ativosComPosicao[0]?.id || "");
  const ativo = useMemo(
    () => ativosComPosicao.find(a => a.id === ativoId) || ativosComPosicao[0],
    [ativosComPosicao, ativoId]
  );

  const [aporteMensal, setAporteMensal] = useState("500");
  const [prazoAnos, setPrazoAnos] = useState(10);
  const [taxaMensal, setTaxaMensal] = useState("0.85");

  // Atualiza valores sugeridos quando troca o ativo
  useEffect(() => {
    if (!ativo) return;
    const sugerida = TAXA_SUGERIDA[ativo.tipo] ?? 0.85;
    setTaxaMensal(String(sugerida));
  }, [ativo?.id]);

  // Valores numéricos parseados
  const aporte = parseFloat(String(aporteMensal).replace(",", ".")) || 0;
  const taxa = parseFloat(String(taxaMensal).replace(",", ".")) || 0;
  const meses = prazoAnos * 12;

  // Valor inicial = posição atual do ativo
  const valorInicial = useMemo(() => {
    if (!ativo) return 0;
    return Number(ativo.qtd || 0) * Number(ativo.preco || 0);
  }, [ativo]);

  const custoAtual = useMemo(() => {
    if (!ativo) return 0;
    return Number(ativo.qtd || 0) * Number(ativo.pm ?? ativo.precoMedio ?? 0);
  }, [ativo]);

  // Projeção mês a mês
  const projecao = useMemo(() => {
    const out = [];
    const r = taxa / 100;
    let acumulado = valorInicial;
    let aportadoTotal = valorInicial;
    // Mês 0
    out.push({
      mes: 0, ano: 0,
      acumulado: round(acumulado),
      aportado: round(aportadoTotal),
      ganhos: 0,
    });
    for (let i = 1; i <= meses; i++) {
      acumulado = acumulado * (1 + r) + aporte;
      aportadoTotal += aporte;
      out.push({
        mes: i,
        ano: Math.floor(i / 12),
        acumulado: round(acumulado),
        aportado: round(aportadoTotal),
        ganhos: round(acumulado - aportadoTotal),
      });
    }
    return out;
  }, [valorInicial, aporte, taxa, meses]);

  const final = projecao[projecao.length - 1];
  const valorFinal = final?.acumulado || 0;
  const totalAportado = final?.aportado || 0;
  const totalGanhos = final?.ganhos || 0;

  // Cenário sem aporte (comparativo)
  const cenarioSemAporte = useMemo(() => {
    const r = taxa / 100;
    return valorInicial * Math.pow(1 + r, meses);
  }, [valorInicial, taxa, meses]);

  // Marcos: anos
  const marcos = useMemo(() => {
    const anos = [];
    for (let y = 1; y <= prazoAnos; y++) {
      if (prazoAnos > 5 && y % 5 !== 0 && y !== prazoAnos) continue;
      const p = projecao[y * 12];
      if (p) anos.push({ ano: y, acumulado: p.acumulado, aportado: p.aportado, ganhos: p.ganhos });
    }
    return anos;
  }, [projecao, prazoAnos]);

  if (ativosComPosicao.length === 0) {
    return (
      <div className="fade-up py-8">
        <PageHeader
          eyebrow="Capítulo VIII"
          title="Projeção"
          sub="Simule a evolução de um ativo da sua carteira com aporte regular."
        />
        <div style={{
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
          padding: 40, textAlign: "center", color: T.muted,
        }}>
          <Calculator size={32} style={{ color: T.faint, marginBottom: 12 }} />
          <div style={{ fontSize: 14, color: T.ink, fontWeight: 500, marginBottom: 4 }}>
            Sem ativos em carteira
          </div>
          <div style={{ fontSize: 12 }}>
            Cadastre um ativo na Carteira pra simular a projeção dele aqui.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VIII"
        title="Projeção"
        sub="Simule a evolução de um ativo da sua carteira com aporte regular."
      />

      {/* Form */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Ativo da carteira">
            <select value={ativo?.id || ""} onChange={e => setAtivoId(e.target.value)}>
              {ativosComPosicao.map(a => {
                const v = Number(a.qtd || 0) * Number(a.preco || 0);
                return (
                  <option key={a.id} value={a.id}>
                    {a.ticker} · {CLASS_LABEL[a.tipo] || a.tipo} · {hidden ? "•••" : fmt(v)}
                  </option>
                );
              })}
            </select>
          </Field>
          <Field label="Aporte mensal (R$)">
            <input type="text" inputMode="decimal"
                   value={aporteMensal}
                   onChange={e => setAporteMensal(e.target.value)}
                   placeholder="Ex.: 500" />
          </Field>
          <Field label="Prazo (anos)">
            <input type="number" min="1" max="40" value={prazoAnos}
                   onChange={e => setPrazoAnos(Math.max(1, Math.min(40, parseInt(e.target.value, 10) || 1)))} />
          </Field>
          <Field label={`Taxa esperada (% ao mês) — ${TAXA_SUGERIDA[ativo?.tipo] ?? 0.85}% sugerido pra ${CLASS_LABEL[ativo?.tipo] || ativo?.tipo}`}>
            <input type="text" inputMode="decimal"
                   value={taxaMensal}
                   onChange={e => setTaxaMensal(e.target.value)}
                   placeholder="0.85" />
          </Field>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3" style={{ marginBottom: 18 }}>
        <KpiCard
          label="Valor atual"
          value={hidden ? "•••" : fmt(valorInicial)}
          sub={ativo ? `${ativo.qtd} cotas × ${fmt(Number(ativo.preco || 0))}` : ""}
          icon={DollarSign}
          cor={T.gold}
        />
        <KpiCard
          label="Total a aportar"
          value={hidden ? "•••" : fmt(totalAportado - valorInicial)}
          sub={`${aporte > 0 ? fmt(aporte) + "/mês" : "—"} · ${meses} meses`}
          icon={Target}
          cor={T.blue || "#5b9bd5"}
        />
        <KpiCard
          label="Valor projetado"
          value={hidden ? "•••" : fmt(valorFinal)}
          sub={`em ${prazoAnos} ${prazoAnos === 1 ? "ano" : "anos"}`}
          icon={TrendingUp}
          cor={T.green}
        />
        <KpiCard
          label="Ganhos projetados"
          value={hidden ? "•••" : fmt(totalGanhos)}
          sub={`${fmtN(totalAportado > 0 ? (totalGanhos / totalAportado) * 100 : 0, 1)}% sobre aportado`}
          icon={Calculator}
          cor={T.green}
        />
      </div>

      {/* Gráfico */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.ink, marginBottom: 4 }}>
          Evolução em {prazoAnos} {prazoAnos === 1 ? "ano" : "anos"}
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 14 }}>
          Aporte de {fmt(aporte)}/mês a {fmtN(taxa, 2)}% a.m. compostos
        </div>
        <div style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projecao}>
              <defs>
                <linearGradient id="grad-acumulado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.green} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="grad-aportado" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.gold} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.border} strokeDasharray="3 3" />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 10, fill: T.muted }}
                tickFormatter={(m) => m % 12 === 0 ? `${m / 12}a` : ""}
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 10, fill: T.muted }}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                width={55}
              />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }}
                formatter={(v, name) => [fmt(v), name === "acumulado" ? "Acumulado" : name === "aportado" ? "Aportado" : "Ganhos"]}
                labelFormatter={(m) => `Mês ${m} (${Math.floor(m / 12)}a ${m % 12}m)`}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === "acumulado" ? "Acumulado" : v === "aportado" ? "Aportado" : v} />
              <Area type="monotone" dataKey="aportado" stroke={T.gold} fill="url(#grad-aportado)" strokeWidth={1.5} />
              <Area type="monotone" dataKey="acumulado" stroke={T.green} fill="url(#grad-acumulado)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Marcos por ano */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20, marginBottom: 18 }}>
        <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.ink, marginBottom: 14 }}>
          Marcos no caminho
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 360 }}>
            <thead>
              <tr style={{ color: T.muted, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 10 }}>
                <th style={{ textAlign: "left", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Ano</th>
                <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Acumulado</th>
                <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Aportado</th>
                <th style={{ textAlign: "right", padding: "8px 6px", borderBottom: `1px solid ${T.border}` }}>Ganhos</th>
              </tr>
            </thead>
            <tbody>
              {marcos.map(m => (
                <tr key={m.ano}>
                  <td style={{ padding: "8px 6px", color: T.ink, fontWeight: 500 }}>Ano {m.ano}</td>
                  <td className="num" style={{ padding: "8px 6px", textAlign: "right", color: T.green, fontWeight: 600 }}>
                    {hidden ? "•••" : fmt(m.acumulado)}
                  </td>
                  <td className="num" style={{ padding: "8px 6px", textAlign: "right", color: T.muted }}>
                    {hidden ? "•••" : fmt(m.aportado)}
                  </td>
                  <td className="num" style={{ padding: "8px 6px", textAlign: "right", color: T.gold, fontWeight: 600 }}>
                    {hidden ? "•••" : fmt(m.ganhos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Comparativo */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 10 }}>
          E se você <em>não</em> aportasse?
        </div>
        <p style={{ fontSize: 12.5, color: T.muted, marginBottom: 14, lineHeight: 1.6 }}>
          Mantendo só o valor que você já tem hoje ({fmt(valorInicial)}) na mesma taxa,
          em {prazoAnos} {prazoAnos === 1 ? "ano" : "anos"} você teria <strong style={{ color: T.ink }}>{fmt(cenarioSemAporte)}</strong>.
          Com aporte mensal de {fmt(aporte)} você chega a <strong style={{ color: T.green }}>{fmt(valorFinal)}</strong> —
          uma diferença de <strong style={{ color: T.gold }}>{fmt(valorFinal - cenarioSemAporte)}</strong>.
        </p>
        {custoAtual > 0 && (
          <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic" }}>
            Seu custo médio atual: {fmt(custoAtual)} · Posição atual: {fmt(valorInicial)} ·
            Resultado atual: {fmt(valorInicial - custoAtual)} ({fmtN(custoAtual > 0 ? ((valorInicial - custoAtual) / custoAtual) * 100 : 0, 1)}%)
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon, cor }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
          {label}
        </div>
        {Icon && (
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: `${cor}22`, color: cor, display: "grid", placeItems: "center" }}>
            <Icon size={12} />
          </div>
        )}
      </div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function round(n) {
  return Math.round(n * 100) / 100;
}
