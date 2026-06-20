import React, { useState, useMemo } from "react";
import { Activity, Briefcase, TrendingUp, TrendingDown, Coins } from "lucide-react";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { MESES_CURTO } from "../../lib/meses.js";
import { fmt, fmtN } from "../../lib/format.js";
import { semCapitalSocial } from "../../lib/invest-constants.js";
import PageHeader from "../ui/PageHeader.jsx";
import StatCard from "../ui/StatCard.jsx";

const CLASS_LABEL = { acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs", cripto: "Cripto", tesouro: "Tesouro", cdb: "CDB", capitalSocial: "Capital Social" };

// Parâmetros plausíveis por classe: retorno médio anual, volatilidade e cor.
const CLASS_PARAMS = {
  acao:    { mean: 0.13, vol: 0.24, cor: T.gold },
  fii:     { mean: 0.10, vol: 0.14, cor: T.green },
  stock:   { mean: 0.11, vol: 0.18, cor: T.blue },
  reit:    { mean: 0.09, vol: 0.17, cor: "#0ea5e9" },
  etf:     { mean: 0.10, vol: 0.16, cor: T.yellow },
  cripto:  { mean: 0.30, vol: 0.70, cor: "#8b5cf6" },
  tesouro: { mean: 0.11, vol: 0.05, cor: "#22c55e" },
  cdb:     { mean: 0.105, vol: 0.03, cor: "#14b8a6" },
  capitalSocial: { mean: 0.10, vol: 0.03, cor: "#0d9488" },
};

const seededRandom = (seed) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
};

