import React, { useMemo, useEffect, useState } from "react";
import { Wallet, Briefcase, TrendingUp, TrendingDown, Sparkles, ChevronRight, ArrowRight, ArrowUpRight, ArrowDownLeft, FileText, BarChart3, PieChart as PieIcon, HandCoins, AlertCircle, Clock, Calendar, CreditCard, Receipt, Plus, Eye, EyeOff } from "lucide-react";
import { CARD_SHADOW, AURORA_BG } from "../../lib/styles.js";
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../lib/theme.js";
import BankIcon from "../ui/BankIcon.jsx";
import { MESES_UP as MESES_PT } from "../../lib/meses.js";
import { fmt, fmtN , fmtAbrev } from "../../lib/format.js";
import { somaContasBRL, contasCambioDefasado } from "../../lib/cambio.js";
import { gerarInsights } from "../../lib/intelligence.js";
import { calcMoMTransacoes } from "../../lib/mom.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import { getKPIsMes, getDespesasDoMes, getGanhosDoMes } from "../../lib/agregador.js";
import { calcOrcamentoComGastos } from "../../lib/orcamentos.js";
import { montarResumoDia, alertasDisparadosHoje } from "../../lib/resumoDia.js";
import { proventosPendentesDoMes, lerProvReaisCache } from "../../lib/proventosPrevistos.js";
import { backupNuvemAtraso } from "../../lib/gistSync.js";
import { itensConsumoDoMes } from "../../lib/relatorioMensal.js";
import { useLayout } from "../../lib/useLayout.js";
import { OLHADA_KEY, hojeISOLocal, deveMostrarOlhada, dataPorExtenso } from "../../lib/olhadaRapida.js";
import { supabase } from "../../lib/supabase.js";
import { avulsasPendentesNoMes } from "../../lib/cartaoFatura.js";
import CalculadoraJurosModal from "../modals/CalculadoraJurosModal.jsx";
import { uid } from "../../lib/format.js";
import { calcOrcamentoCompra, resumoOrcamentos } from "../../lib/orcamentosFuturos.js";
import Card, { SoftCardContext } from "../ui/Card.jsx";
import { Sparkline, RingIcon } from "../ui/widget.jsx";

