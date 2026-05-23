import React, { useMemo } from "react";
import { Wallet, Briefcase, TrendingUp, TrendingDown, Sparkles, ChevronRight, ArrowRight, FileText, BarChart3, PieChart as PieIcon } from "lucide-react";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { gerarInsights } from "../../lib/intelligence.js";
import { calcMoMTransacoes } from "../../lib/mom.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { getKPIsMes } from "../../lib/agregador.js";

const MESES_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
const CORES_CAT = ["#22c55e","#3b82f6","#f59e0b","#ef4444","#a855f7","#06b6d4","#ec4899","#84cc16","#6b7280"];
const CLASS_LABEL = { acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs", cripto: "Cripto", rf: "Renda Fixa", tesouro: "Tesouro", cdb: "CDB", outro: "Outros" };
const CLASS_COR = { acao: "#f5a524", fii: "#10b981", stock: "#3b82f6", reit: "#0ea5e9", cripto: "#8b5cf6", rf: "#06b6d4", etf: "#fbbf24", tesouro: "#22c55e", cdb: "#14b8a6", outro: "#9ca3af" };

function greetingForTime() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function nextMonthsISO(n = 6) {
  const out = [];
  const now = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push({
      label: `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      iso: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
    });
  }
  return out;
}

export default function Dashboard({
  hidden, contas: contasRaw, ativos = [], transacoes: transacoesRaw,
  categorias, metas, cartoes = [], parcelamentos = [], devedores = [], dividas = [],
  fixas = [], fixaOcorrencias = [],
  escopoAtivo = "tudo",
  onTabChange, onContaClick, userName = "Paulo",
}) {
  const contas = useMemo(() => filtrarPorEscopo(contasRaw || [], escopoAtivo), [contasRaw, escopoAtivo]);
  const transacoes = useMemo(() => {
    if (escopoAtivo === "tudo") return transacoesRaw || [];
    const setContas = new Set(contas.map(c => c.nome));
    // Strict: só transações com conta dentro do escopo (órfãs sem conta NÃO entram em pessoal ou negócio).
    return (transacoesRaw || []).filter(t => t.conta && setContas.has(t.conta));
  }, [transacoesRaw, contas, escopoAtivo]);

  const mask = (s) => hidden ? "•••••" : s;

  // ===== Totais e KPIs =====
  const hoje = new Date();
  const mesISO = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
  const ehMesAtual = (data) => (data || "").startsWith(mesISO);

  const totalContas = useMemo(() => contas.reduce((s, c) => s + Number(c.saldo || 0), 0), [contas]);
  const totalInvest = useMemo(() => ativos.reduce((s, a) => s + Number(a.qtd||0) * Number(a.preco||0), 0), [ativos]);
  const patrimonio = totalContas + totalInvest;
  const receitasMes = useMemo(() => transacoes.filter(t => t.tipo === "receita" && ehMesAtual(t.data)).reduce((s,t) => s+Number(t.valor||0), 0), [transacoes, mesISO]);
  const despesasMes = useMemo(() => transacoes.filter(t => t.tipo === "despesa" && ehMesAtual(t.data)).reduce((s,t) => s+Number(t.valor||0), 0), [transacoes, mesISO]);

  const momReceitas = useMemo(() => calcMoMTransacoes(transacoes, { tipo: "receita" }), [transacoes]);
  const momDespesas = useMemo(() => calcMoMTransacoes(transacoes, { tipo: "despesa" }), [transacoes]);

  // Rentabilidade aproximada da carteira (pm vs preco atual)
  const rentInvest = useMemo(() => {
    let investido = 0, atual = 0;
    ativos.forEach(a => {
      const pm = Number(a.pm ?? a.precoMedio ?? 0);
      const qtd = Number(a.qtd || 0);
      investido += qtd * pm;
      atual += qtd * Number(a.preco || 0);
    });
    return investido > 0 ? ((atual - investido) / investido) * 100 : 0;
  }, [ativos]);

  // MoM do patrimônio aproximado a partir do fluxo do mês
  const momPatrim = useMemo(() => {
    const fluxo = receitasMes - despesasMes;
    const ant = patrimonio - fluxo;
    return ant > 0 ? ((patrimonio - ant) / ant) * 100 : 0;
  }, [patrimonio, receitasMes, despesasMes]);

  // ===== Alocação atual dos investimentos (donut por classe) =====
  const alocacao = useMemo(() => {
    const m = {};
    ativos.forEach(a => {
      const v = Number(a.qtd || 0) * Number(a.preco || 0);
      if (v <= 0) return;
      const k = a.tipo || "outro";
      m[k] = (m[k] || 0) + v;
    });
    const tot = Object.values(m).reduce((s,v) => s+v, 0) || 1;
    return Object.entries(m).sort((a,b) => b[1]-a[1]).map(([k,v]) => ({
      tipo: k, label: CLASS_LABEL[k] || k, valor: v, pct: (v/tot)*100, cor: CLASS_COR[k] || "#9ca3af",
    }));
  }, [ativos]);

  // ===== Gastos por categoria (donut) =====
  const gastosCat = useMemo(() => {
    const m = {};
    transacoes.filter(t => t.tipo === "despesa" && ehMesAtual(t.data))
      .forEach(t => { const k = t.categoria || "Outros"; m[k] = (m[k] || 0) + Number(t.valor||0); });
    const tot = Object.values(m).reduce((s,v) => s+v, 0) || 1;
    return Object.entries(m).sort((a,b) => b[1]-a[1]).map(([k,v], i) => ({
      nome: k, valor: v, pct: (v/tot)*100, cor: CORES_CAT[i % CORES_CAT.length],
    }));
  }, [transacoes, mesISO]);

  // ===== Evolução do patrimônio (mês a mês YTD) =====
  const evolucao = useMemo(() => {
    const arr = [];
    const ano = hoje.getFullYear();
    const saldoBase = contas.reduce((s, c) => s + Number(c.saldoInicial != null ? c.saldoInicial : (c.saldo || 0) - 0), 0);
    for (let m = 0; m <= hoje.getMonth(); m++) {
      const limite = `${ano}-${String(m+1).padStart(2,"0")}-31`;
      const fluxo = transacoes
        .filter(t => (t.data || "") <= limite)
        .reduce((s,t) => s + (t.tipo === "receita" ? Number(t.valor||0) : -Number(t.valor||0)), 0);
      arr.push({ mes: MESES_PT[m], saldo: saldoBase + fluxo + totalInvest });
    }
    return arr;
  }, [transacoes, contas, totalInvest]);

  const momAno = useMemo(() => {
    if (evolucao.length < 2) return 0;
    const ini = evolucao[0].saldo, fim = evolucao[evolucao.length-1].saldo;
    return ini > 0 ? ((fim - ini) / ini) * 100 : 0;
  }, [evolucao]);

  // ===== Projeção próximos 6 meses =====
  const projecao = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes };
    return nextMonthsISO(6).map(m => {
      let kpi = { receitas: 0, despesas: 0 };
      try { kpi = getKPIsMes(m.iso, state, escopoAtivo) || kpi; } catch {}
      const rec = Number(kpi.receitas || 0);
      const des = Number(kpi.despesas || 0);
      return { label: m.label, receita: rec, despesa: des, saldo: rec - des };
    });
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, escopoAtivo]);

  // ===== Insights =====
  const insights = useMemo(() => {
    try { return gerarInsights(transacoes, contas, ativos, cartoes, parcelamentos) || []; }
    catch { return []; }
  }, [transacoes, contas, ativos, cartoes, parcelamentos]);
  const principalInsight = insights[0];

  return (
    <div className="fade-up">
      {/* Greeting */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 600, color: T.ink, margin: 0 }}>
          {greetingForTime()}, {userName}! 👋
        </h1>
        <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
          Aqui está o resumo da sua vida financeira.
        </div>
      </div>

      {/* KPI row */}
      <section className="dash-kpi-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 16,
      }}>
        <KpiHero value={patrimonio} mom={momPatrim} hidden={hidden} evolucao={evolucao} />
        <KpiBlock label="Total em Contas" value={mask(fmt(totalContas))} sub={`${contas.length} contas ativas`} icon={Wallet} cor={T.green} />
        <KpiBlock label="Investimentos" value={mask(fmt(totalInvest))} sub="rentabilidade" icon={PieIcon} cor={T.green} variation={rentInvest} />
        <KpiBlock label="Receitas este mês" value={mask(fmt(receitasMes))} sub="vs mês anterior" icon={TrendingUp} cor={T.green} variation={momReceitas} />
        <KpiBlock label="Despesas este mês" value={mask(fmt(despesasMes))} sub="vs mês anterior" icon={TrendingDown} cor={T.red} variation={momDespesas} negativeGood />
      </section>

      {/* Mid row */}
      <section className="dash-mid-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <ContasCard contas={contas} hidden={hidden} onContaClick={onContaClick} onSeeAll={() => onTabChange?.("contas")} />
        <AlocacaoCard data={alocacao} total={totalInvest} hidden={hidden} onSeeAll={() => onTabChange?.("investimentos")} />
        <InsightsCard insight={principalInsight} onSeeAll={() => onTabChange?.("analiseia")} />
      </section>

      {/* Bottom row */}
      <section className="dash-bot-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <GastosCategoriaCard data={gastosCat} hidden={hidden} />
        <EvolucaoCard data={evolucao} valor={patrimonio} momAno={momAno} hidden={hidden} />
        <ProjecaoCard projecao={projecao} hidden={hidden} />
      </section>

      {/* Metas + Pergunte IA */}
      <section className="dash-metas-grid" style={{
        display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: 12, marginBottom: 24,
      }}>
        <MetasCard metas={metas || []} hidden={hidden} onSeeAll={() => onTabChange?.("metas")} />
        <PergunteIACard onClick={() => onTabChange?.("perguntar")} />
      </section>

      <style>{`
        @media (max-width: 1024px) {
          .dash-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-mid-grid, .dash-bot-grid, .dash-metas-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function KpiHero({ value, mom, hidden, evolucao }) {
  const bg = "linear-gradient(135deg, #0d2818 0%, #1a3a26 100%)";
  return (
    <div style={{ background: bg, color: "#fff", borderRadius: 12, padding: 14, position: "relative", overflow: "hidden", minHeight: 110 }}>
      <div style={{ fontSize: 11, color: "#86efac", letterSpacing: ".03em" }}>Patrimônio Total</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, marginTop: 6 }}>{hidden ? "•••••" : fmt(value)}</div>
      <div style={{ fontSize: 11, color: "#86efac", marginTop: 4 }}>
        {mom >= 0 ? "↗" : "↘"} {fmtN(mom, 2)}%
        <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: 4 }}>vs mês anterior</span>
      </div>
      <div style={{ position: "absolute", right: 0, bottom: 0, left: 0, height: 46, opacity: 0.6, pointerEvents: "none" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={evolucao}>
            <defs>
              <linearGradient id="grad-hero" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.7} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="saldo" stroke="#22c55e" fill="url(#grad-hero)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function KpiBlock({ label, value, sub, icon: Icon, cor, variation, negativeGood }) {
  const num = typeof variation === "number" ? variation : null;
  const varStr = num != null ? (num >= 0 ? "↗ +" : "↘ ") + fmtN(num, 2) + "%" : null;
  const positive = negativeGood ? (num != null && num <= 0) : (num != null && num >= 0);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, position: "relative", minHeight: 110 }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, marginTop: 6, color: T.ink }}>{value}</div>
      {varStr && (
        <div style={{ fontSize: 11, color: positive ? T.green : T.red, marginTop: 4 }}>{varStr}</div>
      )}
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sub}</div>}
      {Icon && (
        <div style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", background: `${cor || T.gold}1f`, display: "grid", placeItems: "center" }}>
          <Icon size={16} style={{ color: cor || T.gold }} />
        </div>
      )}
    </div>
  );
}

