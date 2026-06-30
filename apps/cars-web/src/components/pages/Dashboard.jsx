import React, { useMemo, useEffect, useState } from "react";
import { Wallet, Briefcase, TrendingUp, TrendingDown, Sparkles, ChevronRight, ArrowRight, FileText, BarChart3, PieChart as PieIcon, HandCoins, AlertCircle, Clock, Calendar, Plus } from "lucide-react";
import { CARD_SHADOW } from "../../lib/styles.js";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import BankIcon from "../ui/BankIcon.jsx";
import { MESES_UP as MESES_PT } from "../../lib/meses.js";
import { fmt, fmtN } from "../../lib/format.js";
import { somaContasBRL } from "../../lib/cambio.js";
import { gerarInsights } from "../../lib/intelligence.js";
import { calcMoMTransacoes } from "../../lib/mom.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { getKPIsMes, getDespesasDoMes, getAnualPorMes } from "../../lib/agregador.js";
import { calcOrcamentoCategorias } from "../../lib/orcamentos.js";
import { useLayout } from "../../lib/useLayout.js";
import { supabase } from "../../lib/supabase.js";
import Card from "../ui/Card.jsx";

// Paleta moderna e harmônica (tons mais suaves, sem primários puros gritando).
const CORES_CAT = ["#6366f1","#0ea5e9","#22c08b","#f5a623","#f0728a","#a78bfa","#2dd4bf","#fb923c","#94a3b8"];
// Cor única das barras horizontais do dashboard — teal estilo Optio.
const BAR_COR = "#4DD9C0";
const CLASS_LABEL = { acao: "Ações", fii: "FIIs", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs", cripto: "Cripto", rf: "Renda Fixa", tesouro: "Tesouro", cdb: "CDB", capitalSocial: "Capital Social", outro: "Outros" };
const CLASS_COR = { acao: "#f5a524", fii: "#10b981", stock: "#3b82f6", reit: "#0ea5e9", cripto: "#8b5cf6", rf: "#06b6d4", etf: "#fbbf24", tesouro: "#22c55e", cdb: "#14b8a6", capitalSocial: "#0d9488", outro: "#9ca3af" };

function greetingForTime() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

// Anima um número de 0 até `target` quando `active` vira true (easeOutCubic).
// Usado pra dar o efeito "count-up" ao revelar valores (Patrimônio, A Receber).
function useCountUp(target, active, dur = 650) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) { setVal(0); return; }
    const to = Number(target) || 0;
    let raf, start = null;
    const tick = (t) => {
      if (start == null) start = t;
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(to * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, dur]);
  return val;
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
  categorias, metas, cartoes = [], parcelamentos = [], devedores = [], dividas = [], cheques = [],
  fixas = [], fixaOcorrencias = [],
  agenda = [],
  patrimonioHistorico = [],
  escopoAtivo = "tudo",
  onTabChange, onContaClick, onQuickAction,
}) {
  const { isMobile } = useLayout();
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
  // Patrimônio conta só a parte Brasil dos investimentos. Ativos em dólar
  // (Stocks/REITs) ficam fora do total (decisão do usuário).
  const totalInvest = useMemo(() => ativos.reduce((s, a) => {
    const ehUSD = a.tipo === "stock" || a.tipo === "reit";
    return ehUSD ? s : s + Number(a.qtd||0) * Number(a.preco||0);
  }, 0), [ativos]);
  const patrimonio = totalContas + totalInvest;

  // ===== Patrimônio Total (card do painel) =====
  // Soma pedida: contas + a receber + investimento − a pagar, com A receber e
  // A pagar recortados pelo ANO CORRENTE (por vencimento). Contas e
  // investimentos entram pelo valor cheio atual (invest já convertido em R$).
  const anoAtual = hoje.getFullYear();
  // A receber: TODOS os recebíveis em aberto (independente do ano) — o que já
  // foi recebido (parcial ou total) não soma.
  const aReceber = useMemo(() => {
    return (devedores || []).reduce((s, d) => {
      if (d.recebido) return s;
      const rem = (Number(d.valor) || 0) - (Number(d.valorRecebido) || 0);
      return s + Math.max(0, rem);
    }, 0);
  }, [devedores]);
  // Cheques a receber (aguardando) — TODOS, independente do ano, entram no
  // patrimônio (são recebíveis garantidos). Respeita o escopo ativo.
  const chequesAReceber = useMemo(() => {
    const noEsc = (c) => escopoAtivo === "tudo" || (c.escopo || "pessoal") === escopoAtivo;
    return (cheques || []).reduce((s, c) =>
      (c.status === "aguardando" && noEsc(c)) ? s + (Number(c.valor) || 0) : s, 0);
  }, [cheques, escopoAtivo]);
  // aPagarAno e patrimonioTotal são calculados mais abaixo, após `stateAgg`.
  const receitasMes = useMemo(() => transacoes.filter(t => t.tipo === "receita" && ehMesAtual(t.data)).reduce((s,t) => s+Number(t.valor||0), 0), [transacoes, mesISO]);
  const despesasMes = useMemo(() => transacoes.filter(t => t.tipo === "despesa" && t.origem !== "fatura-pagamento" && ehMesAtual(t.data)).reduce((s,t) => s+Number(t.valor||0), 0), [transacoes, mesISO]);

  // "Despesas este mês" do card = total LANÇADO para o mês (competência):
  // fixas, variáveis, parcelas e dívidas com vencimento neste mês, mesmo que
  // já tenham sido pagas/antecipadas em outro mês. Usa o mesmo agregador do
  // Planejamento. (O `despesasMes` acima, em regime de caixa, segue sendo
  // usado só pro fluxo de patrimônio.)
  const stateAgg = useMemo(
    () => ({ transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques }),
    [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques]
  );
  // A pagar do ano: compromissos pendentes/atrasados (fixas, variáveis, parcelas
  // e dívidas) do MÊS CORRENTE em diante. Meses já fechados (passados) não somam
  // — o que já passou/pagou já está refletido no saldo. Mesma regra do "riscado
  // não soma" do Relatório.
  const aPagarAno = useMemo(() => {
    try {
      const anual = getAnualPorMes(anoAtual, stateAgg, escopoAtivo);
      return anual
        .filter(mo => mo.status !== "fechado")
        .reduce((s, mo) => s + mo.despesas
          .filter(d => d.status === "pendente" || d.status === "atrasada")
          .reduce((ss, d) => ss + (Number(d.valor) || 0), 0), 0);
    } catch { return 0; }
  }, [anoAtual, stateAgg, escopoAtivo]);
  const patrimonioTotal = totalContas + totalInvest + aReceber + chequesAReceber - aPagarAno;
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
      nome: k, valor: v, pct: (v/tot)*100, cor: CORES_CAT[i % CORES_CAT.length],
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

  // ===== Evolução do patrimônio (mês a mês YTD) =====
  const evolucao = useMemo(() => {
    const arr = [];
    // Saldo de partida real (saldoInicial das contas) + fluxo acumulado de
    // transações até o fim de cada mês. Rolling dos ÚLTIMOS 12 MESES, então a
    // curva sempre mostra uma tendência real (não zera no começo do ano).
    const saldoBase = contas.reduce((s, c) => s + Number(c.saldoInicial != null ? c.saldoInicial : (c.saldo || 0)), 0);
    for (let i = 11; i >= 0; i--) {
      const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() - i + 1, 0); // último dia do mês
      const limite = `${fimMes.getFullYear()}-${String(fimMes.getMonth() + 1).padStart(2, "0")}-${String(fimMes.getDate()).padStart(2, "0")}`;
      const fluxo = transacoes
        .filter(t => (t.data || "") <= limite)
        .reduce((s, t) => s + (t.tipo === "receita" ? Number(t.valor || 0) : -Number(t.valor || 0)), 0);
      arr.push({ mes: MESES_PT[fimMes.getMonth()], saldo: saldoBase + fluxo + totalInvest });
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
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques };
    let desp = [];
    try { desp = getDespesasDoMes(mesISO, state, escopoAtivo); } catch {}
    return desp
      .filter(d => d.status !== "paga" && (d.data || "").slice(0, 10) === hoje)
      .map(d => ({ id: d.id, nome: d.descricao, valor: Number(d.valor) || 0 }));
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, escopoAtivo]);

  // ===== Contas a PAGAR do mês (total + qtd) — pendentes/atrasadas =====
  const aPagarMes = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques };
    let desp = [];
    try { desp = getDespesasDoMes(mesISO, state, escopoAtivo); } catch {}
    const ap = desp.filter(d => d.status !== "paga");
    return { total: ap.reduce((s, d) => s + (Number(d.valor) || 0), 0), qtd: ap.length };
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, escopoAtivo, mesISO]);

  // ===== Próximo compromisso a pagar (mais próximo por vencimento) =====
  // Olha o mês corrente + o próximo. Prioriza o próximo a vencer (>= hoje);
  // se não houver, mostra o atrasado mais recente.
  const proximoCompromisso = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques };
    const hojeISO = hoje.toISOString().slice(0, 10);
    const [yy, mm] = mesISO.split("-").map(Number);
    const prox = new Date(yy, mm, 1);
    const proxISO = `${prox.getFullYear()}-${String(prox.getMonth() + 1).padStart(2, "0")}`;
    let cand = [];
    for (const m of [mesISO, proxISO]) {
      try { cand = cand.concat(getDespesasDoMes(m, state, escopoAtivo).filter(d => d.status !== "paga")); } catch {}
    }
    const futuros = cand.filter(d => (d.data || "") >= hojeISO).sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    const atrasados = cand.filter(d => (d.data || "") < hojeISO).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    const pick = futuros[0] || atrasados[0];
    if (!pick) return null;
    return { nome: pick.descricao, valor: Number(pick.valor) || 0, data: pick.data, atrasado: (pick.data || "") < hojeISO };
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, escopoAtivo, mesISO]);

  // ===== Projeção próximos 6 meses =====
  const projecao = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques };
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
    <div className="fade-up" style={{ paddingTop: 12 }}>

      {/* Faixa de atalhos rápidos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: 10, marginBottom: 16 }}>
        {[
          { lbl: "Nova transação", icon: Plus, cor: T.gold, on: () => (onQuickAction ? onQuickAction("transacao") : onTabChange?.("transacoes")) },
          { lbl: "Novo cheque", icon: FileText, cor: T.green, on: () => onTabChange?.("cheques") },
          { lbl: "Conferir banco", icon: Wallet, cor: T.blue || "#60a5fa", on: () => onTabChange?.("contas") },
        ].map(a => {
          const I = a.icon;
          return (
            <button key={a.lbl} onClick={a.on}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
                boxShadow: CARD_SHADOW, cursor: "pointer", textAlign: "left",
                color: T.ink, fontWeight: 600, fontSize: 13,
              }}>
              <span style={{ width: 34, height: 34, borderRadius: 11, background: `${a.cor}1f`, color: a.cor, display: "grid", placeItems: "center", flexShrink: 0 }}>
                <I size={17} />
              </span>
              {a.lbl}
            </button>
          );
        })}
      </div>

      {/* Top 3 do dia */}
      <Top3DoDia agenda={agenda} onAbrir={() => onTabChange?.("notas")} />

      {/* KPI row */}
      <section className="dash-kpi-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <KpiHero value={patrimonioTotal} mom={momPatrim} hidden={hidden} evolucao={evolucao}
                 breakdown={{ contas: totalContas, aReceber: aReceber, cheques: chequesAReceber, invest: totalInvest, aPagar: aPagarAno }} />
        <ProximoCompromissoCard item={proximoCompromisso} total={aPagarMes} hidden={hidden} onVer={() => onTabChange?.("despesas")} />
      </section>


      {/* Contas · Alocação Atual · Gastos por Categoria (Alocação antes de Gastos) */}
      <section className="dash-mid-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <ContasCard contas={contas} hidden={hidden} onContaClick={onContaClick} onSeeAll={() => onTabChange?.("contas")} />
        <AlocacaoCard data={alocacao} total={totalInvest} hidden={hidden} onSeeAll={() => onTabChange?.("investimentos")} />
        <GastosCategoriaCard data={gastosCat} hidden={hidden} orcamento={orcamentoBase} orcamentoAuto={orcamentoAuto} />
      </section>

      {/* A Receber + Projeção */}
      <section className="dash-bot-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <AReceberCard devedores={devedores} aPagarHoje={aPagarHoje} aPagarMes={aPagarMes} hidden={hidden}
          onSeeAll={() => onTabChange?.("areceber")}
          onVerPagar={() => onTabChange?.("areceber")} />
        <ProjecaoCard projecao={projecao} patrimonio={patrimonio} hidden={hidden} />
      </section>

      {/* Metas + Pergunte IA */}
      <section className="dash-metas-grid" style={{
        display: "grid", gridTemplateColumns: "2.5fr 1fr", gap: 12, marginBottom: 24,
      }}>
        <MetasCard metas={metas || []} hidden={hidden} onSeeAll={() => onTabChange?.("metas")} />
        {principalInsight && <InsightsCard insight={principalInsight} onSeeAll={() => onTabChange?.("inteligencia")} />}
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