// Paleta moderna e harmônica (tons mais suaves, sem primários puros gritando).
const CORES_CAT = ["#6366f1","#0ea5e9","#22c08b","#f5a623","#f0728a","#a78bfa","#2dd4bf","#fb923c","#94a3b8"];
// Cor única das barras horizontais do dashboard — teal estilo Optio.
const BAR_COR = "#4DD9C0";
const CLASS_LABEL = { acao: "Ações", fii: "FIIs", fundo: "Fundos", stock: "Stocks (US)", reit: "REITs (US)", etf: "ETFs", cripto: "Cripto", rf: "Renda Fixa", tesouro: "Tesouro", cdb: "CDB", capitalSocial: "Capital Social", outro: "Outros" };
const CLASS_COR = { acao: "#f5a524", fii: "#10b981", fundo: "#a855f7", stock: "#3b82f6", reit: "#0ea5e9", cripto: "#8b5cf6", rf: "#06b6d4", etf: "#fbbf24", tesouro: "#22c55e", cdb: "#14b8a6", capitalSocial: "#0d9488", outro: "#9ca3af" };

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
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push({
      label: `${MESES_PT[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
      iso: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
    });
  }
  return out;
}

// Colapsável SÓ NO CELULAR (pedido 2026-09-22): no desktop renderiza os
// filhos direto; no mobile vira um cabeçalho que abre/fecha (fechado por
// padrão, escolha salva) — o Painel abre leve, sem rolagem infinita.
function MobileColapsavel({ id, titulo, isMobile, children }) {
  const KEY = "af4:dash-mob-abertos:v1";
  const [aberto, setAberto] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}")[id] === true; } catch { return false; }
  });
  if (!isMobile) return children;
  const toggle = () => setAberto(v => {
    const nv = !v;
    try {
      const m = JSON.parse(localStorage.getItem(KEY) || "{}");
      m[id] = nv;
      localStorage.setItem(KEY, JSON.stringify(m));
    } catch {}
    return nv;
  });
  return (
    <div>
      <button onClick={toggle}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "13px 16px", background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 16, cursor: "pointer", color: T.ink, textAlign: "left",
              }}>
        <span style={{ fontSize: 13.5, fontWeight: 700 }}>{titulo}</span>
        <span style={{ color: aberto ? T.gold : T.muted, fontSize: 13, transform: aberto ? "rotate(180deg)" : "none", transition: "transform .18s" }}>▼</span>
      </button>
      {aberto && <div style={{ marginTop: 10 }}>{children}</div>}
    </div>
  );
}

// Modo "olhada rápida" (item 5 do estudo mobile · 2026-09-22): tela cheia na
// PRIMEIRA abertura do dia no celular — saudação, saldo em contas e o Resumo
// do dia em letras grandes. Desliza pra cima (ou toca no botão) pra entrar.
function OlhadaRapida({ resumoDia, totalContas, hidden, userName, onFechar }) {
  const [saindo, setSaindo] = useState(false);
  const touchRef = React.useRef(null);
  const fechar = () => {
    if (saindo) return;
    setSaindo(true);
    setTimeout(onFechar, 280);
  };
  return (
    <div
      onTouchStart={(e) => { const t = e.touches?.[0]; if (t) touchRef.current = t.clientY; }}
      onTouchEnd={(e) => {
        const y0 = touchRef.current; touchRef.current = null;
        const t = e.changedTouches?.[0];
        if (y0 != null && t && (y0 - t.clientY) >= 60) fechar(); // arrastou pra CIMA
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 400, background: T.bg,
        display: "flex", flexDirection: "column", padding: "56px 22px 26px",
        overflowY: "auto", WebkitOverflowScrolling: "touch",
        transform: saindo ? "translateY(-100%)" : "translateY(0)",
        opacity: saindo ? 0 : 1, transition: "transform .28s ease, opacity .28s ease",
      }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: T.ink, lineHeight: 1.2 }}>
        {greetingForTime()}{userName ? `, ${userName}` : ""} 👋
      </div>
      <div style={{ fontSize: 13, color: T.muted, marginTop: 4, textTransform: "capitalize" }}>
        {dataPorExtenso()}
      </div>

      <div style={{
        marginTop: 22, background: T.card, border: `1px solid ${T.border}`,
        borderRadius: 18, padding: "16px 18px",
      }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>
          Saldo em contas
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: T.ink, marginTop: 4 }}>
          {hidden ? "•••••" : fmt(totalContas)}
        </div>
      </div>

      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        {resumoDia.length === 0 ? (
          <div style={{
            background: T.card, border: `1px solid ${T.border}`, borderRadius: 16,
            padding: "16px 18px", fontSize: 14.5, color: T.ink, fontWeight: 600,
          }}>
            ✨ Nada vencendo hoje — dia livre.
          </div>
        ) : resumoDia.map((a, i) => {
          const cor = a.cor === "red" ? T.red : a.cor === "green" ? T.green : T.gold;
          return (
            <div key={i} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              background: `${cor}12`, border: `1px solid ${cor}44`,
              borderRadius: 16, padding: "13px 16px",
              fontSize: 14.5, color: T.ink, fontWeight: 600, lineHeight: 1.35,
            }}>
              <span aria-hidden style={{ fontSize: 17 }}>{a.icone}</span>
              <span>{a.texto}</span>
            </div>
          );
        })}
      </div>

      <button onClick={fechar} style={{
        marginTop: 20, width: "100%", padding: "14px 0",
        background: "transparent", border: `1px solid ${T.border}`, borderRadius: 100,
        color: T.gold, fontSize: 13, fontWeight: 700, letterSpacing: ".04em", cursor: "pointer",
      }}>
        ↑ Deslize pra cima ou toque pra entrar
      </button>
    </div>
  );
}

export default function Dashboard({
  hidden, contas: contasRaw, ativos = [], transacoes: transacoesRaw,
  categorias, metas, cartoes = [], parcelamentos = [], devedores = [], dividas = [], cheques = [],
  orcamentosFuturos = [], setOrcamentosFuturos,
  carteiraProventos = { saldo: 0 },
  proventosRecebidos = {}, proventosIgnorados = {}, proventosManuais = [],
  fixas = [], fixaOcorrencias = [],
  agenda = [], lembretes = [], tarefas = [],
  patrimonioHistorico = [],
  escopoAtivo = "tudo",
  onTabChange, onContaClick, onQuickAction,
}) {
  const { isMobile } = useLayout();

  // Olhada rápida: só celular, só na primeira abertura do dia.
  const [olhadaAberta, setOlhadaAberta] = useState(false);
  useEffect(() => {
    if (!isMobile) return;
    try {
      if (deveMostrarOlhada(localStorage.getItem(OLHADA_KEY), hojeISOLocal())) setOlhadaAberta(true);
    } catch {}
  }, [isMobile]);
  const fecharOlhada = () => {
    try { localStorage.setItem(OLHADA_KEY, hojeISOLocal()); } catch {}
    setOlhadaAberta(false);
  };

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

  // Patrimônio Total sempre soma as contas do Negócio, mesmo com o seletor em
  // "Pessoal" — é o total geral do que você tem. O resto do Painel (receitas/
  // despesas do mês) segue o escopo ativo. (Decisão do usuário · 2026-07-06.)
  const totalContas = useMemo(() => somaContasBRL(contasRaw || []), [contasRaw]);
  // Patrimônio conta só a parte Brasil dos investimentos. Ativos em dólar
  // (Stocks/REITs) ficam fora do total (decisão do usuário).
  const totalInvest = useMemo(() => ativos.reduce((s, a) => {
    const ehUSD = a.tipo === "stock" || a.tipo === "reit";
    return ehUSD ? s : s + Number(a.qtd||0) * Number(a.preco||0);
  }, 0), [ativos]);
  // Investimentos em US$ (Stocks/REITs) — informativo na visão consolidada,
  // fora do total em R$ (decisão do usuário).
  const totalInvestUSD = useMemo(() => ativos.reduce((s, a) =>
    (a.tipo === "stock" || a.tipo === "reit") ? s + Number(a.qtd||0) * Number(a.preco||0) : s, 0), [ativos]);
  // Saldo da Carteira de Proventos — dinheiro real acumulado; entra no total.
  const provSaldo = Number(carteiraProventos?.saldo) || 0;
  const patrimonio = totalContas + totalInvest;

  // ===== Patrimônio Total (card do painel) =====
  // Soma: contas + a receber + cheques + investimento (Brasil, em R$) − TUDO
  // a pagar em aberto no sistema (todos os anos).
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
  // Cartões: total das parcelas de cartão ainda EM ABERTO (não pagas),
  // somando todos os meses — mesma base do "Cartões a pagar" do Planejamento.
  const cartoesTotal = useMemo(() => {
    return (parcelamentos || []).reduce((s, p) => {
      const total = p.totalParcelas || 0;
      if (total <= 0) return s;
      // Mesma fórmula dos cards de Cartões: valorParcela explícito quando
      // existe (senão valorTotal/total) — evita divergência por arredondamento.
      const valorPorParcela = Number(p.valorParcela) || (p.valorTotal || 0) / total;
      const pagas = (p.parcelasPagas || []).length;
      return s + valorPorParcela * Math.max(0, total - pagas);
    }, 0);
  }, [parcelamentos]);
  // Tile "Cartões": só o que está EM ABERTO. Prioriza o MÊS CORRENTE — fatura
  // importada paga = cartão quitado no mês (não conta); fatura em aberto entra
  // pelo valor real; sem fatura, contam as parcelas pendentes do mês. Se o mês
  // corrente estiver zerado (tudo pago), mostra o mês seguinte.
  const cartoesTile = useMemo(() => {
    const [y, m] = mesISO.split("-").map(Number);
    const nd = new Date(y, m, 1); // mês seguinte (m é 1-based do mês atual)
    const proxKey = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`;
    const soma = (key, rolagem = false) => {
      let total = 0;
      // Cartões com fatura importada da competência: cobrem o mês (paga → 0;
      // aberta → valor real). As parcelas desses cartões saem da conta.
      const cobertos = new Set();
      (cartoes || []).forEach(c => {
        const fi = c.faturaImportada;
        if (!fi || (fi.competencia && fi.competencia !== key)) return;
        cobertos.add(c.id);
        if (!fi.paga) total += Number(fi.valorTotal) || 0;
      });
      total += (parcelamentos || []).reduce((s, p) => {
        if (cobertos.has(p.cartaoId)) return s;
        const totalParc = p.totalParcelas || 0;
        if (totalParc <= 0) return s;
        const vpp = Number(p.valorParcela) || (p.valorTotal || 0) / totalParc;
        const pagas = new Set(p.parcelasPagas || []);
        const base = p.dataPrimeira || p.dataCompra;
        if (!base) return s;
        const [bY, bM] = base.split("-").map(Number);
        const start = p.dataPrimeira ? bM : bM + 1;
        for (let n = 1; n <= totalParc; n++) {
          if (pagas.has(n)) continue;
          const dt = new Date(bY, start - 1 + (n - 1), 1);
          const mm = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
          if (mm === key) s += vpp;
        }
        return s;
      }, 0);
      // Compras avulsas pendentes lançadas no app (manual/foto) — cartões sem
      // fatura importada da competência; sem isso a compra recém-lançada não
      // aparecia no tile. Com `rolagem` (mês seguinte), compras de competências
      // já fechadas/pagas rolam pra cá — como na próxima fatura do banco.
      (cartoes || []).forEach(c => {
        if (cobertos.has(c.id)) return;
        total += avulsasPendentesNoMes(c, transacoes, key, { incluirAnteriores: rolagem });
      });
      return total;
    };
    const nomeMes = (key) => (MESES_PT[parseInt(key.slice(5, 7), 10) - 1] || "").toLowerCase();
    const mesAtual = soma(mesISO);
    if (mesAtual > 0.005) return { valor: mesAtual, label: `Cartões · a pagar (${nomeMes(mesISO)})` };
    return { valor: soma(proxKey, true), label: `Cartões · mês seguinte (${nomeMes(proxKey)})` };
  }, [mesISO, parcelamentos, cartoes, transacoes]);
  // Total a pagar (tudo em aberto, todos os meses) — mesma base do "A Receber &
  // Dívidas": dívidas + fixas pendentes + parcelas de cartão + avulsas.
  const aPagarTotal = useMemo(() => {
    let s = 0;
    (dividas || []).filter(d => !d.pago).forEach(d => { s += Number(d.valor) || 0; });
    (fixaOcorrencias || []).filter(o => o.status === "pendente" && (fixas || []).some(f => f.id === o.fixaId))
      .forEach(o => { s += Number(o.valor) || 0; });
    s += cartoesTotal; // parcelas de cartão em aberto
    (transacoes || []).filter(t => t.tipo === "despesa" && !t.compensado
      && !t.origemFixaOcorrenciaId && !t.origemParcelamentoId)
      .forEach(t => { s += Number(t.valor) || 0; });
    return s;
  }, [dividas, fixaOcorrencias, fixas, cartoesTotal, transacoes]);
  // Total a pagar quebrado POR ANO (2026, 2027, …) — mesmos itens do
  // aPagarTotal, bucketados pelo vencimento/competência de cada um. Item sem
  // data cai em "sem data" (aparece por último).
  const aPagarPorAno = useMemo(() => {
    const anos = {};
    const add = (iso, v) => {
      const ano = String(iso || "").slice(0, 4);
      const key = /^\d{4}$/.test(ano) ? ano : "sem data";
      anos[key] = (anos[key] || 0) + v;
    };
    (dividas || []).filter(d => !d.pago).forEach(d => add(d.vencimento, Number(d.valor) || 0));
    (fixaOcorrencias || []).filter(o => o.status === "pendente" && (fixas || []).some(f => f.id === o.fixaId))
      .forEach(o => add(o.mes, Number(o.valor) || 0));
    (parcelamentos || []).forEach(p => {
      const total = p.totalParcelas || 0;
      if (total <= 0) return;
      const vpp = Number(p.valorParcela) || (p.valorTotal || 0) / total;
      const pagas = new Set(p.parcelasPagas || []);
      const base = p.dataPrimeira || p.dataCompra;
      if (!base) { add("", vpp * Math.max(0, total - pagas.size)); return; }
      const [bY, bM] = base.split("-").map(Number);
      const start = p.dataPrimeira ? bM : bM + 1; // sem dataPrimeira, 1ª parcela cai no mês seguinte à compra
      for (let n = 1; n <= total; n++) {
        if (pagas.has(n)) continue;
        const dt = new Date(bY, start - 1 + (n - 1), 1);
        add(String(dt.getFullYear()), vpp);
      }
    });
    (transacoes || []).filter(t => t.tipo === "despesa" && !t.compensado
      && !t.origemFixaOcorrenciaId && !t.origemParcelamentoId)
      .forEach(t => add(t.data, Number(t.valor) || 0));
    return Object.entries(anos)
      .sort(([a], [b]) => a.localeCompare(b)) // anos crescentes; "sem data" por último
      .map(([ano, valor]) => ({ ano, valor }));
  }, [dividas, fixaOcorrencias, fixas, parcelamentos, transacoes]);
  // patrimonioTotal é calculado mais abaixo, após `stateAgg`.
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
  // Séries mensais (6 meses à frente) para os sparklines do Centro de Controle.
  const sparks = useMemo(() => {
    const meses = [];
    const [y, m] = mesISO.split("-").map(Number);
    for (let i = 0; i < 6; i++) {
      const d = new Date(y, m - 1 + i, 1);
      meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const receber = [], pagar = [], cartoesS = [], chequesS = [];
    meses.forEach(iso => {
      let g = 0, d = 0;
      try { g = getGanhosDoMes(iso, stateAgg, escopoAtivo).filter(x => x.status !== "paga").reduce((s, x) => s + (Number(x.valor) || 0), 0); } catch {}
      try { d = getDespesasDoMes(iso, stateAgg, escopoAtivo).filter(x => x.status !== "paga").reduce((s, x) => s + (Number(x.valor) || 0), 0); } catch {}
      receber.push(g); pagar.push(d);
      const cart = (parcelamentos || []).reduce((s, p) => {
        const total = p.totalParcelas || 0;
        if (total <= 0) return s;
        const vpp = Number(p.valorParcela) || (p.valorTotal || 0) / total;
        const pagas = new Set(p.parcelasPagas || []);
        const base = p.dataPrimeira || p.dataCompra;
        if (!base) return s;
        const [bY, bM, bD] = base.split("-").map(Number);
        const start = p.dataPrimeira ? bM : bM + 1;
        for (let n = 1; n <= total; n++) {
          if (pagas.has(n)) continue;
          const dt = new Date(bY, start - 1 + (n - 1), 1);
          const mm = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
          if (mm === iso) s += vpp;
        }
        return s;
      }, 0);
      cartoesS.push(cart);
      chequesS.push((cheques || []).reduce((s, c) => (c.status === "aguardando" && (c.vencimento || "").slice(0, 7) === iso) ? s + (Number(c.valor) || 0) : s, 0));
    });
    return { receber, pagar, cartoes: cartoesS, cheques: chequesS };
  }, [mesISO, stateAgg, escopoAtivo, parcelamentos, cheques]);
  // Patrimônio REAL (pedido do usuário · 2026-09-01): desconta TUDO a pagar
  // lançado no sistema (todos os anos — mesma base do "Total a pagar" do
  // Centro de Controle), não só o ano corrente. A receber/cheques já entram
  // completos.
  // + saldo da Carteira de Proventos (dinheiro real que ficava fora do total).
  const patrimonioTotal = totalContas + provSaldo + totalInvest + aReceber + chequesAReceber - aPagarTotal;
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
    // BASE ÚNICA de consumo (itensConsumoDoMes): bancos + cartões unificados,
    // fatura importada aberta pelos itens — mesmos números da Análise do mês.
    let desp = [];
    try { desp = itensConsumoDoMes(mesISO, stateAgg, escopoAtivo) || []; } catch {}
    // Filha (parentId) soma dentro da mãe — mesmo roll-up da Análise do mês.
    const catPorId = {};
    (categorias || []).forEach(c => { if (c?.id) catPorId[c.id] = c; });
    const paiDe = {};
    (categorias || []).forEach(c => { if (c?.parentId && catPorId[c.parentId]) paiDe[c.nome] = catPorId[c.parentId].nome; });
    const m = {};
    desp.forEach(d => { const k0 = d.categoria || "Outros"; const k = paiDe[k0] || k0; m[k] = (m[k] || 0) + (Number(d.valor) || 0); });
    const tot = Object.values(m).reduce((s,v) => s+v, 0) || 1;
    return Object.entries(m).sort((a,b) => b[1]-a[1]).map(([k,v], i) => ({
      nome: k, valor: v, pct: (v/tot)*100, cor: CORES_CAT[i % CORES_CAT.length],
    }));
  }, [stateAgg, mesISO, escopoAtivo, categorias]);

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

  // ===== Projeção próximos 6 meses (inclui o mês corrente) =====
  // Só o que ainda está EM ABERTO (não pago/recebido) — o que já foi pago já
  // está refletido no saldo das contas; contá-lo de novo dobraria o valor.
  // Mesma regra usada em Relatórios (cenarios/abertoMes) e em getProjecaoSaldo.
  const projecao = useMemo(() => {
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques };
    return nextMonthsISO(6).map(m => {
      let desp = [], gan = [];
      try { desp = getDespesasDoMes(m.iso, state, escopoAtivo).filter(d => d.status !== "paga"); } catch {}
      try { gan = getGanhosDoMes(m.iso, state, escopoAtivo).filter(g => g.status !== "paga"); } catch {}
      const rec = gan.reduce((s, g) => s + (Number(g.valor) || 0), 0);
      const des = desp.reduce((s, d) => s + (Number(d.valor) || 0), 0);
      return { label: m.label, receita: rec, despesa: des, saldo: rec - des };
    });
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques, escopoAtivo]);

  const [calcJurosOpen, setCalcJurosOpen] = useState(false);

  // Resumo do dia: vence hoje · cartão fechando · orçamento apertado · alerta
  // de preço — tudo calculado localmente com dados que o Painel já tem.
  const resumoDia = useMemo(() => {
    let despesasMes = [];
    try { despesasMes = getDespesasDoMes(mesISO, stateAgg, escopoAtivo); } catch {}
    return montarResumoDia({
      despesasMes,
      cartoes,
      orcamentos: calcOrcamentoComGastos(categorias, gastosCat),
      alertasHoje: alertasDisparadosHoje(),
      proventosMes: proventosPendentesDoMes({
        ativos, proventosRecebidos, proventosIgnorados, proventosManuais,
        provReais: lerProvReaisCache(),
      }),
      backupAtraso: backupNuvemAtraso(),
      cambioDefasado: contasCambioDefasado(contasRaw).length,
      agendaHoje: (() => {
        const h = new Date();
        const hojeISO = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`;
        return {
          eventos: (agenda || []).filter(e => e && e.data === hojeISO && e.status !== "feito").length,
          lembretes: (lembretes || []).filter(l => l && !l.concluido && l.data === hojeISO).length,
          tarefas: (tarefas || []).filter(t => t && !t.concluida && t.prazo === hojeISO).length,
        };
      })(),
      fmt: (v) => (hidden ? "•••" : fmt(v)),
    });
  }, [mesISO, stateAgg, escopoAtivo, cartoes, categorias, gastosCat, hidden,
      ativos, proventosRecebidos, proventosIgnorados, proventosManuais,
      contasRaw, agenda, lembretes, tarefas]);

  // ===== Insights =====
  const insights = useMemo(() => {
    try { return gerarInsights(transacoes, contas, ativos, cartoes, parcelamentos) || []; }
    catch { return []; }
  }, [transacoes, contas, ativos, cartoes, parcelamentos]);
  const principalInsight = insights[0];

  return (
    <SoftCardContext.Provider value={true}>
    <div className="fade-up" style={{ paddingTop: 12 }}>

      {olhadaAberta && (
        <OlhadaRapida resumoDia={resumoDia} totalContas={totalContas} hidden={hidden}
                      userName={userName} onFechar={fecharOlhada} />
      )}

      {/* Top 3 do dia */}
      <Top3DoDia agenda={agenda} onAbrir={() => onTabChange?.("notas")} />

      {/* Calculadora de juros — botão do Painel (pedido 2026-09-19).
          No CELULAR ele sai (pedido 2026-09-22): ocupava o topo da tela;
          a calculadora continua acessível pelo menu lateral/módulos. */}
      {!isMobile && (
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button onClick={() => setCalcJurosOpen(true)}
                title="Juros simples ou compostos, com aporte mensal — calcula ao vivo"
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
                         background: T.card, border: `1px solid ${T.border}`, borderRadius: 100,
                         color: T.gold, fontSize: 11.5, fontWeight: 700, letterSpacing: ".04em",
                         cursor: "pointer" }}>
          🧮 Calculadora de juros
        </button>
      </div>
      )}
      {calcJurosOpen && <CalculadoraJurosModal onClose={() => setCalcJurosOpen(false)} />}

      {/* RESUMO DO DIA — uma olhada e o dia está decidido */}
      {resumoDia.length > 0 && (
        <div className="no-print" style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12,
        }}>
          {resumoDia.map((a, i) => {
            const cor = a.cor === "red" ? T.red : a.cor === "green" ? T.green : T.gold;
            return (
              <span key={i} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: `${cor}12`, border: `1px solid ${cor}44`,
                borderRadius: 100, padding: "6px 12px",
                fontSize: 12, color: T.ink, fontWeight: 600,
              }}>
                <span aria-hidden>{a.icone}</span> {a.texto}
              </span>
            );
          })}
        </div>
      )}

      {/* Linha 1: Patrimônio · Próximo compromisso · Contas */}
      <section className="dash-kpi-grid" style={{
        display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <KpiHero value={patrimonioTotal} mom={momPatrim} hidden={hidden} evolucao={evolucao} />
        <span className="dash-prox">
          <ProximosVencimentosCard devedores={devedores} hidden={hidden} onVer={() => onTabChange?.("areceber")} />
        </span>
        <ContasCard contas={contas} hidden={hidden} onContaClick={onContaClick} onSeeAll={() => onTabChange?.("contas")} />
      </section>

      {/* Calendário do mês · Centro de Controle */}
      <section className="dash-bot-grid" style={{
        display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <MobileColapsavel id="calendario" titulo="📅 Calendário do mês" isMobile={isMobile}>
          <CalendarioMesCard stateAgg={stateAgg} escopoAtivo={escopoAtivo} agenda={agenda} hidden={hidden} onVer={() => onTabChange?.("calendario")} />
        </MobileColapsavel>
        <AReceberCard devedores={devedores} aPagarHoje={aPagarHoje} aPagarMes={aPagarMes} aPagarTotal={aPagarTotal} aPagarPorAno={aPagarPorAno} chequesTotal={chequesAReceber} cartoesTotal={cartoesTotal} cartoesTile={cartoesTile} sparks={sparks} hidden={hidden}
          consolidado={{ contas: totalContas, proventos: provSaldo, investBR: totalInvest, investUSD: totalInvestUSD,
                         cartoes: cartoesTotal, liquido: totalContas + provSaldo + totalInvest - cartoesTotal }}
          onSeeAll={() => onTabChange?.("areceber")}
          onVerPagar={() => onTabChange?.("areceber")} />
      </section>

      {/* Projeção · 6 meses — acima de Alocação/Gastos (pedido do usuário) */}
      <section style={{ marginBottom: 16 }}>
        <MobileColapsavel id="projecao" titulo="📈 Projeção · 6 meses" isMobile={isMobile}>
          <ProjecaoMesesCard projecao={projecao} hidden={hidden} />
        </MobileColapsavel>
      </section>

      {/* Orçamentos · compras futuras — acima da Alocação (pedido do usuário) */}
      <section style={{ marginBottom: 16 }}>
        <OrcamentosFuturosCard itens={orcamentosFuturos} setItens={setOrcamentosFuturos} hidden={hidden} />
      </section>

      {/* Alocação Atual · Gastos por Categoria — abaixo da projeção.
          Quando empilha (mobile), Gastos sobe pra cima da Alocação. */}
      <section className="dash-mid-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <div className="dash-aloc" style={{ minWidth: 0 }}>
          <MobileColapsavel id="alocacao" titulo="📊 Alocação atual" isMobile={isMobile}>
            <AlocacaoCard data={alocacao} total={totalInvest} hidden={hidden} onSeeAll={() => onTabChange?.("investimentos")} />
          </MobileColapsavel>
        </div>
        <div className="dash-gastos" style={{ minWidth: 0 }}>
          <GastosCategoriaCard data={gastosCat} hidden={hidden} orcamento={orcamentoBase} orcamentoAuto={orcamentoAuto} />
        </div>
      </section>

      {/* Orçamento por categoria — gasto do mês vs limite definido em
          Categorias. Só aparece quando há pelo menos um limite. */}
      {calcOrcamentoComGastos(categorias, gastosCat).length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <OrcamentoCard categorias={categorias} gastos={gastosCat} hidden={hidden} onTabChange={onTabChange} />
        </section>
      )}

      {/* Insights + Pergunte IA (Orçamentos de compras futuras subiu pra
          cima da Alocação — pedido do usuário 2026-09-22) */}
      <section className="dash-metas-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24,
      }}>
        {principalInsight && <InsightsCard insight={principalInsight} onSeeAll={() => onTabChange?.("inteligencia")} />}
        <PergunteIACard onClick={() => onTabChange?.("perguntar")} />
      </section>

      {/* Normalmente o wrapper .dash-prox some do fluxo (o Card vira item do grid);
          no mobile ele é escondido junto com os atalhos, liberando a largura toda. */}
      <style>{`
        .dash-prox { display: contents; }
        /* Só os números do detalhamento do card de Patrimônio (embaixo) e dos
           tiles do Centro de Controle ~20% maiores no desktop; o valor grande e
           o resto do Painel ficam iguais. No mobile (≤768px) nada muda. */
        @media (min-width: 769px) {
          .kpi-breakdown .num, .cc-nums .num { zoom: 1.2; }
          /* Valor do Patrimônio Total maior em tablet/desktop (iPad ficava
             pequeno pro tamanho da tela); mobile (≤768px) segue em 32px. */
          .kpi-hero-valor { font-size: 42px !important; }
        }
        @media (max-width: 1024px) {
          .dash-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-mid-grid, .dash-bot-grid, .dash-metas-grid { grid-template-columns: 1fr !important; }
          .dash-proj-grid { grid-template-columns: repeat(3, 1fr) !important; }
          /* Empilhado: Gastos por Categoria acima da Alocação. */
          .dash-gastos { order: -1; }
        }
        @media (max-width: 768px) {
          /* Mobile: fora o "próximo compromisso"; patrimônio e Contas na
             largura máxima; projeção em 2 colunas. */
          .dash-prox { display: none !important; }
          .dash-kpi-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
          .dash-proj-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>

      <ModoFoco patrimonio={patrimonio} receitasMes={receitasMes}
                despesas={despesasResumo.total} aPagar={despesasResumo.aPagar}
                metas={metas || []} hidden={hidden} userName={userName} />
    </div>
    </SoftCardContext.Provider>
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

            <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "4px 18px", textAlign: "left" }}>
              {linha("Receitas do mês", receitasMes, T.green)}
              {linha("Despesas do mês", despesas, T.red)}
              {linha(sobra >= 0 ? "Sobra do mês" : "Déficit do mês", sobra, sobra >= 0 ? T.green : T.red)}
              {linha("A pagar este mês", aPagar, aPagar > 0 ? T.red : T.muted)}
            </div>

            {meta && metaAlvo > 0 && (
              <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginTop: 12, textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
                  <span style={{ color: T.muted }}>Meta: {meta.nome || meta.titulo || "—"}</span>
                  <span style={{ color: T.gold, fontWeight: 600 }}>{fmtN(metaPct, 0)}%</span>
                </div>
                <div style={{ height: 7, background: T.bgSoft, borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ width: `${metaPct}%`, height: "100%", background: T.gold, borderRadius: 8 }} />
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
  // Sempre começa oculto; só revela quando o usuário clica no card. O modo
  // privado global (hidden) tem prioridade e mantém oculto.
  const [revelado, setRevelado] = useState(false);
  const visivel = revelado && !hidden;
  const animado = useCountUp(value, visivel);
  // Topo "aurora" (variação B) — superfície colorida própria, texto branco.
  const bg = AURORA_BG;
  return (
    <div onClick={() => setRevelado(v => !v)}
         title={visivel ? "Toque para ocultar" : "Toque para ver"}
         style={{ background: bg, color: "#fff", borderRadius: 16, padding: "16px 17px 18px", position: "relative", overflow: "hidden", minHeight: 120, cursor: "pointer", userSelect: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <RingIcon icon={Wallet} cor="rgba(255,255,255,0.55)" size={34} stroke="rgba(255,255,255,0.9)" />
        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: "#38504a" }}>
          <ArrowUpRight size={16} strokeWidth={2} />
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: "rgba(255,255,255,0.92)", fontWeight: 500, marginTop: 18, letterSpacing: ".01em" }}>Patrimônio Total</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
        <div className="num kpi-hero-valor" style={{ fontSize: 32, fontWeight: 300, letterSpacing: "-.02em", lineHeight: 1 }}>
          {visivel ? fmt(animado) : "••••••"}
        </div>
        {/* stepper decorativo (estilo widget) */}
        <div style={{ display: "flex", alignItems: "center", paddingBottom: 5, opacity: 0.9 }} aria-hidden>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.55)" }} />
          <span style={{ width: 14, height: 1.5, background: "rgba(255,255,255,.4)" }} />
          <span style={{ width: 11, height: 11, borderRadius: "50%", background: "#fff" }} />
          <span style={{ width: 14, height: 1.5, background: "rgba(255,255,255,.4)" }} />
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,.55)" }} />
        </div>
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.85)", marginTop: 5 }}>
        {visivel ? (
          <>{mom >= 0 ? "↗" : "↘"} {fmtN(mom, 2)}%
          <span style={{ color: "rgba(255,255,255,0.6)", marginLeft: 4 }}>vs mês anterior</span></>
        ) : (
          <span style={{ color: "rgba(255,255,255,0.7)" }}>toque para revelar</span>
        )}
      </div>
      {/* Composição completa: fica no Centro de Controle (Visão consolidada) —
          aqui só o número, limpo (pedido do usuário 2026-09-22). */}
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
    <Card onClick={item ? onVer : undefined}
          style={{ minHeight: 110, position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", cursor: item ? "pointer" : "default" }}>
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
          <button onClick={(e) => { e.stopPropagation(); onVer?.(); }} style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>
            Ver
          </button>
        </>
      ) : (
        <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic", marginTop: 8 }}>Nenhum compromisso próximo.</div>
      )}
    </Card>
  );
}

// Próximos vencimentos (recebíveis) — antes ficava dentro do Centro de Controle;
// agora ocupa o slot do topo (no lugar do "Próximo compromisso").
function ProximosVencimentosCard({ devedores = [], hidden, onVer }) {
  const hoje = new Date().toISOString().slice(0, 10);
  const restanteDe = (d) => Math.max(0, (Number(d.valor) || 0) - (Number(d.valorRecebido) || 0));
  const formatarVenc = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }); }
    catch { return iso; }
  };
  const proximos = (devedores || [])
    .filter(d => !d.recebido && d.vencimento)
    .sort((a, b) => (a.vencimento || "").localeCompare(b.vencimento || ""))
    .slice(0, 3);
  return (
    <Card style={{ minHeight: 110 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 6 }}>
          <Calendar size={13} style={{ color: T.gold }} /> Próximos vencimentos
        </div>
        {onVer && <button onClick={onVer} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>Ver</button>}
      </div>
      {proximos.length === 0 ? (
        <div style={{ fontSize: 12, color: T.faint, fontStyle: "italic", marginTop: 4 }}>Nenhum recebível com vencimento.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {proximos.map(d => {
            const atrasado = d.vencimento < hoje;
            return (
              <div key={d.id} onClick={onVer} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 11.5, cursor: onVer ? "pointer" : "default" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
                  <div style={{ color: T.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.nome}</div>
                  <div style={{ fontSize: 10.5, color: atrasado ? T.red : T.muted }}>{atrasado ? "atrasado · " : ""}{formatarVenc(d.vencimento)}</div>
                </div>
                <div className="num" style={{ color: T.ink, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>{hidden ? "•••" : fmt(restanteDe(d))}</div>
              </div>
            );
          })}
        </div>
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
  // Total dos bancos = soma dos saldos das contas listadas (converte moeda).
  const totalBancos = somaContasBRL(contas || []);
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Contas</span>
          {/* Total dos bancos — bem sutil, colado ao título. */}
          <span className="num" title="Total dos bancos (soma dos saldos)"
                style={{ fontSize: 11.5, color: T.muted, whiteSpace: "nowrap" }}>
            {hidden ? "•••" : fmt(totalBancos)}
          </span>
        </div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Ver todas</button>
      </div>
      {/* Cards de conta — mesmo estilo widget do Centro de Controle */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {contas.slice(0, 4).map(c => (
          <button key={c.id} onClick={() => onContaClick?.(c)}
            style={{ background: T.bgSoft, border: "none", borderRadius: 16, padding: "11px 12px", cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", gap: 9, minHeight: 84 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <BankIcon c={c} size={30} />
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.nome}</div>
            </div>
            <div className="num" style={{ fontSize: 16, fontWeight: 400, color: c.saldo < 0 ? T.red : T.ink, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {hidden ? "•••" : fmt(c.saldo, c.moeda || "BRL")}
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
      <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>{label}</div>
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
            <div style={{ fontSize: 10.5, letterSpacing: ".06em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Maior gasto</div>
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

function OrcamentoCard({ categorias, gastos, hidden, onTabChange }) {
  // gastos = lista {nome, valor} vinda de getDespesasDoMes (fixas + parcelas +
  // avulsas), a mesma do card "Gastos por Categoria" — números sempre batem.
  const itens = useMemo(() => calcOrcamentoComGastos(categorias, gastos), [categorias, gastos]);
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
                <div style={{ height: 8, borderRadius: 8, background: T.bgSoft, overflow: "hidden" }}>
                  <div style={{ width: `${w}%`, height: "100%", borderRadius: 8, background: cor, transition: "width .4s ease" }} />
                </div>
                <div style={{ fontSize: 10.5, color: T.muted, marginTop: 3 }}>
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
          <span style={{ fontSize: 10, color: T.muted, letterSpacing: ".15em" }}>TOTAL</span>
          <span className="num" style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: T.ink }}>{hidden ? "•••" : fmt(total)}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {data.map((d,i) => {
            const w = (d.valor / (data[0]?.valor || 1)) * 100;
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ width: 92, flexShrink: 0, fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 8, background: T.bgSoft, overflow: "hidden" }}>
                  <div style={{ width: `${w}%`, height: "100%", borderRadius: 8, background: BAR_COR, transition: "width .5s ease" }} />
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
    <div style={{ background: bg, color: "#fff", borderRadius: 16, padding: 16, display: "flex", flexDirection: "column" }}>
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
              style={{ background: "rgba(255,255,255,0.1)", border: `1px solid rgba(255,255,255,0.2)`, color: "#fff", padding: "8px 12px", borderRadius: 12, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
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
        <div style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3px 8px" }}>Este mês</div>
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
              <div style={{ flex: 1, height: 8, borderRadius: 8, background: T.bgSoft, overflow: "hidden" }}>
                <div style={{ width: `${w}%`, height: "100%", borderRadius: 8, background: BAR_COR, transition: "width .5s ease" }} />
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
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Evolução do Patrimônio</div>
        <div style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3px 8px" }}>Este ano</div>
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
            <YAxis tick={{ fontSize: 10, fill: T.muted }} width={50} />
            <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }} />
            <Area type="monotone" dataKey="saldo" stroke={T.green} fill="url(#grad-evol)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AReceberCard({ devedores = [], aPagarHoje = [], aPagarMes = null, aPagarTotal = 0, aPagarPorAno = [], chequesTotal = 0, cartoesTotal = 0, cartoesTile = null, sparks = null, consolidado = null, hidden, onSeeAll, onVerPagar }) {
  // Valores começam VISÍVEIS ao abrir a tela (pedido do usuário); o botão do
  // olho continua lá pra esconder. O modo privado global (hidden) segue
  // mandando por cima de tudo.
  const [revelar, setRevelar] = useState(true);
  const oculto = hidden || !revelar;
  const hoje = new Date().toISOString().slice(0, 10);

  const abertos = devedores.filter(d => !d.recebido);
  // Quanto ainda FALTA receber (desconta recebimentos parciais já feitos).
  const restanteDe = (d) => Math.max(0, (Number(d.valor) || 0) - (Number(d.valorRecebido) || 0));
  const totalReceber = abertos.reduce((s, d) => s + restanteDe(d), 0);

  // A receber (mês): recebíveis que vencem no mês corrente (juros de empréstimo
  // já recebidos abatem). Mesma base do módulo "A Receber & Dívidas".
  const mesAtual = hoje.slice(0, 7);
  let receberMes = 0;
  devedores.forEach(d => {
    if (d.recebido) return;
    const valor = Number(d.valor) || 0;
    const vr = Number(d.valorRecebido) || 0;
    const jurosRec = d.emprestimo && Array.isArray(d.recebimentos)
      ? d.recebimentos.filter(r => r && r.tipo === "juros").reduce((s, r) => s + (Number(r.valor) || 0), 0)
      : 0;
    const restante = Math.max(0, valor - vr - jurosRec);
    if (restante <= 0) return;
    if (!d.vencimento || d.vencimento.slice(0, 7) === mesAtual) receberMes += restante;
  });

  const apagarMesVal = aPagarMes?.total || 0;
  // Os 6 totais do "Centro de Controle" — estilo widget: ícone em anel, número
  // fino e mini-sparkline (traço ilustrativo de tendência; série real depois).
  // Ordem pedida pelo usuário: primeiro o MÊS (a receber, a pagar, cartões),
  // depois os TOTAIS (a receber, a pagar) e os cheques.
  // 4 tiles de MESMA altura (grade 2×2). "Total a pagar" (com a quebra por
  // ano) e "Cheques" saíram dos cards — viravam alturas desiguais e ficava
  // feio; agora são LINHAS compactas logo abaixo (pedido 2026-09-22).
  const resumo = [
    { id: "arecebermes", label: "A receber (mês)",     valor: receberMes,   cor: T.gold,  icon: Calendar,     spark: sparks?.receber },
    { id: "apagarmes",   label: "A pagar (mês)",       valor: apagarMesVal, cor: apagarMesVal > 0 ? T.red : T.muted, icon: Calendar, spark: sparks?.pagar },
    // Cartões: destaque no que está em aberto (mês corrente; senão o seguinte);
    // o total em aberto vai pra linha de baixo.
    { id: "cartoes",     label: cartoesTile?.label || "Cartões", valor: cartoesTile?.valor || 0, cor: cartoesTotal > 0 ? T.yellow : T.muted, icon: CreditCard, spark: sparks?.cartoes, subRotulo: "total em aberto", subValor: cartoesTotal },
    { id: "areceber",    label: "Total a receber",    valor: totalReceber, cor: T.green, icon: ArrowDownLeft, spark: sparks?.receber },
  ];

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <HandCoins size={16} style={{ color: T.gold }} />
          <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Centro de Controle</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={() => setRevelar(v => !v)} disabled={hidden}
            title={oculto ? "Mostrar valores" : "Ocultar valores"}
            style={{ background: "transparent", border: "none", color: T.muted, cursor: hidden ? "default" : "pointer", display: "inline-flex", alignItems: "center", opacity: hidden ? 0.4 : 1, padding: 0 }}>
            {oculto ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.gold, fontSize: 11, cursor: "pointer" }}>
            Ver tudo
          </button>
        </div>
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 12 }}>
        {abertos.length} {abertos.length === 1 ? "recebível em aberto" : "recebíveis em aberto"}
      </div>

      {/* 6 totais do Centro de Controle — 2 colunas (lado a lado). Todos usam a
          MESMA superfície "aurora" do card de Patrimônio Total, texto branco. */}
      <div className="cc-nums" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        {resumo.map(b => (
          <div key={b.id} style={{
            background: AURORA_BG,
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 16, padding: "11px 12px", minHeight: 92,
            display: "flex", flexDirection: "column", justifyContent: "space-between",
            color: "#fff", overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <RingIcon icon={b.icon} cor="rgba(255,255,255,0.45)" stroke="rgba(255,255,255,0.95)" size={30} />
              <div style={{ fontSize: 10.5, lineHeight: 1.15, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>{b.label}</div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, marginTop: 10 }}>
              <div className="num" title={oculto ? undefined : fmt(b.valor)}
                   style={{ fontSize: 16, fontWeight: 500, color: "#fff", letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {oculto ? "•••" : fmtAbrev(b.valor)}
              </div>
              {!oculto && <Sparkline points={b.spark} cor="rgba(255,255,255,0.92)" w={44} h={20} />}
            </div>
            {b.subValor > 0 && (
              <div className="num" style={{ fontSize: 10.5, color: "rgba(255,255,255,0.78)", marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {b.subRotulo}: {oculto ? "•••" : fmt(b.subValor)}
              </div>
            )}
            {b.subLinhas?.length > 0 && (
              <div style={{ marginTop: 4, paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.16)", display: "flex", flexDirection: "column", gap: 1.5 }}>
                {b.subLinhas.map(l => (
                  <div key={l.rotulo} className="num" style={{ fontSize: 10.5, color: "rgba(255,255,255,0.78)", display: "flex", justifyContent: "space-between", gap: 6, whiteSpace: "nowrap" }}>
                    <span>{l.rotulo}</span>
                    <span>{oculto ? "•••" : fmtAbrev(l.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* TOTAIS — Total a pagar (com a quebra por ano) e Cheques em linhas,
          no mesmo estilo da Visão consolidada (saíram dos cards da grade). */}
      {(aPagarTotal > 0 || chequesTotal > 0) && (
        <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}`, marginBottom: 8 }}>
          <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
            Totais
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {aPagarTotal > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted }}>
                  <span>📉 Total a pagar</span>
                  <span className="num" style={{ color: T.red, fontWeight: 700 }}>{oculto ? "•••" : fmt(aPagarTotal)}</span>
                </div>
                {(aPagarPorAno || []).length > 1 && aPagarPorAno.map(x => (
                  <div key={x.ano} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.faint, paddingLeft: 18 }}>
                    <span>{x.ano}</span>
                    <span className="num">{oculto ? "•••" : fmt(x.valor)}</span>
                  </div>
                ))}
              </>
            )}
            {chequesTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted }}>
                <span>🧾 Cheques a receber</span>
                <span className="num" style={{ color: T.blue || "#60a5fa", fontWeight: 700 }}>{oculto ? "•••" : fmt(chequesTotal)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISÃO CONSOLIDADA — o que você TEM num lugar só: contas + proventos +
          investimentos − cartões em aberto (movida do card Patrimônio Total). */}
      {consolidado && (
        <div style={{ paddingTop: 10, borderTop: `1px solid ${T.border}`, marginBottom: 4 }}>
          <div style={{ fontSize: 11.5, color: T.gold, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>
            Visão consolidada
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {[
              { r: "🏦 Contas", v: consolidado.contas, s: "+" },
              ...(consolidado.proventos > 0 ? [{ r: "💰 Carteira de proventos", v: consolidado.proventos, s: "+" }] : []),
              { r: "📈 Investimentos (Brasil)", v: consolidado.investBR, s: "+" },
              { r: "💳 Cartões em aberto", v: consolidado.cartoes, s: "−" },
            ].map(l => (
              <div key={l.r} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.muted }}>
                <span>{l.r}</span>
                <span className="num" style={{ color: l.s === "−" ? T.red : T.ink }}>{l.s === "−" ? "− " : ""}{oculto ? "•••" : fmt(l.v)}</span>
              </div>
            ))}
            {consolidado.investUSD > 0 && (
              <div style={{ fontSize: 11.5, color: T.faint, fontStyle: "italic" }}>
                + US$ {consolidado.investUSD.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em Stocks/REITs (fora do total em R$)
              </div>
            )}
          </div>
        </div>
      )}

      {/* A PAGAR vencendo HOJE — contas (fixas/parcelas/dívidas) que vencem hoje */}
      {aPagarHoje.length > 0 && (
        <div style={{
          marginTop: 12, paddingTop: 10, borderTop: `1px solid ${T.border}`,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ fontSize: 10.5, color: T.red, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <AlertCircle size={11} /> A pagar hoje
            </div>
            <div className="num" style={{ fontSize: 12, fontWeight: 700, color: T.red }}>
              {oculto ? "•••" : fmt(aPagarHoje.reduce((s, p) => s + (Number(p.valor) || 0), 0))}
            </div>
          </div>
          {aPagarHoje.slice(0, 3).map(p => (
            <div key={p.id} onClick={onVerPagar} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", fontSize: 11.5, cursor: onVerPagar ? "pointer" : "default" }}>
              <div style={{ color: T.ink, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>
                {p.nome}
              </div>
              <div className="num" style={{ color: T.red, fontWeight: 600, marginLeft: 8, flexShrink: 0 }}>
                {oculto ? "•••" : fmt(Number(p.valor) || 0)}
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

const CAL_MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

// Calendário do mês — marca dias com a pagar (vermelho), a receber/cheque
// (verde) e evento da agenda (azul). Navegável; clicar abre o Calendário cheio.
function CalendarioMesCard({ stateAgg, escopoAtivo, agenda = [], hidden, onVer }) {
  const hoje = new Date();
  const [ref, setRef] = React.useState({ y: hoje.getFullYear(), m: hoje.getMonth() });
  const monthISO = `${ref.y}-${String(ref.m + 1).padStart(2, "0")}`;

  const marks = useMemo(() => {
    const map = {};
    const add = (dia, key) => { if (!dia) return; (map[dia] = map[dia] || {})[key] = true; };
    const diaDe = (iso) => (iso || "").startsWith(monthISO) ? parseInt(iso.slice(8, 10), 10) : null;
    try { getDespesasDoMes(monthISO, stateAgg, escopoAtivo).filter(d => d.status !== "paga").forEach(d => add(diaDe(d.data), "pagar")); } catch {}
    try { getGanhosDoMes(monthISO, stateAgg, escopoAtivo).filter(g => g.status !== "paga").forEach(g => add(diaDe(g.data), "receber")); } catch {}
    (agenda || []).forEach(ev => add(diaDe(ev.data), "agenda"));
    return map;
  }, [monthISO, stateAgg, escopoAtivo, agenda]);

  const first = new Date(ref.y, ref.m, 1);
  const startDow = first.getDay();
  const diasNoMes = new Date(ref.y, ref.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= diasNoMes; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const ehHoje = (d) => d === hoje.getDate() && ref.m === hoje.getMonth() && ref.y === hoje.getFullYear();
  const passo = (delta) => setRef(r => { const nd = new Date(r.y, r.m + delta, 1); return { y: nd.getFullYear(), m: nd.getMonth() }; });
  const navBtn = { width: 22, height: 22, border: `1px solid ${T.border}`, borderRadius: 12, display: "grid", placeItems: "center", color: T.muted, background: T.bgSoft, cursor: "pointer", fontWeight: 600, lineHeight: 0 };
  const Dot = ({ c }) => <span style={{ width: 4, height: 4, borderRadius: "50%", background: c }} />;

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: ".15em", color: T.muted, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Calendar size={12} style={{ color: T.gold }} /> CALENDÁRIO DO MÊS
        </div>
        <div style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
          {onVer && <button onClick={onVer} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Abrir</button>}
          <button onClick={() => passo(-1)} aria-label="Mês anterior" style={navBtn}>‹</button>
          <button onClick={() => passo(1)} aria-label="Próximo mês" style={navBtn}>›</button>
        </div>
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 14, fontWeight: 600, marginBottom: 6, textTransform: "capitalize" }}>{CAL_MESES[ref.m]} {ref.y}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 3 }}>
        {["D","S","T","Q","Q","S","S"].map((d, i) => <span key={i} style={{ fontSize: 10, textAlign: "center", color: T.faint, fontWeight: 700 }}>{d}</span>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((d, i) => {
          if (d == null) return <div key={i} />;
          const mk = marks[d] || {};
          const hasMov = !!(mk.pagar || mk.receber || mk.agenda);
          // Cor dominante do dia (prioriza saída de dinheiro): tinge o fundo e a borda.
          const corDom = mk.pagar ? T.red : mk.receber ? T.green : (T.blue || "#5b86c4");
          const hoje = ehHoje(d);
          const titulo = hasMov ? [mk.pagar && "a pagar", mk.receber && "a receber / cheque", mk.agenda && "agenda"].filter(Boolean).join(" · ") : undefined;
          return (
            <div key={i} onClick={onVer} title={titulo} style={{
              aspectRatio: "1.55", borderRadius: 8, position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11.5,
              color: hasMov ? corDom : T.ink, cursor: onVer ? "pointer" : "default",
              background: hasMov ? `${corDom}1e` : T.bgSoft,
              border: hoje ? `2px solid ${T.green}` : hasMov ? `1px solid ${corDom}66` : "1px solid transparent",
              fontWeight: (hoje || hasMov) ? 700 : 400,
            }}>
              {d}
              {hasMov && (
                <div style={{ display: "flex", gap: 3, position: "absolute", bottom: 2 }}>
                  {mk.pagar && <Dot c={T.red} />}
                  {mk.receber && <Dot c={T.green} />}
                  {mk.agenda && <Dot c={T.blue || "#5b86c4"} />}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 9, fontSize: 10, color: T.muted, flexWrap: "wrap" }}>
        <span><Dot c={T.red} /> <span style={{ verticalAlign: "middle", marginLeft: 4 }}>A pagar</span></span>
        <span><Dot c={T.green} /> <span style={{ verticalAlign: "middle", marginLeft: 4 }}>A receber / cheque</span></span>
        <span><Dot c={T.blue || "#5b86c4"} /> <span style={{ verticalAlign: "middle", marginLeft: 4 }}>Agenda</span></span>
      </div>
    </Card>
  );
}

// Projeção — só os 6 cards de meses (sem gráfico). Vai embaixo do "A receber".
function ProjecaoMesesCard({ projecao, hidden }) {
  return (
    <Card>
      <div style={{ fontSize: 10, letterSpacing: ".15em", color: T.muted, fontWeight: 600, marginBottom: 10 }}>PROJEÇÃO · PRÓXIMOS 6 MESES</div>
      <div className="dash-proj-grid" style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {projecao.map(p => (
          <div key={p.label} style={{ background: T.bgSoft, borderRadius: 12, padding: 9, borderTop: `2px solid ${p.saldo >= 0 ? T.green : T.red}` }}>
            <div style={{ fontSize: 10.5, letterSpacing: ".1em", color: T.muted, fontWeight: 600 }}>{p.label}</div>
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
/* Orçamentos de compras futuras — substitui o card Metas Financeiras do
   Painel (pedido 2026-09-21). Funciona como CALCULADORA: valor + quando →
   quanto guardar por mês; salva os planos e acompanha o progresso. */
function OrcamentosFuturosCard({ itens = [], setItens, hidden }) {
  const [form, setForm] = useState(null); // null | { id?, nome, valor, alvo, guardado }
  const vazio = () => {
    const d = new Date(); d.setMonth(d.getMonth() + 6);
    return { id: null, nome: "", valor: "", guardado: "", alvo: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` };
  };
  const calc = form ? calcOrcamentoCompra({ valor: parseFloat(form.valor) || 0, guardado: parseFloat(form.guardado) || 0, alvo: form.alvo }) : null;
  const resumo = resumoOrcamentos(itens);

  const salvar = () => {
    const valor = parseFloat(form.valor) || 0;
    if (!form.nome.trim() || valor <= 0) return;
    const item = { id: form.id || uid(), nome: form.nome.trim(), valor, guardado: parseFloat(form.guardado) || 0, alvo: form.alvo };
    setItens?.(form.id ? itens.map(x => x.id === form.id ? item : x) : [...itens, item]);
    setForm(null);
  };
  const mesLabel = (ym) => `${["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"][parseInt(String(ym).slice(5,7),10)-1] || "?"}/${String(ym).slice(2,4)}`;
  const inp = { padding: "7px 9px", fontSize: 12.5, borderRadius: 12 };

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>🛒 Orçamentos · compras futuras</div>
        {!form && (
          <button onClick={() => setForm(vazio())}
                  style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>
            + Planejar compra
          </button>
        )}
      </div>

      {/* CALCULADORA (novo/editar) */}
      {form && (
        <div style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 8 }} className="no-mobile-stack">
            <input style={inp} placeholder="O que? (ex: Moto, Reforma…)" value={form.nome}
                   onChange={e => setForm({ ...form, nome: e.target.value })} autoFocus />
            <input style={inp} type="number" step="0.01" min="0" placeholder="Valor R$" value={form.valor}
                   onChange={e => setForm({ ...form, valor: e.target.value })} />
            <input style={inp} type="month" value={form.alvo}
                   onChange={e => setForm({ ...form, alvo: e.target.value })} title="Quando quer comprar" />
            <input style={inp} type="number" step="0.01" min="0" placeholder="Já tenho R$" value={form.guardado}
                   onChange={e => setForm({ ...form, guardado: e.target.value })} />
          </div>
          {calc && calc.valor > 0 && (
            <div style={{ marginTop: 8, fontSize: 12.5, color: T.ink }}>
              → faltam <b className="num">{fmt(calc.falta)}</b> em <b>{calc.meses} {calc.meses === 1 ? "mês" : "meses"}</b>
              {" "}= guardar <b className="num" style={{ color: T.gold }}>{fmt(calc.porMes)}/mês</b>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={salvar} className="btn-gold" style={{ padding: "6px 14px", fontSize: 11 }}>
              {form.id ? "Atualizar" : "Salvar plano"}
            </button>
            {form.id && (
              <button onClick={() => { setItens?.(itens.filter(x => x.id !== form.id)); setForm(null); }}
                      style={{ background: "transparent", border: `1px solid ${T.red}55`, color: T.red, borderRadius: 12, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                Excluir
              </button>
            )}
            <button onClick={() => setForm(null)} className="btn-ghost" style={{ padding: "6px 12px", fontSize: 11 }}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista de planos */}
      {itens.length === 0 && !form ? (
        <button onClick={() => setForm(vazio())}
                style={{ width: "100%", background: "transparent", border: `2px dashed ${T.border}`, borderRadius: 16, padding: 18, color: T.muted, fontSize: 12.5, cursor: "pointer" }}>
          Planeje uma compra ou compromisso futuro — a calculadora mostra quanto guardar por mês.
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {itens.map(it => {
            const c = calcOrcamentoCompra(it);
            const cor = c.pct >= 100 ? T.green : c.passado ? T.red : T.gold;
            return (
              <button key={it.id} onClick={() => setForm({ id: it.id, nome: it.nome, valor: String(it.valor), guardado: String(it.guardado || ""), alvo: it.alvo })}
                      title="Toque pra editar / registrar quanto já guardou"
                      style={{ background: T.bgSoft, border: "none", borderRadius: 12, padding: "9px 11px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {it.nome} <span style={{ color: T.faint, fontWeight: 500 }}>· {mesLabel(it.alvo)}</span>
                  </span>
                  <span className="num" style={{ fontSize: 12, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(c.valor)}</span>
                </div>
                <div style={{ height: 5, borderRadius: 100, background: `${cor}22`, overflow: "hidden", margin: "6px 0 4px" }}>
                  <div style={{ width: `${c.pct}%`, height: "100%", background: cor, borderRadius: 100 }} />
                </div>
                <div className="num" style={{ fontSize: 10, color: T.muted }}>
                  {c.pct >= 100
                    ? <span style={{ color: T.green, fontWeight: 700 }}>✓ valor completo — pode comprar</span>
                    : c.passado
                      ? <span style={{ color: T.red, fontWeight: 700 }}>⚠ alvo passou · faltam {hidden ? "•••" : fmt(c.falta)}</span>
                      : <>guardado {hidden ? "•••" : fmt(c.guardado)} · faltam {hidden ? "•••" : fmt(c.falta)} → <b style={{ color: cor }}>{hidden ? "•••" : fmt(c.porMes)}/mês</b> por {c.meses}m</>}
                </div>
              </button>
            );
          })}
          {itens.length > 1 && (
            <div style={{ fontSize: 10.5, color: T.muted, padding: "2px 4px" }}>
              Total dos planos: guardar <b className="num" style={{ color: T.gold }}>{hidden ? "•••" : fmt(resumo.totalPorMes)}/mês</b>
              {" "}· falta juntar {hidden ? "•••" : fmt(resumo.totalFalta)} de {hidden ? "•••" : fmt(resumo.totalValor)}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PergunteIACard({ onClick }) {
  return (
    <button onClick={onClick}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ width: 36, height: 36, borderRadius: 16, background: `${T.green}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
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
