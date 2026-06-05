import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

import { T, applyTheme, THEMES } from "./lib/theme.js";
import { simulateTick, uid } from "./lib/format.js";
import { loadAll, saveAll, loadKeys, saveKeys, flushSave } from "./lib/storage.js";
import { API, COIN_MAP } from "./lib/api.js";
import { generateRecurringForCurrentMonth } from "./lib/recorrencia.js";
import { lerEscopo, salvarEscopo, migrarEscoposAuto } from "./lib/escopo.js";
import { toast } from "./lib/toast.js";
import { confirm } from "./lib/confirm.js";
import { createBackup, shouldAutoBackup } from "./lib/autoBackup.js";
import { audit } from "./lib/auditLog.js";
import { checkAndNotify, getConfig as getNotifCfg } from "./lib/notifications.js";
import {
  seedContas, seedCategorias, seedTransacoes, seedAtivos, seedMetas,
  seedCartoes, seedParcelamentos, seedDevedores, seedDividas,
} from "./lib/seeds.js";

import GlobalStyles from "./components/ui/GlobalStyles.jsx";
import Footer from "./components/ui/Footer.jsx";
import Header from "./components/Header.jsx";
import BottomTabBar from "./components/BottomTabBar.jsx";
import KeyboardShortcuts from "./components/ui/KeyboardShortcuts.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import ConfirmDialog from "./components/ui/ConfirmDialog.jsx";
import InstallPWA from "./components/ui/InstallPWA.jsx";

import ThemePicker from "./components/modals/ThemePicker.jsx";
import SettingsModal from "./components/modals/SettingsModal.jsx";
import PerfisModal from "./components/modals/PerfisModal.jsx";
import { getPerfilAtivo } from "./lib/perfis.js";
import { garantirOcorrenciasDoAno } from "./lib/fixas.js";
import { capitalizarCdbsMeta, autoAplicarCofrinhos } from "./lib/cdbMeta.js";
import { atualizarCarteira } from "./lib/cotacoes.js";
import { useKeyboardShortcuts } from "./lib/keyboardShortcuts.js";
import { useLayout } from "./lib/useLayout.js";
import AtalhosOverlay from "./components/modals/AtalhosOverlay.jsx";
import CommandPalette from "./components/ui/CommandPalette.jsx";

import Dashboard from "./components/pages/Dashboard.jsx";
import Contas from "./components/pages/Contas.jsx";
import Cartoes from "./components/pages/Cartoes.jsx";
import Transacoes from "./components/pages/Transacoes.jsx";
import Calendario from "./components/pages/Calendario.jsx";
import Categorias from "./components/pages/Categorias.jsx";
import Metas from "./components/pages/Metas.jsx";
import Notas from "./components/pages/Notas.jsx";
import Habitos from "./components/pages/Habitos.jsx";
import Diario from "./components/pages/Diario.jsx";
import Compras from "./components/pages/Compras.jsx";
import Ideias from "./components/pages/Ideias.jsx";
import Tarefas from "./components/pages/Tarefas.jsx";
import SugestoesMelhorias from "./components/pages/SugestoesMelhorias.jsx";
import AgendaInicio from "./components/pages/AgendaInicio.jsx";
import PomodoroFloat from "./components/PomodoroFloat.jsx";
import Despesas from "./components/pages/Despesas.jsx";
import ControleAnual from "./components/pages/Relatorios/ControleAnual.jsx";
import Planejamento from "./components/pages/Planejamento/index.jsx";
import AnaliseFatura from "./components/pages/AnaliseFatura.jsx";
import RelatoriosFinancas from "./components/pages/RelatoriosFinancas.jsx";
import CartaoExtrato from "./components/pages/CartaoExtrato.jsx";
import ContaExtrato from "./components/pages/ContaExtrato.jsx";
import AReceberEDividas from "./components/pages/AReceberEDividas.jsx";
import AuditLog from "./components/pages/AuditLog.jsx";
import PergunteAoClaude from "./components/pages/PergunteAoClaude.jsx";
import Configuracoes from "./components/pages/Configuracoes.jsx";
import Gerencial from "./components/pages/Gerencial.jsx";
import { isGestor } from "./lib/gestor.js";
import { supabase } from "./lib/supabase.js";