function ContasCard({ contas, hidden, onContaClick, onSeeAll }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Contas</div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Ver todas</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {contas.slice(0, 4).map(c => (
          <button key={c.id} onClick={() => onContaClick?.(c)}
            style={{ background: "transparent", border: "none", padding: "9px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: c.cor || T.gold, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {(c.instituicao || c.nome || "?").slice(0,1).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{c.tipo === "carteira" ? "Carteira (Física)" : "Conta Corrente"}</div>
            </div>
            <div className="num" style={{ fontFamily: T.serif, fontSize: 13, color: c.saldo < 0 ? T.red : T.ink, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(c.saldo)}</div>
            <ChevronRight size={14} style={{ color: T.muted, flexShrink: 0 }} />
          </button>
        ))}
        {contas.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>Sem contas cadastradas.</div>
        )}
      </div>
    </div>
  );
}

function AlocacaoCard({ data, total, hidden, onSeeAll }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Alocação Atual</div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Ver carteira</button>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>Nenhum ativo na carteira.</div>
      ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="valor" cx="50%" cy="50%" innerRadius={48} outerRadius={70} stroke="none">
                {data.map((d,i) => <Cell key={i} fill={d.cor} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".15em" }}>TOTAL</div>
              <div className="num" style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: T.ink }}>{hidden ? "•••" : fmt(total)}</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140, fontSize: 11, display: "flex", flexDirection: "column", gap: 5 }}>
          {data.map((d,i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />
              <span style={{ flex: 1, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
              <span style={{ color: T.ink }}>{fmtN(d.pct, 0)}%</span>
              <span className="num" style={{ color: T.muted, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(d.valor)}</span>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

function InsightsCard({ insight, onSeeAll }) {
  const bg = "linear-gradient(135deg, #0d2818 0%, #1a3a26 100%)";
  return (
    <div style={{ background: bg, color: "#fff", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          🤖 Insights da IA
        </div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, cursor: "pointer" }}>Ver todos</button>
      </div>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, marginBottom: 14 }}>
        {insight?.texto || insight?.descricao || insight?.titulo
          || "Acompanhe aqui análises automáticas dos seus gastos, receitas e tendências."}
      </div>
      <button onClick={onSeeAll}
              style={{ background: "rgba(255,255,255,0.1)", border: `1px solid rgba(255,255,255,0.2)`, color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
        Ver análise completa →
      </button>
    </div>
  );
}

function GastosCategoriaCard({ data, hidden }) {
  const total = data.reduce((s,d) => s + d.valor, 0);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Gastos por Categoria</div>
        <div style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px" }}>Este mês</div>
      </div>
      {data.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>Nenhuma despesa este mês.</div>
      ) : (
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <div style={{ width: 140, height: 140, position: "relative", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="valor" cx="50%" cy="50%" innerRadius={45} outerRadius={65} stroke="none">
                {data.map((d,i) => <Cell key={i} fill={d.cor} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 9, color: T.muted, letterSpacing: ".15em" }}>TOTAL</div>
              <div className="num" style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: T.ink }}>{hidden ? "•••" : fmt(total)}</div>
              <div style={{ fontSize: 9, color: T.muted }}>100%</div>
            </div>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 140, fontSize: 11, display: "flex", flexDirection: "column", gap: 5 }}>
          {data.slice(0, 6).map((d,i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />
              <span style={{ flex: 1, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nome}</span>
              <span style={{ color: T.ink }}>{fmtN(d.pct, 0)}%</span>
              <span className="num" style={{ color: T.muted, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(d.valor)}</span>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
  );
}

function EvolucaoCard({ data, valor, momAno, hidden }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Evolução do Patrimônio</div>
        <div style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 6, padding: "3px 8px" }}>Este ano</div>
      </div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: T.ink }}>{hidden ? "•••••" : fmt(valor)}</div>
      <div style={{ fontSize: 11, color: momAno >= 0 ? T.green : T.red, marginBottom: 8 }}>
        {momAno >= 0 ? "↗" : "↘"} {fmtN(momAno, 2)}% no ano
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="grad-evol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={T.green} stopOpacity={0.4} />
                <stop offset="100%" stopColor={T.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.muted }} />
            <YAxis tick={{ fontSize: 9, fill: T.muted }} width={50} />
            <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }} />
            <Area type="monotone" dataKey="saldo" stroke={T.green} fill="url(#grad-evol)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ProjecaoCard({ projecao, hidden }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: ".15em", color: T.muted, fontWeight: 600 }}>PROJEÇÃO · MESES A VENCER</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 10, cursor: "pointer", color: T.muted }}><FileText size={10}/>PDF</button>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 10, cursor: "pointer", color: T.muted }}><BarChart3 size={10}/>CSV</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {projecao.map(p => (
          <div key={p.label} style={{ background: T.bgSoft, borderRadius: 6, padding: 8, borderTop: `2px solid ${T.green}` }}>
            <div style={{ fontSize: 9.5, letterSpacing: ".1em", color: T.muted, fontWeight: 600 }}>{p.label}</div>
            <div className="num" style={{ fontSize: 11, color: T.green }}>+ {hidden ? "•••" : fmt(p.receita)}</div>
            <div className="num" style={{ fontSize: 11, color: T.red }}>− {hidden ? "•••" : fmt(p.despesa)}</div>
            <div className="num" style={{ fontSize: 12, fontWeight: 700, color: p.saldo >= 0 ? T.green : T.red, marginTop: 2, paddingTop: 4, borderTop: `1px solid ${T.border}` }}>
              = {p.saldo >= 0 ? "+ " : "− "}{hidden ? "•••" : fmt(Math.abs(p.saldo))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.4 }}>
        📅 Baseado em compromissos já agendados (fixas, parcelas, dívidas, devedores) nos próximos 6 meses.
      </div>
    </div>
  );
}