function KpiHero({ value, mom, hidden, evolucao, breakdown }) {
  // Sempre começa oculto; só revela quando o usuário clica no card. O modo
  // privado global (hidden) tem prioridade e mantém oculto.
  const [revelado, setRevelado] = useState(false);
  const visivel = revelado && !hidden;
  const animado = useCountUp(value, visivel);
  const bg = "linear-gradient(135deg, #0d2818 0%, #1a3a26 100%)";
  const Linha = ({ rotulo, v, sinal }) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>
      <span>{rotulo}</span>
      <span className="num">{sinal === "-" ? "− " : sinal === "+" ? "+ " : ""}{fmt(v)}</span>
    </div>
  );
  return (
    <div onClick={() => setRevelado(v => !v)}
         title={visivel ? "Toque para ocultar" : "Toque para ver"}
         style={{ background: bg, color: "#fff", borderRadius: 18, padding: 14, position: "relative", overflow: "hidden", minHeight: 110, cursor: "pointer", userSelect: "none" }}>
      <div style={{ fontSize: 11, color: "#86efac", letterSpacing: ".03em" }}>Patrimônio Total</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 24, fontWeight: 700, marginTop: 6 }}>{visivel ? fmt(animado) : "••••••"}</div>
      <div style={{ fontSize: 11, color: "#86efac", marginTop: 4 }}>
        {visivel ? (
          <>{mom >= 0 ? "↗" : "↘"} {fmtN(mom, 2)}%
          <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: 4 }}>vs mês anterior</span></>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.55)" }}>toque para revelar</span>
        )}
      </div>
      {visivel && breakdown && (
        <div style={{ position: "relative", zIndex: 1, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.15)", display: "flex", flexDirection: "column", gap: 2 }}>
          <Linha rotulo="Contas" v={breakdown.contas} sinal="+" />
          <Linha rotulo="A receber" v={breakdown.aReceber} sinal="+" />
          {breakdown.cheques > 0 && <Linha rotulo="Cheques a receber" v={breakdown.cheques} sinal="+" />}
          <Linha rotulo="Investimentos (Brasil)" v={breakdown.invest} sinal="+" />
          <Linha rotulo="A pagar (ano)" v={breakdown.aPagar} sinal="-" />
        </div>
      )}
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

function ProximoCompromissoCard({ item, total, hidden, onVer }) {
  const fmtData = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
    catch { return iso; }
  };
  const temTotal = total && total.qtd > 0;
  return (
    <Card style={{ minHeight: 110, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
        <AlertCircle size={13} style={{ color: T.gold }} /> Próximo compromisso
      </div>
      {item ? (
        <>
          <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, marginTop: 6, color: T.ink }}>
            {hidden ? "•••••" : fmt(item.valor)}
          </div>
          <div style={{ fontSize: 11, color: item.atrasado ? T.red : T.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.nome} · {item.atrasado ? "atrasado" : fmtData(item.data)}
          </div>
          {temTotal && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 10.5, color: T.muted }}>
                Total a pagar · mês ({total.qtd})
              </span>
              <span className="num" style={{ fontSize: 13, fontWeight: 700, color: T.red }}>
                {hidden ? "•••" : fmt(total.total)}
              </span>
            </div>
          )}
          <button onClick={onVer} style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>
            Ver
          </button>
        </>
      ) : (
        <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic", marginTop: 8 }}>Nenhum compromisso próximo.</div>
      )}
    </Card>
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