export default function App() {
  const [modulo, setModulo] = useState(() => {
    // Inicia no primeiro módulo permitido ao perfil ativo
    const perms = getPerfilAtivo()?.permissoes || { financas: true };
    if (perms.financas) return "financas";
    if (perms.invest)   return "invest";
    return "financas";
  }); // 'financas' | 'invest' | 'config'
  const [tab, setTab] = useState("dashboard");
  const [pendingTransacao, setPendingTransacao] = useState(null);
  const [atalhosVisivel, setAtalhosVisivel] = useState(false);
  const [paletaAberta, setPaletaAberta] = useState(false);
  const { isVertical } = useLayout();
  const [hidden, setHidden] = useState(false);
  const [perfisOpen, setPerfisOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [themeId, setThemeId] = useState("gold");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modulesEnabled, setModulesEnabled] = useState({ financas: true, invest: true });
  const [apiKeys, setApiKeys] = useState({ brapi: "", alphavantage: "", anthropic: "", useRealMarket: true });
  const [marketStatus, setMarketStatus] = useState({ at: null, mode: "sim", okCount: 0, total: 0 });
  const [cartaoAberto, setCartaoAberto] = useState(null);
  const [contaAberta, setContaAberta] = useState(null);

  applyTheme(themeId);

  const [contas, setContas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [transacoes, setTransacoes] = useState([]);
  const [ativos, setAtivos] = useState([]);
  const [metas, setMetas] = useState([]);
  const [notas, setNotas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [parcelamentos, setParcelamentos] = useState([]);
  const [devedores, setDevedores] = useState([]);
  const [dividas, setDividas] = useState([]);

  // Painel Gerencial (gestor) — CRM local de clientes do produto.
  const [clientes, setClientes] = useState([]);
  const [curadoria, setCuradoria] = useState([]); // dicas/conteúdos pro cliente
  const [planos, setPlanos] = useState([]);       // planos de assinatura
  const [gerencialConfig, setGerencialConfig] = useState({}); // { appUrl, mensagemConvite, testeDias }

  // E-mail do usuário logado (Supabase) → define se é o gestor.
  const [userEmail, setUserEmail] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getUser().then(({ data }) => { if (active) setUserEmail(data?.user?.email || ""); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUserEmail(session?.user?.email || ""));
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
  const ehGestor = isGestor(userEmail);

  // Sair do aplicativo: encerra a sessão no Supabase e recarrega para a tela de login.
  const handleLogout = async () => {
    const ok = await confirm({
      title: "Sair do aplicativo?",
      body: "Você vai precisar entrar de novo com seu e-mail e senha. Seus dados ficam guardados.",
      confirmLabel: "Sair",
      danger: true,
    });
    if (!ok) return;
    try {
      if (supabase) await supabase.auth.signOut();
    } catch (e) {
      toast.error("Não foi possível sair: " + (e?.message || e));
      return;
    }
    try { window.location.reload(); } catch {}
  };

  // Cliente (não-gestor) nunca acessa Config nem o painel Gerencial.
  useEffect(() => {
    if (!ehGestor && tab === "gerencial") {
      setModulo("financas"); setTab("dashboard");
    }
    // Cliente que cair numa subtab restrita de config → manda pra Aparência.
    if (!ehGestor && modulo === "config" && (tab === "cfg-apis" || tab === "cfg-modulos")) {
      setTab("cfg-aparencia");
    }
  }, [ehGestor, modulo, tab]);

  // Escopo financeiro · Pessoal / Negócio / Tudo
  const [escopoAtivo, setEscopoAtivo] = useState(lerEscopo());

  // Despesas Fixas (módulo independente)
  const [fixas, setFixas] = useState([]);
  const [fixaOcorrencias, setFixaOcorrencias] = useState([]);

  // Agenda pessoal (compromissos, viagens, lembretes, eventos)
  const [agenda, setAgenda] = useState([]);
  // Fase 1: hábitos com streaks, diário rápido, lista de compras, ideias livres
  const [habitos, setHabitos] = useState([]);
  const [diario, setDiario] = useState([]);
  const [compras, setCompras] = useState([]);
  const [ideias, setIdeias] = useState([]);
  const [tarefas, setTarefas] = useState([]);
  // Sugestões de melhorias do próprio app (aba Agenda → Sugestões).
  const [sugestoes, setSugestoes] = useState([]);
  // Histórico do patrimônio (snapshot diário do total = ativos + contas).
  // Array de { data: "YYYY-MM-DD", totalAtivos, totalContas, total }.
  const [patrimonioHistorico, setPatrimonioHistorico] = useState([]);

  /* ---------- Load on mount ---------- */
  useEffect(() => {
    (async () => {
      let data = null, keys = null;
      try {
        [data, keys] = await Promise.all([loadAll(), loadKeys()]);
      } catch (e) {
        // localStorage corrompido / leitura falhou → segue com seeds (evita tela branca).
        console.error("Falha ao carregar dados — usando seeds:", e);
        data = null; keys = null;
      }
      try {
      if (data) {
        setContas(data.contas || seedContas);
        setCategorias((data.categorias || seedCategorias).map(c => ({ ...c, limite: c.limite ?? null })));
        setTransacoes((data.transacoes || seedTransacoes).map(t => ({
          ...t,
          compensado: t.compensado ?? true,
          obs: t.obs ?? "",
          fixa: t.fixa ?? false,
          vencimento: t.vencimento ?? null,
        })));
        setAtivos(data.ativos || seedAtivos);
        setMetas(data.metas || seedMetas);
        setNotas(data.notas || []);
        setCartoes(data.cartoes || seedCartoes);
        // Migrate parcelamentos: convert cartaoNome → cartaoId
        const cartoesData = data.cartoes || seedCartoes;
        setParcelamentos((data.parcelamentos || seedParcelamentos).map(p => {
          if (!p.cartaoId && p.cartaoNome) {
            const c = cartoesData.find(x => x.nome === p.cartaoNome);
            if (c) return { ...p, cartaoId: c.id };
          }
          return p;
        }));
        setDevedores(data.devedores || seedDevedores);
        setDividas(data.dividas || seedDividas);
        setClientes(data.clientes || []);
        setCuradoria(data.curadoria || []);
        setPlanos(data.planos || []);
        setGerencialConfig(data.gerencialConfig || {});
        // Migração silenciosa: se backup antigo não tem essas chaves, vira []
        setFixas(data.fixas || []);
        setFixaOcorrencias(data.fixaOcorrencias || []);
        setAgenda(data.agenda || []);
        setHabitos(data.habitos || []);
        setDiario(data.diario || []);
        setCompras(data.compras || []);
        setIdeias(data.ideias || []);
        setTarefas(data.tarefas || []);
        setSugestoes(data.sugestoes || []);
        setPatrimonioHistorico(data.patrimonioHistorico || []);
        if (data.themeId && THEMES[data.themeId]) setThemeId(data.themeId);
        // Migração one-shot: marca contas/categorias antigas com escopo detectado
        setTimeout(() => {
          migrarEscoposAuto(
            { contas: data.contas, categorias: data.categorias },
            { setContas, setCategorias }
          );
        }, 100);
      } else {
        setContas(seedContas);
        setCategorias(seedCategorias);
        setTransacoes(seedTransacoes);
        setAtivos(seedAtivos);
        setMetas(seedMetas);
        setCartoes(seedCartoes);
        setParcelamentos(seedParcelamentos.map(p => {
          if (!p.cartaoId && p.cartaoNome) {
            const c = seedCartoes.find(x => x.nome === p.cartaoNome);
            if (c) return { ...p, cartaoId: c.id };
          }
          return p;
        }));
        setDevedores(seedDevedores);
        setDividas(seedDividas);
        setFixas([]);
        setFixaOcorrencias([]);
        setAgenda([]);
        setHabitos([]);
        setDiario([]);
        setCompras([]);
        setIdeias([]);
        setTarefas([]);
        setSugestoes([]);
        setPatrimonioHistorico([]);
      }
        if (keys) {
          setApiKeys(prev => ({ ...prev, ...keys }));
          // A chave do Gemini é sincronizada na conta (apiKeys.gemini, vai pra
          // nuvem). Espelha no localStorage onde lib/gemini.js efetivamente lê,
          // pra ela aparecer já configurada num aparelho novo / após limpar cache.
          try { if (keys.gemini) localStorage.setItem("af4:gemini-key", keys.gemini); } catch {}
        }
      } catch (e) {
        // Erro ao aplicar os dados carregados (migração/estado inesperado).
        // Não trava o app: loga e segue — o finally libera o loading.
        console.error("Falha ao aplicar dados carregados:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- Save on change ---------- */
  useEffect(() => {
    if (loading) return;
    saveAll({
      contas, categorias, transacoes, ativos, metas, notas,
      cartoes, parcelamentos, devedores, dividas, clientes, curadoria, planos, gerencialConfig,
      fixas, fixaOcorrencias, agenda,
      habitos, diario, compras, ideias, tarefas, sugestoes, patrimonioHistorico,
      themeId,
    });
  }, [contas, categorias, transacoes, ativos, metas, notas, cartoes, parcelamentos, devedores, dividas, clientes, curadoria, planos, gerencialConfig,
      fixas, fixaOcorrencias, agenda,
      habitos, diario, compras, ideias, tarefas, sugestoes, patrimonioHistorico,
      themeId, loading]);

  useEffect(() => {
    if (loading) return;
    saveKeys(apiKeys);
  }, [apiKeys, loading]);

  /* ---------- Command Palette: Ctrl/Cmd+K abre busca rápida de abas ---------- */
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletaAberta(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ---------- Auto-geração de ocorrências de fixas para o ano atual ---------- */
  // Se virou o ano, garante que cada fixa cadastrada tem 12 ocorrências do novo ano.
  useEffect(() => {
    if (loading) return;
    if (!fixas || fixas.length === 0) return;
    const anoAtual = new Date().getFullYear();
    const expandido = garantirOcorrenciasDoAno(fixas, fixaOcorrencias, anoAtual);
    if (expandido !== fixaOcorrencias) {
      setFixaOcorrencias(expandido);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, fixas]);

  /* ---------- Flush save pendente antes de fechar/recarregar ---------- */
  useEffect(() => {
    const handler = () => { flushSave(); };
    window.addEventListener("beforeunload", handler);
    window.addEventListener("pagehide", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
      window.removeEventListener("pagehide", handler);
    };
  }, []);

  /* ---------- Backup automático ---------- */
  // Cria snapshot ao carregar (se passaram >6h) + revisa a cada 30min.
  useEffect(() => {
    if (loading) return;

    const fazerBackup = async () => {
      if (!(await shouldAutoBackup())) return;
      const snapshot = {
        contas, categorias, transacoes, ativos, metas,
        cartoes, parcelamentos, devedores, dividas,
        fixas, fixaOcorrencias,
        themeId,
        savedAt: new Date().toISOString(),
      };
      const m = await createBackup(snapshot, "auto");
      if (m) console.info(`[AF4] Backup automático criado (${m.sizeKb}KB).`);
    };

    fazerBackup(); // dispara uma vez ao montar (se tiver passado o intervalo)
    const id = setInterval(fazerBackup, 30 * 60 * 1000); // checa a cada 30min
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  /* ---------- Snapshot diário do patrimônio ---------- */
  // 1 snapshot por dia (substitui se já tem do mesmo dia — assim o último
  // do dia "ganha" e reflete preços mais atualizados).
  useEffect(() => {
    if (loading) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const totalAtivos = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
    const totalContas = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);
    // Total aportado = custo dos ativos (qtd × preço médio). Permite comparar
    // o valor de mercado com o que foi efetivamente investido.
    const totalAportado = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.pm ?? a.precoMedio ?? 0), 0);
    const total = totalAtivos + totalContas;
    // Skip snapshot quando ainda não tem dados (evita gravar 0,00 ao 1º load)
    if (total <= 0) return;
    setPatrimonioHistorico(prev => {
      const semHoje = (prev || []).filter(p => p.data !== hoje);
      return [...semHoje, { data: hoje, totalAtivos, totalContas, totalAportado, total }]
        .sort((a, b) => a.data.localeCompare(b.data));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ativos, contas]);

  /* ---------- CDB de meta: rende a CDI automaticamente (1x/dia) ---------- */
  // Recalcula o valor de mercado dos CDBs de meta capitalizando a CDI desde a
  // data de aplicação. Idempotente por dia — só grava se algo mudou.
  useEffect(() => {
    if (loading) return;
    if (!ativos.some(a => a._cdbMeta)) return;
    const { ativos: nova, mudou } = capitalizarCdbsMeta(ativos);
    if (mudou) setAtivos(nova);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ativos]);

  /* ---------- Reaplicação automática: cofrinho → CDB (metas com autoCdb) ---------- */
  // Quando uma meta tem autoCdb ligado e o cofrinho recebe saldo (ex.: aporte
  // mensal), aplica automaticamente no CDB. Roda quando metas/contas mudam.
  useEffect(() => {
    if (loading) return;
    if (!metas.some(m => m.autoCdb)) return;
    const r = autoAplicarCofrinhos({ metas, contas, ativos, transacoes, categorias });
    if (!r.mudou) return;
    setContas(r.contas);
    setAtivos(r.ativos);
    setTransacoes(r.transacoes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, metas, contas]);

  /* ---------- Notificações de vencimentos: verifica a cada 30min ---------- */
  useEffect(() => {
    if (loading) return;
    const tick = () => {
      const cfg = getNotifCfg();
      if (!cfg.habilitada) return;
      checkAndNotify({ devedores, dividas });
    };
    tick(); // primeira vez logo após boot
    const id = setInterval(tick, 30 * 60 * 1000); // a cada 30min
    return () => clearInterval(id);
  }, [loading, devedores, dividas]);

  /* ---------- Atalhos de teclado globais: N / V / A ---------- */
  useEffect(() => {
    const isTyping = (el) => {
      if (!el) return false;
      const tag = (el.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || el.isContentEditable;
    };
    const handleKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTyping(document.activeElement)) return;

      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        setCartaoAberto(null); setContaAberta(null);
        setModulo("financas"); setTab("transacoes");
        handleCreateTransacao(contas[0]?.nome || "");
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        setCartaoAberto(null); setContaAberta(null);
        setModulo("invest"); setTab("investimentos");
        setTimeout(() => window.dispatchEvent(new CustomEvent("af4:open-new-aporte")), 50);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contas]);

  /* ---------- Recorrência automática: gera fixas pendentes no mês corrente ---------- */
  const [recorrenciaProcessada, setRecorrenciaProcessada] = useState(false);
  useEffect(() => {
    if (loading || recorrenciaProcessada) return;
    if (transacoes.length === 0) return;
    const novas = generateRecurringForCurrentMonth(transacoes);
    if (novas.length > 0) {
      setTransacoes(prev => [...novas, ...prev]);
      const ref = new Date();
      const mesNome = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][ref.getMonth()];
      toast.info(
        `${novas.length} despesa${novas.length !== 1 ? "s" : ""} fixa${novas.length !== 1 ? "s" : ""} prevista${novas.length !== 1 ? "s" : ""} para ${mesNome} ${ref.getFullYear()}.`,
        { duration: 6000 }
      );
    }
    setRecorrenciaProcessada(true);
  }, [loading, transacoes, recorrenciaProcessada]);

  /* ---------- Aggregates ---------- */
  const totais = useMemo(() => {
    const receitas = transacoes.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
    const despesas = transacoes.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
    const saldoContas = contas.reduce((s, c) => s + Number(c.saldo || 0), 0);
    const carteira = ativos.reduce((s, a) => s + a.qtd * a.preco, 0);
    const custo = ativos.reduce((s, a) => s + a.qtd * a.pm, 0);
    const rendimento = carteira - custo;
    const rendPct = custo > 0 ? (rendimento / custo) * 100 : 0;
    const patrimonio = saldoContas + carteira;
    return { receitas, despesas, saldoContas, carteira, custo, rendimento, rendPct, patrimonio, fluxo: receitas - despesas };
  }, [contas, transacoes, ativos]);

  /* ---------- Pending counts per tab (for badge display in Header) ---------- */
  const pendingCounts = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);
    const monthKey = todayISO.slice(0, 7);

    // Transações: pendentes deste mês
    const txPendentes = transacoes.filter(t => !t.compensado && t.data?.startsWith(monthKey));
    const txOverdue = txPendentes.filter(t => t.data < todayISO);

    // Calendário: mesmo critério mas mais amplo (mês + próximos 7 dias)
    const limit = new Date(); limit.setDate(limit.getDate() + 7);
    const limitISO = limit.toISOString().slice(0, 10);
    const calPendentes = transacoes.filter(t => !t.compensado && t.data && t.data <= limitISO);
    const calOverdue = calPendentes.filter(t => t.data < todayISO);

    return {
      transacoes: { total: txPendentes.length, overdue: txOverdue.length },
      calendario: { total: calPendentes.length, overdue: calOverdue.length },
    };
  }, [transacoes, devedores, dividas]);

  /* ---------- Market refresh ---------- */
  const [refreshing, setRefreshing] = useState(false);

  // Memoized handlers (reduz re-renders desnecessários em filhos)
  const handleCreateTransacao = useCallback((contaNome) => {
    setPendingTransacao({ conta: contaNome });
    setTab("transacoes");
  }, []);

  // Quick actions (também usadas pelos atalhos N/V/A)
  const handleQuickAction = useCallback((kind) => {
    if (kind === "transacao") {
      setCartaoAberto(null); setContaAberta(null);
      setModulo("financas"); setTab("transacoes");
      setPendingTransacao({ conta: contas[0]?.nome || "" });
    } else if (kind === "aporte") {
      setCartaoAberto(null); setContaAberta(null);
      setModulo("invest"); setTab("investimentos");
      window.dispatchEvent(new CustomEvent("af4:open-new-aporte"));
    }
  }, [contas]);

  // Atalhos de teclado globais (N/A/?)
  useKeyboardShortcuts({
    onNovaTransacao: () => handleQuickAction("transacao"),
    onNovoAporte: () => handleQuickAction("aporte"),
    onMostrarAtalhos: () => setAtalhosVisivel(true),
  });

  const handleClearPending = useCallback(() => {
    setPendingTransacao(null);
  }, []);

  const handleOpenPicker = useCallback(() => setPickerOpen(true), []);
  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);

  const refreshMarket = async () => {
    setRefreshing(true);

    // Modo simulado: tick aleatório (sem chave necessária)
    if (!apiKeys.useRealMarket) {
      setTimeout(() => {
        setAtivos(prev => prev.map(a => {
          // CDB de meta rende a CDI sozinho — não recebe tick aleatório de mercado.
          if (a._cdbMeta) return a;
          const vol = a.tipo === "cripto" ? 0.04 : a.tipo === "fii" ? 0.012 : a.tipo === "tesouro" ? 0.005 : 0.025;
          return { ...a, preco: +simulateTick(a.preco, vol).toFixed(2), ultimaAtt: new Date().toISOString(), realtime: false };
        }));
        setMarketStatus({ at: new Date(), mode: "sim", okCount: 0, total: ativos.length });
        setRefreshing(false);
      }, 600);
      return;
    }

    // Modo real: usa lib/cotacoes.js (BRAPI pra ações/FIIs + Binance pra cripto)
    try {
      // Para Binance, traduz ticker BR de cripto (BTC, ETH) pra pair USDT.
      // CDBs de meta rendem a CDI sozinhos — fora da cotação de mercado.
      const ativosComSymbol = ativos.filter(a => !a._cdbMeta).map(a => {
        if (a.tipo === "cripto" && !/USDT$/i.test(a.ticker)) {
          return { ...a, _symbolCotacao: `${a.ticker.toUpperCase()}USDT` };
        }
        return { ...a, _symbolCotacao: a.ticker };
      });

      const lista = ativosComSymbol.map(a => ({ symbol: a._symbolCotacao, ticker: a._symbolCotacao }));
      const { cotacoes, erros } = await atualizarCarteira(lista);

      let okCount = 0;
      setAtivos(prev => prev.map(a => {
        // CDB de meta rende a CDI sozinho — nunca recebe cotação nem tick de mercado.
        if (a._cdbMeta) return a;
        const sym = a.tipo === "cripto" && !/USDT$/i.test(a.ticker)
          ? `${a.ticker.toUpperCase()}USDT`
          : a.ticker;
        const cot = cotacoes[sym];
        if (cot && cot.price) {
          okCount++;
          return {
            ...a,
            preco: +parseFloat(cot.price).toFixed(2),
            variacao24h: cot.changePercent ?? a.variacao24h,
            ultimaAtt: new Date().toISOString(),
            realtime: true,
            fonteCotacao: cot.fonte,
          };
        }
        // Fallback: tick simulado pra ativos sem cotação real
        const vol = a.tipo === "tesouro" ? 0.005 : a.tipo === "cdb" ? 0.003 : 0.012;
        return { ...a, preco: +simulateTick(a.preco, vol).toFixed(2), ultimaAtt: new Date().toISOString(), realtime: false };
      }));

      setMarketStatus({
        at: new Date(),
        mode: okCount > 0 ? "real" : "sim",
        okCount,
        total: ativos.length,
        erros,
      });
    } catch (e) {
      console.error("[refreshMarket]", e);
      setMarketStatus({ at: new Date(), mode: "sim", okCount: 0, total: ativos.length, erros: [e.message] });
    } finally {
      setRefreshing(false);
    }
  };

  // Polling automático de cotações.
  // Intervalo (em minutos) lido do localStorage; 0 = desligado (padrão).
  // O SettingsModal salva o valor e dispara `af4:polling-changed` pra
  // reagendar sem reload. Polling pausa quando a aba não está visível.
  const refreshRef = useRef(refreshMarket);
  refreshRef.current = refreshMarket;
  useEffect(() => {
    if (loading) return;
    let timer;
    const setupTimer = () => {
      if (timer) { clearTimeout(timer); timer = null; }
      const min = Number(localStorage.getItem("af4:invest:polling-min")) || 0;
      if (min <= 0) return;
      const ms = Math.max(30_000, min * 60_000);
      const tick = () => {
        if (typeof document !== "undefined" && document.visibilityState === "visible") {
          try { refreshRef.current(); } catch {}
        }
        timer = setTimeout(tick, ms);
      };
      timer = setTimeout(tick, ms);
    };
    setupTimer();
    const onChange = () => setupTimer();
    window.addEventListener("af4:polling-changed", onChange);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("af4:polling-changed", onChange);
    };
  }, [loading]);

  if (loading) {
    return (
      <div style={{ background: T.bg, color: T.ink, fontFamily: T.body }}
           className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div style={{ fontFamily: T.serif, color: T.gold }} className="text-3xl italic">Carregando seu patrimônio…</div>
          <div style={{ color: T.muted }} className="mt-2 text-sm tracking-widest uppercase">Recuperando dados persistentes</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: T.body, minHeight: "100vh" }}>
      <GlobalStyles />
      <Header
        modulo={modulo} setModulo={setModulo}
        tab={tab} setTab={(t) => { setCartaoAberto(null); setContaAberta(null); setTab(t); }}
        contas={contas} cartoes={cartoes}
        contaAberta={contaAberta} setContaAberta={setContaAberta}
        cartaoAberto={cartaoAberto} setCartaoAberto={setCartaoAberto}
        hidden={hidden} setHidden={setHidden}
        ehGestor={ehGestor} userEmail={userEmail}
        escopoAtivo={escopoAtivo}
        onEscopoChange={(novo) => { setEscopoAtivo(novo); salvarEscopo(novo); }}
        onOpenPalette={() => setPaletaAberta(true)}
        onRefresh={refreshMarket} refreshing={refreshing}
        onOpenSettings={(kind, value) => {
          if (kind === "paleta" && value) {
            setThemeId(value);
            try { localStorage.setItem("af4:last-theme:" + (THEMES[value]?.dark ? "dark" : "light"), value); } catch {}
          }
          if (kind === "toggle-tema") {
            // ★ Alterna entre o último escuro e o último claro escolhidos
            const isDark = THEMES[themeId]?.dark;
            try {
              if (isDark) {
                const lastLight = localStorage.getItem("af4:last-theme:light") || "linho";
                setThemeId(lastLight);
              } else {
                const lastDark = localStorage.getItem("af4:last-theme:dark") || "gold";
                setThemeId(lastDark);
              }
            } catch {
              setThemeId(isDark ? "linho" : "gold");
            }
          }
          if (kind === "perfis") setPerfisOpen(true);
        }}
        onQuickAction={(kind) => {
          // ★ atalhos rápidos do header sempre disponíveis
          if (kind === "transacao") {
            setCartaoAberto(null); setContaAberta(null);
            setModulo("financas"); setTab("transacoes");
            handleCreateTransacao(contas[0]?.nome || "");
          } else if (kind === "aporte") {
            setCartaoAberto(null); setContaAberta(null);
            setModulo("invest"); setTab("investimentos");
            window.dispatchEvent(new CustomEvent("af4:open-new-aporte"));
          }
        }}
        pendingCounts={pendingCounts}
        onLogout={handleLogout}
      />

      <KeyboardShortcuts
        setTab={(t) => { setCartaoAberto(null); setContaAberta(null); setTab(t); }}
        transacoes={transacoes} contas={contas}
        ativos={ativos} cartoes={cartoes}
      />

      {pickerOpen && (
        <ThemePicker themeId={themeId} setThemeId={setThemeId} onClose={() => setPickerOpen(false)} />
      )}

      {settingsOpen && (
        <SettingsModal apiKeys={apiKeys} setApiKeys={setApiKeys} onClose={() => setSettingsOpen(false)} />
      )}


      <main
        className={isVertical ? "pb-24" : "max-w-7xl mx-auto pb-24"}
        style={isVertical ? { marginLeft: 220, maxWidth: "none", transition: "margin-left .2s" } : undefined}
      >
        {/* MÓDULO: FINANÇAS */}
        {modulo === "financas" && (
          <div className="px-6 md:px-10">
            {tab === "gerencial" && ehGestor && (
              <Gerencial clientes={clientes} setClientes={setClientes}
                         curadoria={curadoria} setCuradoria={setCuradoria}
                         planos={planos} setPlanos={setPlanos}
                         config={gerencialConfig} setConfig={setGerencialConfig}
                         gestorEmail={userEmail} />
            )}
            {tab === "dashboard" && (
              <Dashboard totais={totais} hidden={hidden} contas={contas} ativos={ativos}
                         transacoes={transacoes} categorias={categorias} metas={metas}
                         cartoes={cartoes} parcelamentos={parcelamentos}
                         devedores={devedores} dividas={dividas}
                         fixas={fixas} fixaOcorrencias={fixaOcorrencias}
                         agenda={agenda}
                         patrimonioHistorico={patrimonioHistorico}
                         escopoAtivo={escopoAtivo}
                         onTabChange={(t) => { setCartaoAberto(null); setContaAberta(null); setTab(t); }}
                         onContaClick={(c) => { setTab("contas"); setContaAberta(c); }} />
            )}
            {tab === "contas" && !contaAberta && (
              <div className="px-6 md:px-10">
                <Contas contas={contas} setContas={setContas} hidden={hidden}
                        transacoes={transacoes} setTransacoes={setTransacoes}
                        categorias={categorias}
                        escopoAtivo={escopoAtivo}
                        onCreateTransacao={handleCreateTransacao}
                        contaAtiva={contaAberta}
                        onContaClick={setContaAberta} />
              </div>
            )}
            {tab === "contas" && contaAberta && (
              <div className="px-6 md:px-10">
                <ContaExtrato conta={contaAberta}
                              contas={contas} setContas={setContas}
                              transacoes={transacoes}
                              setTransacoes={setTransacoes}
                              categorias={categorias}
                              hidden={hidden}
                              onVoltar={() => setContaAberta(null)} />
              </div>
            )}
            {(tab === "areceber" || tab === "fixas" || tab === "relatorios-anual" || tab === "planejamento") && (
              <Planejamento
                transacoes={transacoes} setTransacoes={setTransacoes}
                contas={contas} setContas={setContas}
                categorias={categorias} setCategorias={setCategorias}
                devedores={devedores} setDevedores={setDevedores}
                dividas={dividas} setDividas={setDividas}
                fixas={fixas} setFixas={setFixas}
                fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
                parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
                cartoes={cartoes} setCartoes={setCartoes}
                metas={metas} setMetas={setMetas}
                escopoAtivo={escopoAtivo}
                tab={tab}
                hidden={hidden}
              />
            )}
            {tab === "despesas" && (
              <Despesas
                transacoes={transacoes} setTransacoes={setTransacoes}
                fixas={fixas} setFixas={setFixas}
                fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
                parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
                dividas={dividas} setDividas={setDividas}
                contas={contas} setContas={setContas}
                categorias={categorias}
                cartoes={cartoes}
                hidden={hidden}
              />
            )}
            {tab === "audit" && (
              <div className="px-6 md:px-10">
                <AuditLog />
              </div>
            )}
            {tab === "perguntar" && (
              <div className="px-6 md:px-10">
                <PergunteAoClaude
                  apiKey={apiKeys.anthropic}
                  transacoes={transacoes} contas={contas} ativos={ativos}
                  devedores={devedores} dividas={dividas}
                />
              </div>
            )}
            {tab === "cartoes" && !cartaoAberto && (
              <div className="px-6 md:px-10">
                <Cartoes cartoes={cartoes} setCartoes={setCartoes}
                         parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
                         contas={contas} setContas={setContas}
                         transacoes={transacoes} setTransacoes={setTransacoes}
                         fixas={fixas} setFixas={setFixas}
                         fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
                         categorias={categorias}
                         hidden={hidden}
                         cartaoAtivo={cartaoAberto}
                         onCartaoClick={setCartaoAberto} />
              </div>
            )}
            {tab === "cartoes" && cartaoAberto && (
              <div className="px-6 md:px-10">
                <CartaoExtrato cartao={cartaoAberto}
                               transacoes={transacoes}
                               setTransacoes={setTransacoes}
                               parcelamentos={parcelamentos}
                               setParcelamentos={setParcelamentos}
                               categorias={categorias}
                               onVoltar={() => setCartaoAberto(null)}
                               hidden={hidden} />
              </div>
            )}
            {tab === "relatorios-f" && (
              <RelatoriosFinancas transacoes={transacoes} contas={contas}
                                  categorias={categorias}
                                  fixas={fixas} fixaOcorrencias={fixaOcorrencias}
                                  parcelamentos={parcelamentos} dividas={dividas} devedores={devedores}
                                  patrimonioHistorico={patrimonioHistorico}
                                  escopoAtivo={escopoAtivo}
                                  hidden={hidden} />
            )}
            {tab === "transacoes" && (
              <Transacoes transacoes={transacoes} setTransacoes={setTransacoes}
                          categorias={categorias} contas={contas} setContas={setContas}
                          ativos={ativos} totais={totais}
                          parcelamentos={parcelamentos} cartoes={cartoes}
                          pendingTransacao={pendingTransacao}
                          clearPendingTransacao={handleClearPending}
                          apiKey={apiKeys.anthropic}
                          escopoAtivo={escopoAtivo}
                          hidden={hidden} />
            )}
            {tab === "categorias" && (
              <Categorias categorias={categorias} setCategorias={setCategorias} transacoes={transacoes}
                          escopoAtivo={escopoAtivo} hidden={hidden} />
            )}
            {/* Rotas antigas (fixas, relatorios-anual, areceber) consolidadas em Planejamento — ver bloco unificado acima */}
            {tab === "analiseia" && (
              <AnaliseFatura
                categorias={categorias} setCategorias={setCategorias}
                transacoes={transacoes} setTransacoes={setTransacoes}
                contas={contas} setContas={setContas}
                cartoes={cartoes} setCartoes={setCartoes}
                fixas={fixas} setFixas={setFixas}
                fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
                parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
                apiKeys={apiKeys} hidden={hidden}
              />
            )}
          </div>
        )}

        {/* AGENDA — agora incorporada ao módulo Finanças (as tabs vivem em financas). */}
        {modulo === "financas" && (
          <div className="px-6 md:px-10">
            {tab === "inicio" && (
              <AgendaInicio
                agenda={agenda} tarefas={tarefas} ideias={ideias}
                compras={compras} metas={metas}
                setTab={setTab}
              />
            )}
            {tab === "notas" && (
              <Notas agenda={agenda} setAgenda={setAgenda}
                     notasLegacy={notas} setNotasLegacy={setNotas} />
            )}
            {tab === "calendario" && (
              <Calendario transacoes={transacoes} setTransacoes={setTransacoes}
                          contas={contas} setContas={setContas}
                          categorias={categorias} hidden={hidden}
                          fixas={fixas} fixaOcorrencias={fixaOcorrencias}
                          parcelamentos={parcelamentos} dividas={dividas} devedores={devedores}
                          agenda={agenda} setAgenda={setAgenda}
                          escopoAtivo={escopoAtivo} />
            )}
            {tab === "tarefas" && (
              <Tarefas tarefas={tarefas} setTarefas={setTarefas} />
            )}
            {tab === "ideias" && (
              <Ideias ideias={ideias} setIdeias={setIdeias} />
            )}
            {tab === "sugestoes" && (
              <SugestoesMelhorias sugestoes={sugestoes} setSugestoes={setSugestoes} />
            )}
            {tab === "metas" && (
              <Metas metas={metas} setMetas={setMetas} hidden={hidden}
                     fixas={fixas} setFixas={setFixas}
                     fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
                     categorias={categorias} contas={contas} setContas={setContas}
                     transacoes={transacoes} setTransacoes={setTransacoes}
                     ativos={ativos} setAtivos={setAtivos} />
            )}
            {tab === "compras" && (
              <Compras compras={compras} setCompras={setCompras} />
            )}
            {tab === "habitos" && (
              <Habitos habitos={habitos} setHabitos={setHabitos} />
            )}
            {tab === "diario" && (
              <Diario diario={diario} setDiario={setDiario} />
            )}
          </div>
        )}

        {/* MÓDULO: CONFIGURAÇÕES */}
        {modulo === "config" && (
          <Configuracoes subtab={tab} ehGestor={ehGestor}
                         themeId={themeId} setThemeId={setThemeId}
                         apiKeys={apiKeys} setApiKeys={setApiKeys}
                         modulesEnabled={modulesEnabled} setModulesEnabled={setModulesEnabled}
                         onClearModule={async (id) => {
                           // Calcula snapshot zerado e força save imediato
                           // (bypass do debounce de 1.5s — senão recarregar
                           // antes do timer faz a versão antiga voltar do cloud).
                           const cleared = {
                             contas, categorias, transacoes, ativos, metas, notas,
                             cartoes, parcelamentos, devedores, dividas, themeId,
                           };
                           if (id === "financas") {
                             cleared.contas = []; cleared.cartoes = []; cleared.parcelamentos = [];
                             cleared.transacoes = []; cleared.categorias = [];
                             cleared.metas = []; cleared.notas = []; cleared.devedores = []; cleared.dividas = [];
                             setContas([]); setCartoes([]); setParcelamentos([]);
                             setTransacoes([]); setCategorias([]);
                             setMetas([]); setNotas([]); setDevedores([]); setDividas([]);
                           }
                           await saveAll(cleared, { immediate: true });
                         }} />
        )}
      </main>

      <Footer />
      <BottomTabBar
        modulo={modulo} setModulo={setModulo} tab={tab} ehGestor={ehGestor}
        setTab={(t) => { setCartaoAberto(null); setContaAberta(null); setTab(t); }}
      />
      <PomodoroFloat />
      <ToastContainer />
      <InstallPWA />
      <ConfirmDialog />
      {atalhosVisivel && <AtalhosOverlay onClose={() => setAtalhosVisivel(false)} />}
      <CommandPalette
        open={paletaAberta}
        onClose={() => setPaletaAberta(false)}
        onNavigate={({ modulo: m, tab: t }) => {
          setModulo(m);
          setCartaoAberto(null); setContaAberta(null);
          setTab(t);
        }}
      />
    </div>
  );
}
