import React, { useMemo, useEffect, useState } from "react";
import { Wallet, Briefcase, TrendingUp, TrendingDown, Sparkles, ChevronRight, ArrowRight, FileText, BarChart3, PieChart as PieIcon, HandCoins, AlertCircle, Clock, Calendar } from "lucide-react";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { gerarInsights } from "../../lib/intelligence.js";
import { calcMoMTransacoes } from "../../lib/mom.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { getKPIsMes, getDespesasDoMes } from "../../lib/agregador.js";
import { supabase } from "../../lib/supabase.js";
import Card from "../ui/Card.jsx";

const MESES_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
// Paleta moderna e harmônica (tons mais suaves, sem primários puros gritando).
const CORES_CAT = ["#6366f1","#0ea5e9","#22c08b","#f5a623","#f0728a","#a78bfa","#2dd4bf","#fb923c","#94a3b8"];
const CLASS_LABEL = { acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs", cripto: "Cripto", rf: "Renda Fixa", tesouro: "Tesouro", cdb: "CDB", outro: "Outros" };
const CLASS_COR = { acao: "#f5a524", fii: "#10b981", stock: "#3b82f6", reit: "#0ea5e9", cripto: "#8b5cf6", rf: "#06b6d4", etf: "#fbbf24", tesouro: "#22c55e", cdb: "#14b8a6", outro: "#9ca3af" };

function greetingForTime() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Extrai um primeiro nome amigável do usuário Supabase:
//   user_metadata.full_name / .name → primeira palavra
//   senão, parte local do email (antes do @), com 1ª letra maiúscula
function deriveFirstName(user) {
  if (!user) return "";
  const md = user.user_metadata || {};
  const raw = md.full_name || md.name || (user.email || "").split("@")[0] || "";
  const first = String(raw).trim().split(/\s+/)[0] || "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1);
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
  agenda = [],
  patrimonioHistorico = [],
  escopoAtivo = "tudo",
  onTabChange, onContaClick,
}) {
  // Nome do usuário logado, resolvido via Supabase auth.
  // Sem sessão (modo local em dev) o nome fica vazio → saudação sem nome.
  const [userName, setUserName] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUserName(deriveFirstName(data?.user));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserName(deriveFirstName(session?.user));
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
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
  const despesasMes = useMemo(() => transacoes.filter(t => t.tipo === "despesa" && t.origem !== "fatura-pagamento" && ehMesAtual(t.data)).reduce((s,t) => s+Number(t.valor||0), 0), [transacoes, mesISO]);

  // "Despesas este mês" do card = total LANÇADO para o mês (competência):
  // fixas, variáveis, parcelas e dívidas com vencimento neste mês, mesmo que
  // já tenham sido pagas/antecipadas em outro mês. Usa o mesmo agregador do
  // Planejamento. (O `despesasMes` acima, em regime de caixa, segue sendo
  // usado só pro fluxo de patrimônio.)
  const stateAgg = useMemo(
    () => ({ transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes }),
    [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes]
  );
  const mesAnteriorISO = useMemo(() => {
    const [y, m] = mesISO.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, [mesISO]);
  const despesasMesLancadas = useMemo(() => {
    try { return getKPIsMes(mesISO, stateAgg, escopoAtivo).totalPrevisto || 0; }
    catch { return despesasMes; }
  }, [stateAgg, mesISO, escopoAtivo, despesasMes]);
  const momDespesasLancadas = useMemo(() => {
    try {
      const atual = getKPIsMes(mesISO, stateAgg, escopoAtivo).totalPrevisto || 0;
      const ant = getKPIsMes(mesAnteriorISO, stateAgg, escopoAtivo).totalPrevisto || 0;
      return ant > 0 ? ((atual - ant) / ant) * 100 : 0;
    } catch { return 0; }
  }, [stateAgg, mesISO, mesAnteriorISO, escopoAtivo]);

  // Resumo de despesas do mês: total / pagas / a pagar (pendentes + atrasadas).
  // Usa o agregador (getKPIsMes) — MESMA base do módulo "A Receber & Dívidas" /
  // Planejamento. Assim "A pagar" inclui fixas/parcelas/dívidas pendentes (ex.:
  // 6.940) em vez de só transações já lançadas.
  const despesasResumo = useMemo(() => {
    let kpi = null, kpiAnt = null;
    try { kpi = getKPIsMes(mesISO, stateAgg, escopoAtivo); } catch {}
    try { kpiAnt = getKPIsMes(mesAnteriorISO, stateAgg, escopoAtivo); } catch {}
    const total = Number(kpi?.totalPrevisto || 0);
    const pagas = Number(kpi?.totalPago || 0);
    const aPagar = Number(kpi?.totalPendente || 0) + Number(kpi?.totalAtrasado || 0);
    const totalAnt = Number(kpiAnt?.totalPrevisto || 0);
    const deltaPct = totalAnt > 0 ? ((total - totalAnt) / totalAnt) * 100 : null;
    return { total, pagas, aPagar, deltaPct };
  }, [stateAgg, mesISO, mesAnteriorISO, escopoAtivo]);

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
  // Mesma base do relatório "Top categorias do mês": transações de despesa do
  // mês atual, agrupadas pela categoria crua (inclui "Cartão" = pagamento de
  // fatura). Assim o donut bate exatamente com o relatório.
  const gastosCat = useMemo(() => {
    const m = {};
    transacoes.filter(t => t.tipo === "despesa" && ehMesAtual(t.data))
      .forEach(t => { const k = t.categoria || "Sem categoria"; m[k] = (m[k] || 0) + (Number(t.valor) || 0); });
    const tot = Object.values(m).reduce((s,v) => s+v, 0) || 1;
    return Object.entries(m).sort((a,b) => b[1]-a[1]).map(([k,v], i) => ({
      nome: k, valor: v, pct: (v/tot)*100, cor: CORES_CAT[i % CORES_CAT.length],
    }));
  }, [transacoes, mesISO]);

  // Orçamento do mês = soma dos limites definidos nas categorias de despesa.
  const orcamentoMes = useMemo(() =>
    (categorias || []).filter(c => c.tipo === "despesa")
      .reduce((s, c) => s + (Number(c.limite) || 0), 0),
  [categorias]);

  // Média de despesas dos últimos 3 meses (exclui o mês atual). Serve de base
  // automática quando o usuário ainda não definiu limites por categoria.
  const mediaDespesas3m = useMemo(() => {
    const [ay, am] = mesISO.split("-").map(Number);
    const totais = [1, 2, 3].map(k => {
      const d = new Date(ay, am - 1 - k, 1);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return transacoes.filter(t => t.tipo === "despesa" && (t.data || "").startsWith(iso))
        .reduce((s, t) => s + (Number(t.valor) || 0), 0);
    }).filter(v => v > 0);
    return totais.length ? totais.reduce((a, b) => a + b, 0) / totais.length : 0;
  }, [transacoes, mesISO]);

  // Base do orçamento: limites manuais se houver; senão a média (3m).
  const orcamentoBase = orcamentoMes > 0 ? orcamentoMes : mediaDespesas3m;
  const orcamentoAuto = !(orcamentoMes > 0) && mediaDespesas3m > 0;

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

  // ===== Contas a PAGAR vencendo hoje (fixas, parcelas, dívidas, avulsas) =====
  const aPagarHoje = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mesISO = hoje.slice(0, 7);
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes };
    let desp = [];
    try { desp = getDespesasDoMes(mesISO, state, escopoAtivo); } catch {}
    return desp
      .filter(d => d.status !== "paga" && (d.data || "").slice(0, 10) === hoje)
      .map(d => ({ id: d.id, nome: d.descricao, valor: Number(d.valor) || 0 }));
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, escopoAtivo]);

  // ===== Projeção próximos 6 meses =====
  const projecao = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes };
    return nextMonthsISO(6).map(m => {
      let kpi = null;
      try { kpi = getKPIsMes(m.iso, state, escopoAtivo); } catch {}
      const rec = Number(kpi?.totalGanhos || 0);
      const des = Number(kpi?.totalPrevisto || 0);
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
          {greetingForTime()}{userName ? `, ${userName}` : ""}! 👋
        </h1>
        <div style={{ color: T.muted, fontSize: 13, marginTop: 4 }}>
          Aqui está o resumo da sua vida financeira.
        </div>
      </div>

      {/* Top 3 do dia */}
      <Top3DoDia agenda={agenda} onAbrir={() => onTabChange?.("notas")} />

      {/* KPI row */}
      <section className="dash-kpi-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 16,
      }}>
        <KpiHero value={patrimonio} mom={momPatrim} hidden={hidden} evolucao={evolucao} />
        <KpiBlock label="Total em Contas" value={mask(fmt(totalContas))} sub={`${contas.length} contas ativas`} icon={Wallet} cor={T.green} />
        <KpiBlock label="Investimentos" value={mask(fmt(totalInvest))} sub="rentabilidade" icon={PieIcon} cor={T.green} variation={rentInvest} />
        <KpiBlock label="Receitas este mês" value={mask(fmt(receitasMes))} sub="vs mês anterior" icon={TrendingUp} cor={T.green} variation={momReceitas} />
        <DespesasKpiBlock resumo={despesasResumo} hidden={hidden} />
      </section>

      {/* Mid row */}
      <section className="dash-mid-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 12, marginBottom: 16,
      }}>
        <ContasCard contas={contas} hidden={hidden} onContaClick={onContaClick} onSeeAll={() => onTabChange?.("contas")} />
        <GastosCategoriaCard data={gastosCat} hidden={hidden} orcamento={orcamentoBase} orcamentoAuto={orcamentoAuto} />
      </section>

      {/* Bottom row */}
      <section className="dash-bot-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <AlocacaoCard data={alocacao} total={totalInvest} hidden={hidden} onSeeAll={() => onTabChange?.("investimentos")} />
        <AReceberCard devedores={devedores} aPagarHoje={aPagarHoje} hidden={hidden}
          onSeeAll={() => onTabChange?.("areceber")}
          onVerPagar={() => onTabChange?.("areceber")} />
        <ProjecaoCard projecao={projecao} patrimonio={patrimonio} hidden={hidden} />
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
        @media (max-width: 380px) {
          .dash-kpi-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
      `}</style>

      <ModoFoco patrimonio={patrimonio} receitasMes={receitasMes}
                despesas={despesasResumo.total} aPagar={despesasResumo.aPagar}
                metas={metas || []} hidden={hidden} userName={userName} />
    </div>
  );
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function ModoFoco({ patrimonio = 0, receitasMes = 0, despesas = 0, aPagar = 0, metas = [], hidden, userName }) {
  const [aberto, setAberto] = useState(false);
  const sobra = receitasMes - despesas;
  const meta = metas[0];
  const metaAlvo = meta ? Number(meta.alvo ?? meta.valorMeta ?? meta.valor ?? 0) : 0;
  const metaAtual = meta ? Number(meta.atual ?? meta.valorAtual ?? meta.aplicado ?? 0) : 0;
  const metaPct = metaAlvo > 0 ? Math.min((metaAtual / metaAlvo) * 100, 100) : 0;

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e) => { if (e.key === "Escape") setAberto(false); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [aberto]);

  const linha = (label, valor, cor) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "10px 0", borderBottom: `1px solid ${T.border}` }}>
      <span style={{ fontSize: 13, color: T.muted }}>{label}</span>
      <span className="num" style={{ fontSize: 18, fontWeight: 600, color: cor || T.ink }}>{hidden ? "•••••" : fmt(valor)}</span>
    </div>
  );

  return (
    <>
      <button onClick={() => setAberto(true)} aria-label="Modo Foco"
              className="no-print"
              style={{
                position: "fixed", bottom: 20, right: 20, zIndex: 900,
                background: T.gold, color: T.bg, border: "none", borderRadius: 999,
                padding: "11px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,.35)", display: "inline-flex", alignItems: "center", gap: 7,
              }}>
        🎯 Modo Foco
      </button>

      {aberto && (
        <div onClick={(e) => { if (e.target === e.currentTarget) setAberto(false); }}
             style={{
               position: "fixed", inset: 0, zIndex: 1000,
               background: `${T.bg}f2`, backdropFilter: "blur(8px)",
               display: "grid", placeItems: "center", padding: 24,
               animation: "rs .25s ease both",
             }}>
          <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>
            <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, marginBottom: 6 }}>
              {userName ? `Foco · ${userName}` : "Modo Foco"}
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>Patrimônio Total</div>
            <div className="num" style={{ fontFamily: T.serif, fontSize: 42, fontWeight: 700, color: T.ink, margin: "2px 0 18px" }}>
              {hidden ? "•••••" : fmt(patrimonio)}
            </div>

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "4px 18px", textAlign: "left" }}>
              {linha("Receitas do mês", receitasMes, T.green)}
              {linha("Despesas do mês", despesas, T.red)}
              {linha(sobra >= 0 ? "Sobra do mês" : "Déficit do mês", sobra, sobra >= 0 ? T.green : T.red)}
              {linha("A pagar este mês", aPagar, aPagar > 0 ? T.red : T.muted)}
            </div>

            {meta && metaAlvo > 0 && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginTop: 12, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: T.muted }}>Meta: {meta.nome || meta.titulo || "—"}</span>
                  <span style={{ color: T.gold, fontWeight: 600 }}>{fmtN(metaPct, 0)}%</span>
                </div>
                <div style={{ height: 7, background: T.bgSoft, borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${metaPct}%`, height: "100%", background: T.gold, borderRadius: 4 }} />
                </div>
              </div>
            )}

            <button onClick={() => setAberto(false)}
                    style={{
                      marginTop: 20, background: "transparent", color: T.muted,
                      border: `1px solid ${T.border}`, borderRadius: 999,
                      padding: "9px 22px", fontSize: 12, cursor: "pointer",
                    }}>
              Fechar (Esc)
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function KpiHero({ value, mom, hidden, evolucao }) {
  const bg = "linear-gradient(135deg, #0d2818 0%, #1a3a26 100%)";
  return (
    <div style={{ background: bg, color: "#fff", borderRadius: 12, padding: 14, position: "relative", overflow: "hidden", minHeight: 110 }}>
      <div style={{ fontSize: 11, color: "#86efac", letterSpacing: ".03em" }}>Patrimônio Total</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 700, marginTop: 6 }}>{hidden ? "•••••" : fmt(value)}</div>
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
    <Card style={{ position: "relative", minHeight: 110 }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, marginTop: 6, color: T.ink }}>{value}</div>
      {varStr && (
        <div style={{ fontSize: 11, color: positive ? T.green : T.red, marginTop: 4 }}>{varStr}</div>
      )}
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sub}</div>}
      {Icon && (
        <div style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", background: `${cor || T.gold}1f`, display: "grid", placeItems: "center" }}>
          <Icon size={16} style={{ color: cor || T.gold }} />
        </div>
      )}
    </Card>
  );
}