// Cores de marca + sigla por instituição, pra dar cara de "ícone do banco"
// no badge da conta (sem depender de logos externos). Cai no c.cor se não
// reconhecer o banco.
const BANCOS = [
  { re: /nubank|\bnu\b/i,            bg: "#820ad1", label: "Nu" },
  { re: /inter/i,                    bg: "#ec7000", label: "in" },
  { re: /\bxp\b/i,                   bg: "#0f1b2d", label: "XP" },
  { re: /ita[uú]/i,                  bg: "#ec7000", label: "It" },
  { re: /bradesco/i,                 bg: "#cc092f", label: "Br" },
  { re: /santander/i,                bg: "#ec0000", label: "Sa" },
  { re: /caixa/i,                    bg: "#1c5fab", label: "Cx" },
  { re: /banco do brasil|\bbb\b/i,   bg: "#f9dd16", fg: "#1a1a1a", label: "BB" },
  { re: /\bc6\b/i,                   bg: "#1a1a1a", label: "C6" },
  { re: /mercado ?pago/i,            bg: "#00b1ea", label: "MP" },
  { re: /picpay/i,                   bg: "#21c25e", label: "Pp" },
  { re: /btg/i,                      bg: "#0b2239", label: "BTG" },
  { re: /sicoob/i,                   bg: "#003641", label: "Sc" },
  { re: /sicredi/i,                  bg: "#3a9447", label: "Si" },
  { re: /carteira|dinheiro|esp[eé]cie/i, bg: "#4b5563", label: "$" },
];
function bancoBadge(c) {
  const txt = `${c?.instituicao || ""} ${c?.nome || ""}`;
  const hit = BANCOS.find(b => b.re.test(txt));
  if (hit) return { bg: hit.bg, fg: hit.fg || "#fff", label: hit.label };
  const base = (c?.instituicao || c?.nome || "?").trim();
  return { bg: c?.cor || T.gold, fg: "#fff", label: (base.slice(0, 2) || "?").toUpperCase() };
}

