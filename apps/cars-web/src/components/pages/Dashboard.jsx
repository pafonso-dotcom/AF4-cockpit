import React, { useMemo, useEffect, useState } from "react";
import { Wallet, Briefcase, TrendingUp, TrendingDown, Sparkles, ChevronRight, ArrowRight, FileText, BarChart3, PieChart as PieIcon, HandCoins, AlertCircle, AlertTriangle, Clock, Calendar } from "lucide-react";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { somaContasBRL } from "../../lib/cambio.js";
import { gerarInsights } from "../../lib/intelligence.js";
import { calcMoMTransacoes } from "../../lib/mom.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { getKPIsMes, getDespesasDoMes } from "../../lib/agregador.js";
import { supabase } from "../../lib/supabase.js";
import Card from "../ui/Card.jsx";

const MESES_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
// Paleta moderna e harmônica (tons mais suaves, sem primários puros gritando).
const CORES_CAT = ["#6366f1","#0ea5e9","#22c08b","#f5a623","#f0728a","#a78bfa","#2dd4bf","#fb923c","#94a3b8"];
// Gastos por categoria: paleta sequencial de uma única família (azul-céu), do
// claro ao escuro. Luminosidades relacionadas (sem neon aleatório) deixam o
// donut legível e elegante, reforçando "fatias da mesma coisa".
const CORES_GASTOS = ["#38BDF8","#0EA5E9","#0284C7","#0369A1","#075985","#0C4A6E"];
const CLASS_LABEL = { acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs", cripto: "Cripto", rf: "Renda Fixa", tesouro: "Tesouro", cdb: "CDB", capitalSocial: "Capital Social", outro: "Outros" };
const CLASS_COR = { acao: "#f5a524", fii: "#10b981", stock: "#3b82f6", reit: "#0ea5e9", cripto: "#8b5cf6", rf: "#06b6d4", etf: "#fbbf24", tesouro: "#22c55e", cdb: "#14b8a6", capitalSocial: "#0d9488", outro: "#9ca3af" };

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

  const totalContas = useMemo(() => somaContasBRL(contas), [contas]);
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
    return { total, pagas, aPagar, deltaPct, totalAnt };
  }, [stateAgg, mesISO, mesAnteriorISO, escopoAtivo]);

  // Saldo do mês (hero da Zona 2) = receitas − despesas previstas.
  const receitasMesAnterior = useMemo(() =>
    transacoes.filter(t => t.tipo === "receita" && (t.data || "").startsWith(mesAnteriorISO))
      .reduce((s, t) => s + Number(t.valor || 0), 0),
  [transacoes, mesAnteriorISO]);
  const saldoMes = receitasMes - despesasResumo.total;
  const saldoMesAnterior = receitasMesAnterior - (despesasResumo.totalAnt || 0);
  const saldoDeltaPct = saldoMesAnterior !== 0
    ? ((saldoMes - saldoMesAnterior) / Math.abs(saldoMesAnterior)) * 100
    : null;

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
  // Mesma base do card "Despesas este mês" e do módulo A Receber/Dívidas
  // (agregador, com fatura expandida + fixas/parcelas/dívidas). Assim o total do
  // donut BATE com o "Desp. total".
  const gastosCat = useMemo(() => {
    let desp = [];
    try { desp = getDespesasDoMes(mesISO, stateAgg, escopoAtivo); } catch {}
    const m = {};
    desp.forEach(d => { const k = d.categoria || "Outros"; m[k] = (m[k] || 0) + (Number(d.valor) || 0); });
    const tot = Object.values(m).reduce((s,v) => s+v, 0) || 1;
    return Object.entries(m).sort((a,b) => b[1]-a[1]).map(([k,v], i) => ({
      nome: k, valor: v, pct: (v/tot)*100, cor: CORES_GASTOS[i % CORES_GASTOS.length],
    }));
  }, [stateAgg, mesISO, escopoAtivo]);

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

  // ===== Zona 1 · Alerta crítico =====
  // Só dispara quando o gasto do mês passa de 1,5× a média dos últimos 3 meses.
  const alerta = useMemo(() => {
    const gastoMes = despesasResumo.total;
    const media = mediaDespesas3m;
    if (!(media > 0) || !(gastoMes > media * 1.5)) return null;
    return {
      gastoMes, media,
      diferenca: gastoMes - media,
      percentualAcima: ((gastoMes - media) / media) * 100,
    };
  }, [despesasResumo.total, mediaDespesas3m]);

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

      {/* Próximos compromissos — mantido logo abaixo da saudação */}
      <Top3DoDia agenda={agenda} onAbrir={() => onTabChange?.("notas")} />

      {/* ===== ZONA 1 · Alerta crítico (o que exige ação agora) ===== */}
      {alerta && (
        <AlertaBanner {...alerta} hidden={hidden} onVerGastos={() => onTabChange?.("transacoes")} />
      )}

      {/* ===== ZONA 2 · Fluxo do mês (o que entrou vs o que saiu) ===== */}
      <FluxoMes
        saldo={saldoMes} saldoDelta={saldoDeltaPct}
        receitas={receitasMes} receitasDelta={momReceitas}
        despesas={despesasResumo}
        hidden={hidden}
      />

      {/* ===== ZONA 3 · Onde está o dinheiro (snapshot patrimonial) ===== */}
      <PatrimonioSnapshot
        patrimonio={patrimonio} momPatrim={momPatrim} evolucao={evolucao}
        totalContas={totalContas} numContas={contas.length}
        totalInvest={totalInvest} rentInvest={rentInvest}
        hidden={hidden}
      />
      <section className="dash-z3-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <GastosCategoriaCard data={gastosCat} hidden={hidden} orcamento={orcamentoBase} orcamentoAuto={orcamentoAuto} />
        <AlocacaoCard data={alocacao} total={totalInvest} hidden={hidden} onSeeAll={() => onTabChange?.("investimentos")} />
      </section>
      <section style={{ marginBottom: 16 }}>
        <ContasCard contas={contas} hidden={hidden} onContaClick={onContaClick} onSeeAll={() => onTabChange?.("contas")} />
      </section>

      {/* ===== ZONA 4 · Projeção e contexto ===== */}
      <section className="dash-z4-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <ProjecaoCard projecao={projecao} patrimonio={patrimonio} hidden={hidden} />
        <AReceberCard devedores={devedores} aPagarHoje={aPagarHoje} hidden={hidden}
          onSeeAll={() => onTabChange?.("areceber")}
          onVerPagar={() => onTabChange?.("areceber")} />
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
          .dash-fluxo-grid, .dash-snap-grid, .dash-z3-grid, .dash-z4-grid, .dash-metas-grid { grid-template-columns: 1fr !important; }
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