export default function Analise({ ativos: ativosProp, transacoes, hidden }) {
  const ativos = semCapitalSocial(ativosProp); // Capital Social fora da simulação
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => currentYear - 4 + i), [currentYear]);

  // Annual returns per asset class — deterministic by year + class
  const classReturns = useMemo(() => {
    const out = {};
    Object.keys(CLASS_PARAMS).forEach(cls => {
      out[cls] = {};
      const seed0 = cls.charCodeAt(0) * 31 + (cls.charCodeAt(1) || 0) * 7;
      years.forEach(y => {
        const rng = seededRandom(y * 137 + seed0);
        // Approx normal: sum of 6 uniforms
        let z = 0;
        for (let i = 0; i < 6; i++) z += rng();
        z -= 3;
        const p = CLASS_PARAMS[cls];
        // Lognormal-like to keep r > -100%
        const r = Math.exp(Math.log(1 + p.mean) - 0.5 * p.vol * p.vol + p.vol * z) - 1;
        out[cls][y] = Math.max(-0.85, Math.min(3.0, r));
      });
    });
    return out;
  }, [years]);

  // Current composition + class weights
  const composition = useMemo(() => {
    const total = ativos.reduce((s, a) => s + a.qtd * a.preco, 0);
    const byClass = {};
    ativos.forEach(a => { byClass[a.tipo] = (byClass[a.tipo] || 0) + a.qtd * a.preco; });
    const weights = {};
    Object.entries(byClass).forEach(([k, v]) => { weights[k] = total > 0 ? v / total : 0; });
    return { total, byClass, weights };
  }, [ativos]);

  // Weighted yearly returns of current portfolio
  const weightedReturns = useMemo(() => {
    const out = {};
    years.forEach(y => {
      let r = 0;
      Object.entries(composition.weights).forEach(([cls, w]) => {
        r += w * (classReturns[cls]?.[y] ?? 0);
      });
      out[y] = r;
    });
    return out;
  }, [classReturns, composition.weights, years]);

  // Real dividends per year, from transactions
  const divsByYear = useMemo(() => {
    const out = {};
    transacoes.forEach(t => {
      if (t.tipo !== "receita") return;
      const cat = String(t.categoria || "").toLowerCase();
      if (!cat.includes("dividend") && !cat.includes("juros") && !cat.includes("rendiment")) return;
      const y = parseInt(String(t.data || "").slice(0, 4));
      if (!isNaN(y)) out[y] = (out[y] || 0) + Number(t.valor || 0);
    });
    return out;
  }, [transacoes]);

  // Project portfolio value backwards from current = end-of-currentYear
  const portfolioByYear = useMemo(() => {
    const out = { [currentYear]: composition.total };
    let v = composition.total;
    for (let i = 0; i < years.length - 1; i++) {
      const y = currentYear - i;
      const ret = weightedReturns[y] ?? 0;
      v = v / (1 + ret);
      out[y - 1] = v;
    }
    return out;
  }, [composition.total, weightedReturns, years, currentYear]);

  // Selected year stats
  const yearStart = portfolioByYear[year - 1] ?? portfolioByYear[year];
  const yearEnd = portfolioByYear[year];
  const yearReturn = weightedReturns[year] ?? 0;
  const yearGain = yearEnd - yearStart;
  const yearDivs = divsByYear[year] || 0;

  // Benchmark: CDI hypothetical (~12% a.a. average, with year variance)
  const cdiReturns = useMemo(() => {
    const out = {};
    years.forEach(y => {
      const rng = seededRandom(y * 11 + 999);
      out[y] = 0.105 + (rng() - 0.5) * 0.04; // 8.5% – 12.5%
    });
    return out;
  }, [years]);

  // Class contributions in selected year
  const classContrib = useMemo(() => {
    return Object.entries(composition.weights)
      .filter(([, w]) => w > 0)
      .map(([cls, w]) => {
        const r = classReturns[cls]?.[year] ?? 0;
        return { cls, label: CLASS_LABEL[cls], cor: CLASS_PARAMS[cls].cor, w, r, contrib: w * r };
      })
      .sort((a, b) => b.contrib - a.contrib);
  }, [composition.weights, classReturns, year]);

  // Synthesized monthly evolution within selected year
  const monthlyEvolution = useMemo(() => {
    const months = MESES_CURTO;
    const monthlyAvg = Math.pow(yearEnd / yearStart, 1 / 12) - 1;
    const rng = seededRandom(year * 42);
    let v = yearStart;
    const out = [];
    for (let m = 0; m < 12; m++) {
      const noise = (rng() - 0.5) * 0.05;
      v = v * (1 + monthlyAvg + noise);
      out.push({ mes: months[m], valor: +v.toFixed(2) });
    }
    out[11].valor = +yearEnd.toFixed(2); // anchor
    return out;
  }, [yearStart, yearEnd, year]);

  // Annual comparison
  const yearlyData = years.map(y => ({
    ano: String(y),
    retorno: +((weightedReturns[y] || 0) * 100).toFixed(2),
    cdi: +((cdiReturns[y] || 0) * 100).toFixed(2),
    dividendos: divsByYear[y] || 0,
  }));

  // Asset performance in selected year
  const assetPerf = useMemo(() => ativos.map(a => {
    const r = classReturns[a.tipo]?.[year] ?? 0;
    const value = a.qtd * a.preco;
    return { ...a, ret: r, contribAbs: value * r };
  }).sort((a, b) => b.ret - a.ret), [ativos, classReturns, year]);

  const winners = assetPerf.slice(0, 3);
  const losers = assetPerf.slice(-3).reverse().filter(x => x.ret < 0);

  const cdi = cdiReturns[year] || 0;
  const vsCdi = yearReturn - cdi;
  const mask = (v) => hidden ? "•••••" : v;

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Capítulo VIII"
        title="Análise Anual"
        sub="Como sua carteira atual teria se comportado a cada ano. Análise contrafactual."
      />

      {/* Year selector */}
      <div className="flex flex-wrap gap-2 mb-8">
        {years.map(y => (
          <button key={y} onClick={() => setYear(y)}
            style={{
              padding: "10px 22px",
              border: `1px solid ${year === y ? T.gold : T.border}`,
              background: year === y ? `${T.gold}22` : T.card,
              color: year === y ? T.gold : T.muted,
              fontFamily: T.serif, fontSize: 20, letterSpacing: "-0.01em",
              cursor: "pointer", transition: "all 0.2s",
            }}>
            {y}
          </button>
        ))}
      </div>

      {/* Hero return */}
      <section className="text-center py-8 mb-2">
        <div className="ornament mb-4">
          <span style={{ fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase" }}>
            Retorno em {year}
          </span>
        </div>
        <div className="num" style={{
          fontFamily: T.serif, fontSize: "clamp(56px, 10vw, 112px)",
          color: yearReturn >= 0 ? T.green : T.red, lineHeight: 1, letterSpacing: "-0.03em"
        }}>
          {yearReturn >= 0 ? "+" : ""}{fmtN(yearReturn * 100, 2)}%
        </div>
        <div className="mt-3 text-base" style={{ color: T.muted }}>
          <span className="num" style={{ color: vsCdi >= 0 ? T.green : T.red }}>
            {vsCdi >= 0 ? "+" : ""}{fmtN(vsCdi * 100, 2)} p.p.
          </span>
          {" "}<span className="italic">vs. CDI ({fmtN(cdi * 100, 2)}%)</span>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-px mb-10" style={{ background: T.border }}>
        <StatCard label={`Patrimônio · início ${year}`} value={mask(fmt(yearStart))} accent={T.muted} icon={Activity} />
        <StatCard label={`Patrimônio · fim ${year}`} value={mask(fmt(yearEnd))} accent={T.gold} icon={Briefcase} />
        <StatCard label="Valorização" value={mask(fmt(yearGain))}
                  accent={yearGain >= 0 ? T.green : T.red}
                  icon={yearGain >= 0 ? TrendingUp : TrendingDown} />
        <StatCard label="Dividendos recebidos" value={mask(fmt(yearDivs))} accent={T.gold} icon={Coins}
                  sub={yearDivs === 0 ? "Sem registros nas transações" : null} />
      </section>

      {/* Monthly evolution + class contribution */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <div className="lg:col-span-2" style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
          <div className="label-eyebrow">Evolução mensal</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4, marginBottom: 12 }}>
            {year} · ponta a ponta
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={monthlyEvolution} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gAnY" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={yearReturn >= 0 ? T.green : T.red} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={yearReturn >= 0 ? T.green : T.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="mes" stroke={T.muted} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={T.muted} fontSize={11} tickLine={false} axisLine={false}
                     tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12 }}
                       formatter={(v) => fmt(v)} labelStyle={{ color: T.gold }} />
              <Area type="monotone" dataKey="valor"
                    stroke={yearReturn >= 0 ? T.green : T.red} strokeWidth={1.5}
                    fill="url(#gAnY)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
          <div className="label-eyebrow">Contribuição</div>
          <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4, marginBottom: 16 }}>
            Por classe
          </h3>
          {classContrib.length === 0 ? (
            <div style={{ color: T.muted, fontStyle: "italic" }}>Sem ativos para análise.</div>
          ) : (
            <div className="space-y-4">
              {classContrib.map(c => (
                <div key={c.cls}>
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2">
                      <div style={{ width: 10, height: 10, background: c.cor }} />
                      <span style={{ color: T.ink, fontFamily: T.serif, fontSize: 16 }}>{c.label}</span>
                    </div>
                    <div className="num text-sm" style={{ color: c.r >= 0 ? T.green : T.red }}>
                      {c.r >= 0 ? "+" : ""}{fmtN(c.r * 100, 1)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs mb-1" style={{ color: T.muted }}>
                    <span className="num">peso {fmtN(c.w * 100, 1)}%</span>
                    <span className="num" style={{ color: c.contrib >= 0 ? T.green : T.red }}>
                      contrib {fmtN(c.contrib * 100, 2)} p.p.
                    </span>
                  </div>
                  <div style={{ background: T.border, height: 4 }}>
                    <div style={{
                      width: `${Math.min(100, Math.abs(c.contrib) / Math.abs(yearReturn || 0.01) * 100)}%`,
                      background: c.cor, height: "100%", transition: "width 0.6s"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Yearly comparison */}
      <section style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }} className="mb-10">
        <div className="flex items-baseline justify-between mb-1">
          <div>
            <div className="label-eyebrow">Retorno anual</div>
            <h3 style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, marginTop: 4 }}>Carteira vs. CDI</h3>
          </div>
          <div className="num text-sm" style={{ color: T.muted }}>
            Média 5 anos: <span style={{ color: T.gold }}>
              {fmtN(years.reduce((s, y) => s + (weightedReturns[y] || 0), 0) / years.length * 100, 2)}% a.a.
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={yearlyData} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="ano" stroke={T.muted} fontSize={12} tickLine={false} axisLine={false} />
            <YAxis stroke={T.muted} fontSize={11} tickLine={false} axisLine={false}
                   tickFormatter={(v) => `${v}%`} />
            <Tooltip contentStyle={{ background: T.bg, border: `1px solid ${T.border}`, fontFamily: T.mono, fontSize: 12 }}
                     formatter={(v, name) => [`${fmtN(v, 2)}%`, name]}
                     labelStyle={{ color: T.gold }} />
            <Legend wrapperStyle={{ fontFamily: T.sans, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", paddingTop: 12 }} />
            <Bar dataKey="retorno" name="Carteira" fill={T.gold} radius={[2, 2, 0, 0]} />
            <Bar dataKey="cdi" name="CDI" fill={T.muted} radius={[2, 2, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Winners & Losers */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <RankCard titulo={`Maiores ganhos · ${year}`} icon={TrendingUp} cor={T.green} ativos={winners} hidden={hidden} />
        <RankCard titulo={`Maiores perdas · ${year}`} icon={TrendingDown} cor={T.red}
                  ativos={losers.length > 0 ? losers : []} hidden={hidden}
                  emptyMsg={`Nenhum ativo encerrou ${year} no negativo nesta simulação.`} />
      </section>

      {/* Methodology footer */}
      <section style={{ background: T.bgSoft, border: `1px solid ${T.border}`, padding: 24 }} className="mb-10">
        <div className="label-eyebrow mb-2">Metodologia · leitura honesta</div>
        <div style={{ color: T.muted, fontSize: 15, lineHeight: 1.7, fontStyle: "italic" }}>
          Esta análise é <strong style={{ color: T.ink }}>contrafactual</strong>: assume que a composição
          atual da sua carteira teria existido em cada ano avaliado. Os retornos por classe (Ações, FIIs,
          Cripto, Tesouro, CDB) foram sintetizados deterministicamente a partir de médias e volatilidades
          históricas típicas — eles são <strong style={{ color: T.ink }}>plausíveis</strong>, mas não
          refletem retornos efetivos do mercado em cada ano. Os <strong style={{ color: T.ink }}>dividendos</strong> exibidos
          são reais, lidos das suas transações com categoria contendo "Dividendos", "Juros" ou "Rendimento".
          Para análise rigorosa, registre suas compras e vendas como transações datadas e use seus extratos da corretora.
        </div>
      </section>
    </div>
  );
}

function RankCard({ titulo, icon: Icon, cor, ativos, hidden, emptyMsg }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={18} style={{ color: cor }} />
        <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink }}>{titulo}</h3>
      </div>
      {ativos.length === 0 ? (
        <div style={{ color: T.muted, fontStyle: "italic", padding: "16px 0" }}>{emptyMsg || "Sem dados."}</div>
      ) : (
        <div className="space-y-2">
          {ativos.map(a => (
            <div key={a.id} className="flex items-center justify-between py-3"
                 style={{ borderBottom: `1px solid ${T.border}` }}>
              <div className="flex-1 min-w-0">
                <div style={{ fontFamily: T.serif, fontSize: 17, color: T.ink }}>{a.ticker}</div>
                <div style={{ color: T.muted, fontSize: 12 }} className="italic">
                  {a.nome} · {CLASS_LABEL[a.tipo] || a.tipo}
                </div>
              </div>
              <div className="text-right">
                <div className="num" style={{ color: cor, fontSize: 17 }}>
                  {a.ret >= 0 ? "+" : ""}{fmtN(a.ret * 100, 1)}%
                </div>
                <div className="num text-xs" style={{ color: T.muted }}>
                  {hidden ? "•••" : fmt(a.contribAbs)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