function ContasCard({ contas, hidden, onContaClick, onSeeAll }) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Contas</div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Ver todas</button>
      </div>
      {/* Mini-pastas — versão compacta dos folder cards roxos da tela de Contas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {contas.slice(0, 4).map(c => (
          <button key={c.id} onClick={() => onContaClick?.(c)}
            style={{ position: "relative", paddingTop: 6, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
            {/* aba da pasta */}
            <div aria-hidden style={{ position: "absolute", top: 0, left: "30%", right: "12%", height: 9, borderRadius: "6px 6px 0 0", background: "#5a4a93", opacity: .85 }} />
            <div style={{ position: "relative", background: "linear-gradient(155deg, #3a2d63 0%, #271f4a 100%)", color: "#f3f0fb", borderRadius: 12, padding: "9px 10px", boxShadow: "0 6px 16px rgba(20,12,40,.2)" }}>
              <BankIcon c={c} size={26} />
              <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
              <div className="num" style={{ fontFamily: T.serif, fontSize: 12.5, color: c.saldo < 0 ? "#ff9d9d" : "#f3f0fb", whiteSpace: "nowrap" }}>
                {hidden ? "•••" : fmt(c.saldo, c.moeda || "BRL")}
              </div>
            </div>
          </button>
        ))}
        {contas.length === 0 && (
          <div style={{ gridColumn: "1 / -1", padding: 16, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>Sem contas cadastradas.</div>
        )}
      </div>
    </Card>
  );
}