/* ====================== ZONA 1 · Alerta crítico ====================== */
function AlertaBanner({ gastoMes, media, diferenca, percentualAcima, hidden, onVerGastos }) {
  const m = (v) => hidden ? "•••" : fmt(v);
  return (
    <div style={{
      background: `${T.red}14`, border: `1px solid ${T.red}55`, borderLeft: `4px solid ${T.red}`,
      borderRadius: 16, padding: 14, marginBottom: 16,
      display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: `${T.red}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <AlertTriangle size={20} style={{ color: T.red }} />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>
          Gastos {fmtN(percentualAcima, 0)}% acima da sua média histórica
        </div>
        <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>
          Este mês: <b className="num" style={{ color: T.red }}>{m(gastoMes)}</b>
          {" · "}média 3 meses: <span className="num">{m(media)}</span>
          {" · "}diferença: <span className="num" style={{ color: T.red, fontWeight: 600 }}>+{m(diferenca)}</span>
        </div>
      </div>
      <button onClick={onVerGastos} style={{
        background: T.red, color: "#fff", border: "none", borderRadius: 10,
        padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
      }}>
        Ver gastos →
      </button>
    </div>
  );
}

/* ====================== ZONA 2 · Fluxo do mês ====================== */
function FluxoMes({ saldo, saldoDelta, receitas, receitasDelta, despesas, hidden }) {
  const mono = T.mono || T.serif;
  const pos = saldo >= 0;
  const cor = pos ? T.green : T.red;
  const label = { fontSize: 11, textTransform: "uppercase", letterSpacing: ".12em", color: T.muted, fontWeight: 600 };
  const deltaStr = (n) => (n == null ? null : `${n >= 0 ? "↗ +" : "↘ "}${fmtN(Math.abs(n), 1)}%`);
  const { total = 0, pagas = 0, aPagar = 0 } = despesas || {};
  return (
    <section className="dash-fluxo-grid" style={{
      display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr", gap: 12, marginBottom: 16,
    }}>
      {/* Saldo do mês — hero da zona */}
      <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 138, borderLeft: `3px solid ${cor}` }}>
        <div style={label}>Saldo do Mês</div>
        <div className="num" style={{ fontFamily: mono, fontSize: 38, fontWeight: 700, color: cor, lineHeight: 1.05, marginTop: 8 }}>
          {hidden ? "•••••" : (pos ? "" : "− ") + fmt(Math.abs(saldo))}
        </div>
        {saldoDelta != null && (
          <div className="num" style={{ fontFamily: mono, fontSize: 12, color: saldoDelta >= 0 ? T.green : T.red, marginTop: 6 }}>
            {deltaStr(saldoDelta)} <span style={{ color: T.muted, fontWeight: 400 }}>vs mês anterior</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>Receitas − despesas previstas do mês</div>
      </Card>

      {/* Receitas */}
      <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 138 }}>
        <div style={label}>Receitas</div>
        <div className="num" style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: T.ink, marginTop: 8 }}>
          {hidden ? "•••••" : fmt(receitas)}
        </div>
        {receitasDelta != null && (
          <div className="num" style={{ fontFamily: mono, fontSize: 12, color: receitasDelta >= 0 ? T.green : T.red, marginTop: 6 }}>
            {deltaStr(receitasDelta)} <span style={{ color: T.faint, fontWeight: 400 }}>vs mês ant.</span>
          </div>
        )}
      </Card>

      {/* Despesas — pago vs a pagar (duas linhas empilhadas) */}
      <Card style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 138 }}>
        <div style={label}>Despesas</div>
        <div className="num" style={{ fontFamily: mono, fontSize: 22, fontWeight: 700, color: T.ink, marginTop: 8 }}>
          {hidden ? "•••••" : fmt(total)}
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11.5 }}>
            <span style={{ color: T.muted }}>Pago</span>
            <span className="num" style={{ fontFamily: mono, color: T.green }}>{hidden ? "•••" : fmt(pagas)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 11.5 }}>
            <span style={{ color: T.muted }}>A pagar</span>
            <span className="num" style={{ fontFamily: mono, color: aPagar > 0 ? T.red : T.muted }}>{hidden ? "•••" : fmt(aPagar)}</span>
          </div>
        </div>
      </Card>
    </section>
  );
}

/* ====================== ZONA 3 · Snapshot patrimonial ====================== */
function PatrimonioSnapshot({ patrimonio, momPatrim, evolucao, totalContas, numContas, totalInvest, rentInvest, hidden }) {
  const mono = T.mono || T.serif;
  const label = { fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em", color: T.muted, fontWeight: 600 };
  const valor = { fontFamily: mono, fontSize: 24, fontWeight: 700, color: T.ink, marginTop: 8 };
  const deltaStr = (n) => `${n >= 0 ? "↗ +" : "↘ "}${fmtN(Math.abs(n), 1)}%`;
  return (
    <section className="dash-snap-grid" style={{
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16,
    }}>
      {/* Patrimônio Total — com sparkline sutil */}
      <Card style={{ position: "relative", overflow: "hidden", minHeight: 120 }}>
        <div style={label}>Patrimônio Total</div>
        <div className="num" style={valor}>{hidden ? "•••••" : fmt(patrimonio)}</div>
        {momPatrim != null && (
          <div className="num" style={{ fontFamily: mono, fontSize: 11.5, color: momPatrim >= 0 ? T.green : T.red, marginTop: 6 }}>
            {deltaStr(momPatrim)} <span style={{ color: T.faint, fontWeight: 400 }}>vs mês ant.</span>
          </div>
        )}
        <div style={{ position: "absolute", right: 0, bottom: 0, left: 0, height: 34, opacity: 0.3, pointerEvents: "none" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={evolucao}>
              <defs>
                <linearGradient id="grad-snap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.green} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="saldo" stroke={T.green} fill="url(#grad-snap)" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Em Contas */}
      <Card style={{ minHeight: 120 }}>
        <div style={label}>Em Contas</div>
        <div className="num" style={valor}>{hidden ? "•••••" : fmt(totalContas)}</div>
        <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>
          {numContas} {numContas === 1 ? "conta ativa" : "contas ativas"}
        </div>
      </Card>

      {/* Investido */}
      <Card style={{ minHeight: 120 }}>
        <div style={label}>Investido</div>
        <div className="num" style={valor}>{hidden ? "•••••" : fmt(totalInvest)}</div>
        {rentInvest != null && (
          <div className="num" style={{ fontFamily: mono, fontSize: 11.5, color: rentInvest >= 0 ? T.green : T.red, marginTop: 6 }}>
            {deltaStr(rentInvest)} <span style={{ color: T.faint, fontWeight: 400 }}>rentabilidade</span>
          </div>
        )}
      </Card>
    </section>
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
            <div style={{ width: 32, height: 32, borderRadius: 14, background: c.cor || T.gold, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
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
    <div style={{ background: bg, color: "#fff", borderRadius: 18, padding: 16, display: "flex", flexDirection: "column" }}>
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
              style={{ background: "rgba(255,255,255,0.1)", border: `1px solid rgba(255,255,255,0.2)`, color: "#fff", padding: "8px 12px", borderRadius: 11, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
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
        <div style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 11, padding: "3px 8px" }}>Este mês</div>
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
                marginTop: 8, padding: "6px 9px", borderRadius: 11,
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
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Evolução do Patrimônio</div>
        <div style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 11, padding: "3px 8px" }}>Este ano</div>
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
  // Quanto ainda FALTA receber (desconta recebimentos parciais já feitos).
  const restanteDe = (d) => Math.max(0, (Number(d.valor) || 0) - (Number(d.valorRecebido) || 0));
  const total = abertos.reduce((s, d) => s + restanteDe(d), 0);

  // Contexto pro número grande (que é cumulativo): prazo médio até o vencimento
  // dos recebíveis em aberto, em dias. Desambigua "por que esse total é alto".
  const comVenc = abertos.filter(d => d.vencimento);
  const prazoMedio = comVenc.length
    ? Math.round(comVenc.reduce((s, d) => {
        const dias = (new Date(d.vencimento + "T00:00:00") - new Date(hoje + "T00:00:00")) / 86400000;
        return s + Math.max(0, dias);
      }, 0) / comVenc.length)
    : null;

  const atrasados = abertos.filter(d => d.vencimento && d.vencimento < hoje);
  const hojeArr   = abertos.filter(d => d.vencimento === hoje);
  const semana    = abertos.filter(d => d.vencimento && d.vencimento > hoje && d.vencimento <= fimSemana);
  const mes       = abertos.filter(d => d.vencimento && d.vencimento > fimSemana && d.vencimento <= fimMes);

  const somar = (arr) => arr.reduce((s, d) => s + restanteDe(d), 0);

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
      <div style={{ marginBottom: 12 }}>
        <span style={{
          display: "inline-block", fontSize: 10.5, color: T.muted,
          background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: "2px 9px",
        }}>
          {abertos.length} {abertos.length === 1 ? "conta em aberto" : "contas em aberto"}
          {prazoMedio != null ? ` · prazo médio: ${prazoMedio} ${prazoMedio === 1 ? "dia" : "dias"}` : ""}
        </span>
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
                  borderRadius: 14, padding: "8px 10px",
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
          <div key={p.label} style={{ background: T.bgSoft, borderRadius: 11, padding: 8, borderTop: `2px solid ${T.green}` }}>
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
            <div key={m.id} style={{ background: T.bgSoft, borderRadius: 14, padding: 10 }}>
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
                style={{ background: "transparent", border: `2px dashed ${T.border}`, borderRadius: 14, padding: 10, color: T.muted, fontSize: 12, cursor: "pointer", minHeight: 70 }}>
          + Nova Meta
        </button>
      </div>
    </Card>
  );
}

function PergunteIACard({ onClick }) {
  return (
    <button onClick={onClick}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ width: 36, height: 36, borderRadius: 14, background: `${T.green}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
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
      borderRadius: 16, padding: 14, marginBottom: 16,
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