function MetasCard({ metas, hidden, onSeeAll }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Metas Financeiras</div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Ver todas</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {metas.slice(0, 3).map(m => {
          const meta = Number(m.alvo ?? m.valorMeta ?? m.valor ?? 0);
          const atual = Number(m.atual ?? m.valorAtual ?? m.aplicado ?? 0);
          const pct = meta > 0 ? Math.min(100, (atual / meta) * 100) : 0;
          return (
            <div key={m.id} style={{ background: T.bgSoft, borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 2 }}>{m.nome || m.titulo || "Meta"}</div>
              <div style={{ fontSize: 10, color: T.muted, marginBottom: 6 }}>
                <span className="num">{hidden ? "•••" : fmt(atual)}</span> / <span className="num">{hidden ? "•••" : fmt(meta)}</span>
                <span style={{ float: "right", color: T.green, fontWeight: 600 }}>{fmtN(pct, 0)}%</span>
              </div>
              <div style={{ background: T.border, height: 4, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: T.green }} />
              </div>
            </div>
          );
        })}
        <button onClick={onSeeAll}
                style={{ background: "transparent", border: `2px dashed ${T.border}`, borderRadius: 8, padding: 10, color: T.muted, fontSize: 12, cursor: "pointer", minHeight: 70 }}>
          + Nova Meta
        </button>
      </div>
    </div>
  );
}

function PergunteIACard({ onClick }) {
  return (
    <button onClick={onClick}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: `${T.green}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Sparkles size={18} style={{ color: T.green }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Pergunte à IA</div>
        <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>Tire dúvidas e obtenha análises</div>
      </div>
      <ArrowRight size={16} style={{ color: T.muted }} />
    </button>
  );
}