function ResumoMesCard({ mesNome, receitas, despesas, gastosCat, hidden }) {
  const sobra = receitas - despesas;
  const top = gastosCat?.[0];
  const titulo = String(mesNome || "").toLowerCase().replace(/^./, (c) => c.toUpperCase());
  const Stat = ({ label, valor, cor }) => (
    <div style={{ minWidth: 110 }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 17, fontWeight: 700, color: cor || T.ink, marginTop: 1, whiteSpace: "nowrap" }}>{valor}</div>
    </div>
  );
  return (
    <Card>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Resumo de {titulo}</div>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Stat label="Receitas" valor={hidden ? "•••" : `+ ${fmt(receitas)}`} cor={T.green} />
        <Stat label="Despesas" valor={hidden ? "•••" : `− ${fmt(despesas)}`} cor={T.red} />
        <Stat label="Sobrou" valor={hidden ? "•••" : `${sobra >= 0 ? "+ " : "− "}${fmt(Math.abs(sobra))}`} cor={sobra >= 0 ? T.green : T.red} />
        {top && (
          <div style={{ minWidth: 140 }}>
            <div style={{ fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Maior gasto</div>
            <div style={{ fontSize: 13, color: T.ink, fontWeight: 600, marginTop: 3, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
              {top.cor && <span style={{ width: 8, height: 8, borderRadius: 2, background: top.cor }} />}
              {top.nome} <span className="num" style={{ color: T.muted, fontWeight: 500 }}>· {hidden ? "•••" : fmt(top.valor)}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function OrcamentoCard({ categorias, transacoes, mesISO, hidden, onTabChange }) {
  const itens = useMemo(() => calcOrcamentoCategorias(categorias, transacoes, mesISO), [categorias, transacoes, mesISO]);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Orçamento por categoria</div>
        <button onClick={() => onTabChange?.("categorias")} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Editar</button>
      </div>
      {itens.length === 0 ? (
        <div style={{ padding: 14, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>
          Nenhum orçamento definido.{" "}
          <button onClick={() => onTabChange?.("categorias")} style={{ background: "transparent", border: "none", color: T.gold, cursor: "pointer", fontWeight: 600 }}>Definir em Categorias →</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {itens.map(c => {
            const cor = c.estado === "estourado" ? T.red : c.estado === "alerta" ? T.gold : T.green;
            const w = Math.min(100, c.pct);
            return (
              <div key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: T.ink, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.estado !== "ok" && <AlertCircle size={12} style={{ color: cor, flexShrink: 0 }} />}
                    {c.cor && <span style={{ width: 8, height: 8, borderRadius: 2, background: c.cor, flexShrink: 0 }} />}
                    {c.nome}
                  </span>
                  <span className="num" style={{ fontSize: 10.5, color: cor, fontWeight: 700, flexShrink: 0 }}>{Math.round(c.pct)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 6, background: T.bgSoft, overflow: "hidden" }}>
                  <div style={{ width: `${w}%`, height: "100%", borderRadius: 6, background: cor, transition: "width .4s ease" }} />
                </div>
                <div style={{ fontSize: 9.5, color: T.muted, marginTop: 3 }}>
                  {hidden ? "•••" : `${fmt(c.gasto)} de ${fmt(c.limite)}`}
                  {c.estado === "estourado" ? " · estourou" : c.estado === "alerta" ? " · quase no limite" : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
      <>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
          <span style={{ fontSize: 9, color: T.muted, letterSpacing: ".15em" }}>TOTAL</span>
          <span className="num" style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: T.ink }}>{hidden ? "•••" : fmt(total)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {data.map((d,i) => {
            const w = (d.valor / (data[0]?.valor || 1)) * 100;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 92, flexShrink: 0, fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 6, background: T.bgSoft, overflow: "hidden" }}>
                  <div style={{ width: `${w}%`, height: "100%", borderRadius: 6, background: BAR_COR, transition: "width .5s ease" }} />
                </div>
                <span style={{ width: 32, textAlign: "right", flexShrink: 0, fontSize: 10.5, color: T.ink }}>{fmtN(d.pct, 0)}%</span>
                <span className="num" style={{ width: 78, textAlign: "right", flexShrink: 0, fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(d.valor)}</span>
              </div>
            );
          })}
        </div>
      </>
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
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {data.slice(0, 6).map((d,i) => {
          const w = (d.valor / (data[0]?.valor || 1)) * 100;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 92, flexShrink: 0, fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nome}</span>
              <div style={{ flex: 1, height: 8, borderRadius: 6, background: T.bgSoft, overflow: "hidden" }}>
                <div style={{ width: `${w}%`, height: "100%", borderRadius: 6, background: BAR_COR, transition: "width .5s ease" }} />
              </div>
              <span style={{ width: 32, textAlign: "right", flexShrink: 0, fontSize: 10.5, color: T.ink }}>{fmtN(d.pct, 0)}%</span>
              <span className="num" style={{ width: 78, textAlign: "right", flexShrink: 0, fontSize: 11, color: T.muted, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(d.valor)}</span>
            </div>
          );
        })}
      </div>
      )}
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

function AReceberCard({ devedores = [], aPagarHoje = [], aPagarMes = null, hidden, onSeeAll, onVerPagar }) {
  // Total a receber começa oculto (•••); clica pra revelar — igual ao Patrimônio.
  const [mostrarTotal, setMostrarTotal] = useState(false);
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
  const totalAnimado = useCountUp(total, mostrarTotal && !hidden);

  const atrasados = abertos.filter(d => d.vencimento && d.vencimento < hoje);
  const hojeArr   = abertos.filter(d => d.vencimento === hoje);
  const semana    = abertos.filter(d => d.vencimento && d.vencimento > hoje && d.vencimento <= fimSemana);
  const mes       = abertos.filter(d => d.vencimento && d.vencimento > fimSemana && d.vencimento <= fimMes);

  const somar = (arr) => arr.reduce((s, d) => s + restanteDe(d), 0);

  const buckets = [
    { id: "atrasado", label: "Atrasados", icon: AlertCircle, cor: T.red,   qtd: atrasados.length, valor: somar(atrasados) },
    { id: "hoje",     label: "Vence hoje", icon: Clock,       cor: T.gold,  qtd: hojeArr.length,   valor: somar(hojeArr) },
    { id: "semana",   label: "Esta semana", icon: Calendar,   cor: T.blue || "#60a5fa", qtd: semana.length, valor: somar(semana) },
    { id: "apagar",   label: "A pagar · mês", icon: AlertCircle, cor: T.red, qtd: aPagarMes?.qtd || 0, valor: aPagarMes?.total || 0 },
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

      <div className="num" onClick={() => setMostrarTotal(v => !v)}
        title={mostrarTotal ? "Toque para ocultar" : "Toque para ver"}
        style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, color: T.ink, lineHeight: 1.1, cursor: "pointer", userSelect: "none" }}>
        {(mostrarTotal && !hidden) ? fmt(totalAnimado) : "•••••"}
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
              const ativo = b.qtd > 0;
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
                    {b.qtd} {b.qtd === 1 ? "item" : "itens"}
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
                      {hidden ? "•••" : fmt(restanteDe(d))}
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

// Anel de progresso (gauge radial) com o % no centro.
function GaugeRing({ pct = 0, size = 54, cor = T.gold }) {
  const r = 22, circ = 2 * Math.PI * r;
  const dash = Math.max(0, Math.min(100, pct)) / 100 * circ;
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" style={{ flexShrink: 0 }}>
      <circle cx="28" cy="28" r={r} fill="none" stroke={T.border} strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke={cor} strokeWidth="6" strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" fontSize="13" fontWeight="700" fill={T.ink}>{fmtN(pct, 0)}%</text>
    </svg>
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
          const cor = pct >= 100 ? T.green : T.gold;
          return (
            <div key={m.id} style={{ background: T.bgSoft, borderRadius: 14, padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <GaugeRing pct={pct} cor={cor} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.nome || m.titulo || "Meta"}</div>
                <div className="num" style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>
                  {hidden ? "•••" : fmt(atual)}
                </div>
                <div className="num" style={{ fontSize: 9.5, color: T.faint }}>
                  de {hidden ? "•••" : fmt(meta)}
                </div>
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