function DespesasKpiBlock({ resumo, hidden }) {
  const { total = 0, pagas = 0, aPagar = 0, deltaPct = null } = resumo || {};
  const linhas = [
    { l: "Desp. total",    v: total,  c: T.ink },
    { l: "Desp. paga",     v: pagas,  c: T.green },
    { l: "Desp. a pagar",  v: aPagar, c: T.red },
  ];
  // Em despesa, gastar MAIS é ruim (vermelho); gastar menos é bom (verde).
  const piorou = deltaPct != null && deltaPct > 0;
  return (
    <Card style={{ minHeight: 110 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, color: T.muted }}>Despesas este mês</span>
        {deltaPct != null ? (
          <span title="vs mês anterior" style={{ fontSize: 10.5, fontWeight: 700, color: piorou ? T.red : T.green, whiteSpace: "nowrap" }}>
            {piorou ? "▲" : "▼"} {fmtN(Math.abs(deltaPct), 0)}% <span style={{ color: T.faint, fontWeight: 500 }}>vs mês ant.</span>
          </span>
        ) : <TrendingDown size={14} style={{ color: T.red }} />}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {linhas.map(x => (
          <div key={x.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 11, color: T.muted }}>{x.l}</span>
            <span className="num" style={{ fontFamily: T.serif, fontSize: 15.5, fontWeight: 700, color: x.c, whiteSpace: "nowrap" }}>
              {hidden ? "•••" : fmt(x.v)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ContasCard({ contas, hidden, onContaClick, onSeeAll }) {
  return (
    <Card>
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
    </Card>
  );
}

function AlocacaoCard({ data, total, hidden, onSeeAll }) {
  return (
    <Card>
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
              <Pie data={data} dataKey="valor" cx="50%" cy="50%" innerRadius={48} outerRadius={70} stroke="none" cornerRadius={5} paddingAngle={2}>
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
    </Card>
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

function GastosCategoriaCard({ data, hidden, orcamento = 0, orcamentoAuto = false }) {
  const total = data.reduce((s,d) => s + d.valor, 0);
  return (
    <Card>
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
              <Pie data={data} dataKey="valor" cx="50%" cy="50%" innerRadius={45} outerRadius={65} stroke="none" cornerRadius={5} paddingAngle={2}>
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
      {orcamento > 0 && data.length > 0 && (() => {
        const pct = (total / orcamento) * 100;
        const restante = orcamento - total;
        // Limites manuais alertam cedo (80/100%). Já a média (3m) só alerta
        // quando o gasto fica claramente acima do normal (110/130%).
        const warnAt = orcamentoAuto ? 110 : 80;
        const dangerAt = orcamentoAuto ? 130 : 100;
        const cor = pct >= dangerAt ? T.red : pct >= warnAt ? T.gold : T.green;
        const titulo = orcamentoAuto ? "Gasto vs sua média (3 meses)" : "Orçamento do mês";
        const pctLabel = orcamentoAuto ? "da média" : "usado";
        return (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 5 }}>
              <span style={{ color: T.muted }}>{titulo}</span>
              <span style={{ color: cor, fontWeight: 600 }}>{fmtN(Math.min(pct, 999), 0)}% {pctLabel}</span>
            </div>
            <div style={{ height: 7, background: T.bgSoft, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", background: cor, borderRadius: 4, transition: "width .6s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.muted, marginTop: 5 }}>
              <span className="num">{hidden ? "•••" : fmt(total)} / {hidden ? "•••" : fmt(orcamento)}{orcamentoAuto ? " (média)" : ""}</span>
              <span className="num" style={{ color: restante >= 0 ? T.muted : T.red }}>
                {orcamentoAuto
                  ? (restante >= 0 ? `${hidden ? "•••" : fmt(restante)} abaixo da média` : `${hidden ? "•••" : fmt(-restante)} acima da média`)
                  : (restante >= 0 ? `Restam ${hidden ? "•••" : fmt(restante)}` : `Estourou ${hidden ? "•••" : fmt(-restante)}`)}
              </span>
            </div>
            {pct >= warnAt && (
              <div style={{
                marginTop: 8, padding: "6px 9px", borderRadius: 6,
                background: `${cor}1a`, border: `1px solid ${cor}44`, color: cor,
                fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
              }}>
                <AlertCircle size={12} /> {orcamentoAuto
                  ? (pct >= dangerAt ? "Bem acima da sua média de gastos." : "Acima da sua média de gastos.")
                  : (pct >= dangerAt ? "Orçamento do mês estourado." : "Perto do limite do orçamento.")}
              </div>
            )}
            {orcamentoAuto && (
              <div style={{ fontSize: 9.5, color: T.faint, marginTop: 6 }}>
                Base automática: média dos últimos 3 meses. Defina limites em Categorias para um orçamento próprio.
              </div>
            )}
          </div>
        );
      })()}
    </Card>
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

function AReceberCard({ devedores = [], aPagarHoje = [], hidden, onSeeAll, onVerPagar }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const fimSemana = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  })();
  const fimMes = (() => {
    const d = new Date();
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return ultimoDia.toISOString().slice(0, 10);
  })();

  const abertos = devedores.filter(d => !d.recebido);
  const total = abertos.reduce((s, d) => s + (Number(d.valor) || 0), 0);

  const atrasados = abertos.filter(d => d.vencimento && d.vencimento < hoje);
  const hojeArr   = abertos.filter(d => d.vencimento === hoje);
  const semana    = abertos.filter(d => d.vencimento && d.vencimento > hoje && d.vencimento <= fimSemana);
  const mes       = abertos.filter(d => d.vencimento && d.vencimento > fimSemana && d.vencimento <= fimMes);

  const somar = (arr) => arr.reduce((s, d) => s + (Number(d.valor) || 0), 0);

  const buckets = [
    { id: "atrasado", label: "Atrasados", icon: AlertCircle, cor: T.red,   itens: atrasados, valor: somar(atrasados) },
    { id: "hoje",     label: "Vence hoje", icon: Clock,       cor: T.gold,  itens: hojeArr,   valor: somar(hojeArr) },
    { id: "semana",   label: "Esta semana", icon: Calendar,   cor: T.blue || "#60a5fa", itens: semana, valor: somar(semana) },
    { id: "mes",      label: "Este mês",   icon: Calendar,    cor: T.green, itens: mes,       valor: somar(mes) },
  ];

  const proximos = abertos
    .filter(d => d.vencimento)
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
    .slice(0, 3);

  const formatarVenc = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    } catch { return iso; }
  };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HandCoins size={16} style={{ color: T.gold }} />
          <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>A Receber</div>
        </div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>
          Ver tudo
        </button>
      </div>

      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: T.ink, lineHeight: 1.1 }}>
        {hidden ? "•••••" : fmt(total)}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
        {abertos.length} {abertos.length === 1 ? "recebível em aberto" : "recebíveis em aberto"}
      </div>

      {abertos.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: T.faint, fontStyle: "italic" }}>
          Nenhum recebível pendente.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            {buckets.map(b => {
              const Icon = b.icon;
              const ativo = b.itens.length > 0;
              return (
                <div key={b.id} style={{
                  background: ativo ? `${b.cor}11` : T.bgSoft,
                  border: `1px solid ${ativo ? `${b.cor}55` : T.border}`,
                  borderRadius: 8, padding: "8px 10px",
                  display: "flex", flexDirection: "column", gap: 2,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: ativo ? b.cor : T.faint, fontWeight: 600, letterSpacing: ".03em" }}>
                    <Icon size={10} /> {b.label}
                  </div>
                  <div className="num" style={{ fontSize: 13, fontWeight: 600, color: ativo ? T.ink : T.faint }}>
                    {hidden ? "•••" : (ativo ? fmt(b.valor) : "—")}
                  </div>
                  <div style={{ fontSize: 9.5, color: T.muted }}>
                    {b.itens.length} {b.itens.length === 1 ? "item" : "itens"}
                  </div>
                </div>
              );
            })}
          </div>

          {proximos.length > 0 && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
              <div style={{ fontSize: 9.5, color: T.faint, fontWeight: 600, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>
                Próximos vencimentos
              </div>
              {proximos.map(d => {
                const atrasado = d.vencimento < hoje;
                return (
                  <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 11.5 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                      <div style={{ color: T.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {d.nome}
                      </div>
                      <div style={{ fontSize: 9.5, color: atrasado ? T.red : T.muted }}>
                        {atrasado ? "atrasado · " : ""}{formatarVenc(d.vencimento)}
                      </div>
                    </div>
                    <div className="num" style={{ color: T.ink, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>
                      {hidden ? "•••" : fmt(Number(d.valor) || 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* A PAGAR vencendo HOJE — contas (fixas/parcelas/dívidas) que vencem hoje */}
      {aPagarHoje.length > 0 && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 9.5, color: T.red, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <AlertCircle size={11} /> A pagar hoje
            </div>
            <div className="num" style={{ fontSize: 12, fontWeight: 700, color: T.red }}>
              {hidden ? "•••" : fmt(aPagarHoje.reduce((s, p) => s + (Number(p.valor) || 0), 0))}
            </div>
          </div>
          {aPagarHoje.slice(0, 3).map(p => (
            <div key={p.id} onClick={onVerPagar} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 11.5, cursor: onVerPagar ? "pointer" : "default" }}>
              <div style={{ color: T.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                {p.nome}
              </div>
              <div className="num" style={{ color: T.red, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>
                {hidden ? "•••" : fmt(Number(p.valor) || 0)}
              </div>
            </div>
          ))}
          {aPagarHoje.length > 3 && (
            <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
              +{aPagarHoje.length - 3} {aPagarHoje.length - 3 === 1 ? "outra conta" : "outras contas"}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function ProjecaoCard({ projecao, patrimonio = 0, hidden }) {
  // Linha de projeção do patrimônio: parte do valor atual e soma o saldo
  // previsto de cada mês (tracejada = estimativa).
  const projPatrim = (() => {
    let acc = Number(patrimonio) || 0;
    const pts = [{ label: "Hoje", valor: acc }];
    projecao.forEach(p => { acc += Number(p.saldo) || 0; pts.push({ label: p.label, valor: acc }); });
    return pts;
  })();
  const fim = projPatrim[projPatrim.length - 1]?.valor ?? 0;
  const deltaTotal = fim - (Number(patrimonio) || 0);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
        <div style={{ fontSize: 10, letterSpacing: ".15em", color: T.muted, fontWeight: 600 }}>PROJEÇÃO · MESES A VENCER</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 10, cursor: "pointer", color: T.muted }}><FileText size={10}/>PDF</button>
          <button style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 4, fontSize: 10, cursor: "pointer", color: T.muted }}><BarChart3 size={10}/>CSV</button>
        </div>
      </div>
      {/* Projeção do patrimônio (tracejada = estimativa) */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: T.muted }}>Patrimônio projetado (6 meses)</span>
          <span className="num" style={{ fontSize: 12, fontWeight: 700, color: deltaTotal >= 0 ? T.green : T.red }}>
            {hidden ? "•••" : fmt(fim)} <span style={{ fontSize: 9.5, fontWeight: 500 }}>({deltaTotal >= 0 ? "+" : "−"}{hidden ? "•••" : fmt(Math.abs(deltaTotal))})</span>
          </span>
        </div>
        <div style={{ height: 96 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={projPatrim} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-proj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.blue || "#60a5fa"} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={T.blue || "#60a5fa"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 8.5, fill: T.muted }} interval={0} />
              <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }}
                       formatter={(v) => [hidden ? "•••" : fmt(v), "Projeção"]} />
              <Area type="monotone" dataKey="valor" stroke={T.blue || "#60a5fa"} strokeWidth={2}
                    strokeDasharray="5 4" fill="url(#grad-proj)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
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
    </Card>
  );
}

function MetasCard({ metas, hidden, onSeeAll }) {
  return (
    <Card>
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
    </Card>
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

/* ============ Top 3 do Dia (Agenda Pessoal) ============ */
function Top3DoDia({ agenda = [], onAbrir }) {
  const top3 = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    return agenda
      .filter(e => e.status !== "feito")
      .filter(e => e.data && e.data >= hoje)
      .sort((a, b) =>
        (a.data || "9999").localeCompare(b.data || "9999")
        || (a.horario || "23:59").localeCompare(b.horario || "23:59")
      )
      .slice(0, 3);
  }, [agenda]);

  if (top3.length === 0) return null;

  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.gold}55`,
      borderLeft: `4px solid ${T.gold}`,
      borderRadius: 10, padding: 14, marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.gold, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase" }}>
          🎯 Próximos compromissos
        </div>
        <button onClick={onAbrir}
          style={{ background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>
          Ver agenda
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {top3.map(ev => {
          const isHoje = ev.data === hoje;
          return (
            <div key={ev.id} style={{
              display: "flex", alignItems: "center", gap: 10, fontSize: 12.5,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: isHoje ? T.gold : T.muted, flexShrink: 0,
              }} />
              <div style={{ flex: 1, color: T.ink, fontWeight: isHoje ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {ev.titulo}
              </div>
              <div style={{ color: T.muted, fontSize: 11, flexShrink: 0 }}>
                {isHoje ? "hoje" : ev.data?.slice(8, 10) + "/" + ev.data?.slice(5, 7)}
                {ev.horario && ` · ${ev.horario}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
