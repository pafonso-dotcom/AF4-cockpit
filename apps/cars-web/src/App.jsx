import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";

import { T, applyTheme, THEMES } from "./lib/theme.js";
import { simulateTick, uid } from "./lib/format.js";
import { somaContasBRL } from "./lib/cambio.js";
import { loadAll, saveAll, loadKeys, saveKeys, flushSave } from "./lib/storage.js";
import { API, COIN_MAP } from "./lib/api.js";
import { generateRecurringForCurrentMonth } from "./lib/recorrencia.js";
import { lerEscopo, salvarEscopo, migrarEscoposAuto } from "./lib/escopo.js";
import { toast } from "./lib/toast.js";
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
import OnboardingTradeModal from "./components/modals/OnboardingTradeModal.jsx";
import PomodoroFloat from "./components/PomodoroFloat.jsx";

// Páginas carregadas sob demanda (code-splitting por aba). Cada página vira um
// chunk próprio, então o bundle inicial não carrega Negócio/Treino/Invest etc.
// só pra abrir o Dashboard. O <Suspense> que envolve o <main> mostra o fallback
// enquanto o chunk da aba é baixado.
const AnaliseTrade = lazy(() => import("./components/pages/Trade/Analise.jsx"));
const Dashboard = lazy(() => import("./components/pages/Dashboard.jsx"));
const Contas = lazy(() => import("./components/pages/Contas.jsx"));
const Cartoes = lazy(() => import("./components/pages/Cartoes.jsx"));
const Transacoes = lazy(() => import("./components/pages/Transacoes.jsx"));
const Calendario = lazy(() => import("./components/pages/Calendario.jsx"));
const Categorias = lazy(() => import("./components/pages/Categorias.jsx"));
const Metas = lazy(() => import("./components/pages/Metas.jsx"));
const Notas = lazy(() => import("./components/pages/Notas.jsx"));
const Habitos = lazy(() => import("./components/pages/Habitos.jsx"));
const Diario = lazy(() => import("./components/pages/Diario.jsx"));
const Compras = lazy(() => import("./components/pages/Compras.jsx"));
const Ideias = lazy(() => import("./components/pages/Ideias.jsx"));
const Tarefas = lazy(() => import("./components/pages/Tarefas.jsx"));
const SugestoesMelhorias = lazy(() => import("./components/pages/SugestoesMelhorias.jsx"));
const AgendaInicio = lazy(() => import("./components/pages/AgendaInicio.jsx"));
const Despesas = lazy(() => import("./components/pages/Despesas.jsx"));
const Planejamento = lazy(() => import("./components/pages/Planejamento/index.jsx"));
const AnaliseFatura = lazy(() => import("./components/pages/AnaliseFatura.jsx"));
const Investimentos = lazy(() => import("./components/pages/Investimentos.jsx"));
const Mercado = lazy(() => import("./components/pages/Mercado.jsx"));
const Simulador = lazy(() => import("./components/pages/Simulador.jsx"));
const CalculadoraRenda = lazy(() => import("./components/pages/Invest/CalculadoraRenda.jsx"));
const Projecao = lazy(() => import("./components/pages/Invest/Projecao.jsx"));
const AnalisesUnificada = lazy(() => import("./components/pages/Invest/Analises.jsx"));
const ObjetivosCarteira = lazy(() => import("./components/pages/Invest/ObjetivosCarteira.jsx"));
const CarteiraModelo = lazy(() => import("./components/pages/Invest/CarteiraModelo.jsx"));
const MonteSuaCarteira = lazy(() => import("./components/pages/Invest/MonteSuaCarteira.jsx"));
const InvestPainel = lazy(() => import("./components/pages/Invest/InvestPainel.jsx"));
const Proventos = lazy(() => import("./components/pages/Invest/Proventos.jsx"));
const RelatoriosInvest = lazy(() => import("./components/pages/Invest/RelatoriosInvest.jsx"));
const RelatoriosFinancas = lazy(() => import("./components/pages/RelatoriosFinancas.jsx"));
const CartaoExtrato = lazy(() => import("./components/pages/CartaoExtrato.jsx"));
const ContaExtrato = lazy(() => import("./components/pages/ContaExtrato.jsx"));
const AuditLog = lazy(() => import("./components/pages/AuditLog.jsx"));
const PergunteAoClaude = lazy(() => import("./components/pages/PergunteAoClaude.jsx"));
const Configuracoes = lazy(() => import("./components/pages/Configuracoes.jsx"));
const NegocioPainel = lazy(() => import("./components/pages/Negocio/NegocioPainel.jsx"));
const NegocioVeiculos = lazy(() => import("./components/pages/Negocio/Veiculos.jsx"));
const NegocioServicos = lazy(() => import("./components/pages/Negocio/Servicos.jsx"));
const NegocioClientes = lazy(() => import("./components/pages/Negocio/Clientes.jsx"));
const Lembretes = lazy(() => import("./components/pages/Lembretes.jsx"));
const Conversa = lazy(() => import("./components/pages/Conversa.jsx"));
const Treino = lazy(() => import("./components/pages/Treino.jsx"));
import { EXERCICIOS_BASE } from "./lib/exerciciosBase.js";

// Fallback enquanto o chunk de uma aba (lazy) é baixado.
function PageFallback() {
  return (
    <div style={{ padding: "64px 24px", textAlign: "center", color: T.muted }}>
      <div style={{ fontFamily: T.serif, color: T.gold, fontSize: 18, fontStyle: "italic" }}>Carregando…</div>
    </div>
  );
}

function ConversaFABInput({ onAbrirCompleto }) {
  return (
    <div>
      <p style={{ fontSize: 11, color: T.muted, margin: "0 0 8px" }}>
        Clique para abrir a conversa completa.
      </p>
      <button className="btn-gold" style={{ width: "100%" }} onClick={onAbrirCompleto}>
        Abrir Conversa
      </button>
    </div>
  );
}

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
  const [themeId, setThemeId] = useState("moderno");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modulesEnabled, setModulesEnabled] = useState({ financas: true, invest: true });
  const [apiKeys, setApiKeys] = useState({ brapi: "", alphavantage: "", anthropic: "", useRealMarket: true });
  const [marketStatus, setMarketStatus] = useState({ at: null, mode: "sim", okCount: 0, total: 0 });
  const [cartaoAberto, setCartaoAberto] = useState(null);
  const [contaAberta, setContaAberta] = useState(null);
  const [conversaFABOpen, setConversaFABOpen] = useState(false);

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
  const [lembretes,         setLembretes]         = useState([]);
  const [conversaHistorico, setConversaHistorico] = useState([]);
  const [exerciciosDB,      setExerciciosDB]      = useState([]);
  const [treinoTemplates,   setTreinoTemplates]   = useState([]);
  const [treinos,           setTreinos]           = useState([]);
  // Histórico do patrimônio (snapshot diário do total = ativos + contas).
  // Array de { data: "YYYY-MM-DD", totalAtivos, totalContas, total }.
  const [patrimonioHistorico, setPatrimonioHistorico] = useState([]);

  // ===== Módulo NEGÓCIO (revenda de carros + serviços) =====
  // Estrutura inicial; cada array recebe handlers/UIs em PRs seguintes.
  const [negocioVeiculos,        setNegocioVeiculos]        = useState([]); // estoque
  const [negocioVendasVeiculos,  setNegocioVendasVeiculos]  = useState([]); // vendas de carros
  const [negocioServicos,        setNegocioServicos]        = useState([]); // catálogo de serviços
  const [negocioVendasServicos,  setNegocioVendasServicos]  = useState([]); // vendas de serviços
  const [negocioContratos,       setNegocioContratos]       = useState([]); // contratos recorrentes (CRM, tráfego, app, etc)
  const [negocioClientes,        setNegocioClientes]        = useState([]); // clientes
  const [negocioInstaladores,    setNegocioInstaladores]    = useState([]); // instaladores (executam serviços, recebem do caixa)

  // Objetivos da carteira (árvore IdV-style)
  const [objetivosCarteira, setObjetivosCarteira] = useState([]);

  // Carteiras modelo IdV (custom + builtin) + qual está ativo
  const [carteirasModeloCustom, setCarteirasModeloCustom] = useState([]);
  const [modeloAtivoId, setModeloAtivoId] = useState("idv-iniciante");

  // Carteira virtual de proventos (saldo + histórico de movimentações)
  // Modelo: { saldo: number, historico: [{id, data, tipo, valor, descricao, proventoKey?, ticker?}] }
  const [carteiraProventos, setCarteiraProventos] = useState({ saldo: 0, historico: [] });
  // Caixa virtual do Negócio (saldo + histórico de movimentações)
  // Receitas de venda de veículos / serviços / faturas recorrentes entram
  // aqui em vez de criar transação em Finanças.
  // Modelo: { saldo: number, historico: [{id, data, tipo, valor, descricao, vendaId?, contratoId?, ts}] }
  const [caixaNegocio, setCaixaNegocio] = useState({ saldo: 0, historico: [] });
  // Banco do Serviço: contas próprias do negócio de serviços, totalmente
  // independentes das Contas/Finanças do cockpit. Modelo: [{ id, nome, saldo }].
  const [negocioBancos, setNegocioBancos] = useState([]);
  // Proventos marcados como recebidos: { [proventoKey]: { dataBaixa, destino, valor } }
  const [proventosRecebidos, setProventosRecebidos] = useState({});
  // Proventos que o user marcou como "Ignorados" (não interessam, foram
  // excluídos da lista de previstos). Persistidos junto com o resto.
  const [proventosIgnorados, setProventosIgnorados] = useState({});
  // Proventos lançados manualmente pelo user (extrato real, ajuste,
  // provento que o sistema não previu, etc). Array de objetos com o
  // mesmo shape de calendarioProventos + manual: true.
  const [proventosManuais, setProventosManuais] = useState([]);

  // AF4 Trade
  const [tradeWatchlist, setTradeWatchlist] = useState([]);
  const [tradeHistorico, setTradeHistorico] = useState([]);
  const [tradeAnalisesIdV, setTradeAnalisesIdV] = useState([]);
  const [tradeOnboardingVisto, setTradeOnboardingVisto] = useState(false);
  const [analiseAlvo, setAnaliseAlvo] = useState(null);
  const [projetarAlvo, setProjetarAlvo] = useState(null);
  // View inicial pra AnalisesUnificada — quando InvestPainel pede pra
  // abrir direto em "carteira-analise" ou "idv", esse state sinaliza.
  const [analiseViewInicial, setAnaliseViewInicial] = useState(null);

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
        setLembretes(data.lembretes || []);
        setConversaHistorico(data.conversaHistorico || []);
        setExerciciosDB(prev => {
          if (data.exerciciosDB && data.exerciciosDB.length > 0) return data.exerciciosDB;
          return prev;
        });
        setTreinoTemplates(data.treinoTemplates || []);
        setTreinos(data.treinos || []);
        setPatrimonioHistorico(data.patrimonioHistorico || []);
        setNegocioVeiculos(data.negocioVeiculos || []);
        setNegocioVendasVeiculos(data.negocioVendasVeiculos || []);
        setNegocioServicos(data.negocioServicos || []);
        setNegocioVendasServicos(data.negocioVendasServicos || []);
        setNegocioContratos(data.negocioContratos || []);
        setNegocioClientes(data.negocioClientes || []);
        setNegocioInstaladores(data.negocioInstaladores || []);
        setObjetivosCarteira(data.objetivosCarteira || []);
        setCarteirasModeloCustom(data.carteirasModeloCustom || []);
        if (data.modeloAtivoId) setModeloAtivoId(data.modeloAtivoId);
        setCarteiraProventos(data.carteiraProventos || { saldo: 0, historico: [] });
        setCaixaNegocio(data.caixaNegocio || { saldo: 0, historico: [] });
        setNegocioBancos(data.negocioBancos || []);
        setProventosRecebidos(data.proventosRecebidos || {});
        setProventosIgnorados(data.proventosIgnorados || {});
        setProventosManuais(data.proventosManuais || []);
        setTradeWatchlist(data.tradeWatchlist || []);
        setTradeHistorico(data.tradeHistorico || []);
        setTradeAnalisesIdV(data.tradeAnalisesIdV || []);
        setTradeOnboardingVisto(!!data.tradeOnboardingVisto);
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
        setNegocioVeiculos([]);
        setNegocioVendasVeiculos([]);
        setNegocioServicos([]);
        setNegocioVendasServicos([]);
        setNegocioContratos([]);
        setNegocioClientes([]);
        setNegocioInstaladores([]);
        setObjetivosCarteira([]);
        setCarteirasModeloCustom([]);
        setCarteiraProventos({ saldo: 0, historico: [] });
        setCaixaNegocio({ saldo: 0, historico: [] });
        setNegocioBancos([]);
        setProventosRecebidos({});
        setProventosIgnorados({});
        setProventosManuais([]);
        setTradeWatchlist([]);
        setTradeHistorico([]);
        setTradeAnalisesIdV([]);
        setTradeOnboardingVisto(false);
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
        setExerciciosDB(prev => {
          if (prev.length > 0) return prev;
          return EXERCICIOS_BASE;
        });
        setLoading(false);
      }
    })();
  }, []);

  /* ---------- Save on change ---------- */
  useEffect(() => {
    if (loading) return;
    saveAll({
      contas, categorias, transacoes, ativos, metas, notas,
      cartoes, parcelamentos, devedores, dividas,
      fixas, fixaOcorrencias, agenda,
      habitos, diario, compras, ideias, tarefas, sugestoes, patrimonioHistorico, objetivosCarteira,
      negocioVeiculos, negocioVendasVeiculos, negocioServicos, negocioVendasServicos, negocioContratos, negocioClientes, negocioInstaladores,
      carteirasModeloCustom, modeloAtivoId,
      carteiraProventos, proventosRecebidos, proventosIgnorados, proventosManuais,
      caixaNegocio, negocioBancos,
      tradeWatchlist, tradeHistorico, tradeAnalisesIdV, tradeOnboardingVisto,
      lembretes, conversaHistorico, exerciciosDB, treinoTemplates, treinos,
      themeId,
    });
  }, [contas, categorias, transacoes, ativos, metas, notas, cartoes, parcelamentos, devedores, dividas,
      fixas, fixaOcorrencias, agenda,
      habitos, diario, compras, ideias, tarefas, sugestoes, patrimonioHistorico, objetivosCarteira,
      negocioVeiculos, negocioVendasVeiculos, negocioServicos, negocioVendasServicos, negocioContratos, negocioClientes, negocioInstaladores,
      carteirasModeloCustom, modeloAtivoId,
      carteiraProventos, proventosRecebidos, proventosIgnorados, proventosManuais,
      caixaNegocio, negocioBancos,
      tradeWatchlist, tradeHistorico, tradeAnalisesIdV, tradeOnboardingVisto,
      lembretes, conversaHistorico, exerciciosDB, treinoTemplates, treinos,
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
    const totalContas = somaContasBRL(contas);
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
    const saldoContas = somaContasBRL(contas);
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

      {perfisOpen && (
        <PerfisModal onClose={() => setPerfisOpen(false)} />
      )}

      <main
        className={isVertical ? "pb-24" : ((tab === "planejamento" || tab === "areceber" || tab === "fixas" || tab === "relatorios-anual") ? "pb-24" : "max-w-7xl mx-auto pb-24")}
        style={isVertical ? { marginLeft: 220, maxWidth: "none", transition: "margin-left .2s" } : undefined}
      >
        <Suspense fallback={<PageFallback />}>
        {/* MÓDULO: FINANÇAS */}
        {modulo === "financas" && (
          <div className="px-6 md:px-10">
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
                  onSaveKey={(k) => setApiKeys(prev => ({ ...prev, anthropic: k }))}
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
                         categorias={categorias} setCategorias={setCategorias}
                         apiKeys={apiKeys}
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
                lembretes={lembretes}
                treinos={treinos}
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
            {tab === "lembretes" && (
              <Lembretes lembretes={lembretes} setLembretes={setLembretes} />
            )}
            {tab === "conversa" && (
              <Conversa
                conversaHistorico={conversaHistorico}
                setConversaHistorico={setConversaHistorico}
                transacoes={transacoes} setTransacoes={setTransacoes}
                categorias={categorias}
                agenda={agenda} setAgenda={setAgenda}
                tarefas={tarefas} setTarefas={setTarefas}
                lembretes={lembretes} setLembretes={setLembretes}
                treinos={treinos}
                apiKeys={apiKeys}
                hidden={hidden}
              />
            )}
            {tab === "treino" && (
              <Treino
                treinos={treinos} setTreinos={setTreinos}
                exerciciosDB={exerciciosDB} setExerciciosDB={setExerciciosDB}
                treinoTemplates={treinoTemplates} setTreinoTemplates={setTreinoTemplates}
                apiKeys={apiKeys}
              />
            )}
          </div>
        )}

        {/* MÓDULO: NEGÓCIO (revenda + serviços) */}
        {modulo === "negocio" && (
          <div className="px-6 md:px-10">
            {(tab === "negocio-painel" || !tab.startsWith("negocio-")) && (
              <NegocioPainel
                negocioVeiculos={negocioVeiculos}
                negocioVendasVeiculos={negocioVendasVeiculos}
                negocioServicos={negocioServicos}
                negocioVendasServicos={negocioVendasServicos}
                negocioClientes={negocioClientes}
                caixaNegocio={caixaNegocio}
                hidden={hidden}
                onTabChange={(t) => setTab(t)}
              />
            )}
            {tab === "negocio-veiculos" && (
              <NegocioVeiculos
                veiculos={negocioVeiculos} setVeiculos={setNegocioVeiculos}
                vendas={negocioVendasVeiculos} setVendas={setNegocioVendasVeiculos}
                clientes={negocioClientes}
                contas={contas} setContas={setContas}
                transacoes={transacoes} setTransacoes={setTransacoes}
                categorias={categorias}
                caixaNegocio={caixaNegocio} setCaixaNegocio={setCaixaNegocio}
                hidden={hidden}
              />
            )}
            {tab === "negocio-servicos" && (
              <NegocioServicos
                servicos={negocioServicos} setServicos={setNegocioServicos}
                vendas={negocioVendasServicos} setVendas={setNegocioVendasServicos}
                contratos={negocioContratos} setContratos={setNegocioContratos}
                clientes={negocioClientes}
                veiculos={negocioVeiculos}
                instaladores={negocioInstaladores} setInstaladores={setNegocioInstaladores}
                bancos={negocioBancos} setBancos={setNegocioBancos}
                caixaNegocio={caixaNegocio} setCaixaNegocio={setCaixaNegocio}
                hidden={hidden}
              />
            )}
            {tab === "negocio-clientes" && (
              <NegocioClientes
                clientes={negocioClientes} setClientes={setNegocioClientes}
                vendasVeiculos={negocioVendasVeiculos}
                vendasServicos={negocioVendasServicos}
                hidden={hidden}
              />
            )}
          </div>
        )}

        {/* MÓDULO: INVESTIMENTOS */}
        {modulo === "invest" && (
          <>
            {tab === "investimentos" && (
              <InvestPainel ativos={ativos} transacoes={transacoes} categorias={categorias} hidden={hidden}
                            apiKeys={apiKeys}
                            onTabChange={(t) => { setCartaoAberto(null); setContaAberta(null); setTab(t); }}
                            onAbrirAnaliseCarteira={() => { setAnaliseViewInicial("carteira-analise"); setTab("analises"); }}
                            onAbrirAnaliseIdv={() => { setAnaliseViewInicial("idv"); setTab("analises"); }}
                            onAnalisar={(ativo) => { setAnaliseAlvo(ativo); setTab("trade-ativo"); }} />
            )}
            {tab === "analises" && (
              <div className="px-6 md:px-10">
                <AnalisesUnificada
                  ativos={ativos} hidden={hidden}
                  tradeAnalisesIdV={tradeAnalisesIdV} setTradeAnalisesIdV={setTradeAnalisesIdV}
                  onAnalisarAtivo={(ativo) => { setAnaliseAlvo(ativo); setTab("trade-ativo"); }}
                  apiKeys={apiKeys}
                  viewInicial={analiseViewInicial}
                  onConsumirViewInicial={() => setAnaliseViewInicial(null)}
                />
              </div>
            )}
            {tab === "carteira" && (
              <div className="px-6 md:px-10">
                <Investimentos ativos={ativos} setAtivos={setAtivos}
                               contas={contas} setContas={setContas}
                               categorias={categorias}
                               transacoes={transacoes} setTransacoes={setTransacoes}
                               onRefresh={refreshMarket} refreshing={refreshing}
                               onAnalisar={(ativo) => { setAnaliseAlvo(ativo); setTab("trade-ativo"); }}
                               onProjetar={(ativo) => { setProjetarAlvo(ativo); setTab("projecao"); }}
                               hidden={hidden} />
              </div>
            )}
            {tab === "objetivos" && (
              <div className="px-6 md:px-10">
                <ObjetivosCarteira
                  ativos={ativos}
                  objetivosCarteira={objetivosCarteira}
                  setObjetivosCarteira={setObjetivosCarteira}
                  hidden={hidden}
                  apiKeys={apiKeys}
                />
              </div>
            )}
            {tab === "modelo" && (
              <div className="px-6 md:px-10">
                <CarteiraModelo
                  ativos={ativos}
                  carteirasModeloCustom={carteirasModeloCustom}
                  setCarteirasModeloCustom={setCarteirasModeloCustom}
                  modeloAtivoId={modeloAtivoId}
                  setModeloAtivoId={setModeloAtivoId}
                  hidden={hidden}
                  apiKeys={apiKeys}
                />
              </div>
            )}
            {tab === "monte-carteira" && (
              <div className="px-6 md:px-10">
                <MonteSuaCarteira ativos={ativos} apiKey={apiKeys.anthropic} />
              </div>
            )}
            {tab === "proventos" && (
              <Proventos
                ativos={ativos} setAtivos={setAtivos}
                hidden={hidden}
                carteiraProventos={carteiraProventos}
                setCarteiraProventos={setCarteiraProventos}
                proventosRecebidos={proventosRecebidos}
                setProventosRecebidos={setProventosRecebidos}
                proventosIgnorados={proventosIgnorados}
                setProventosIgnorados={setProventosIgnorados}
                proventosManuais={proventosManuais}
                setProventosManuais={setProventosManuais}
                contas={contas} setContas={setContas}
                categorias={categorias}
                transacoes={transacoes} setTransacoes={setTransacoes}
              />
            )}
            {tab === "relatorios-i" && <RelatoriosInvest ativos={ativos} transacoes={transacoes} patrimonioHistorico={patrimonioHistorico} proventos={[]} operacoes={[]} hidden={hidden} />}
            {tab === "mercado" && (
              <div className="px-6 md:px-10">
                <Mercado ativos={ativos} apiKeys={apiKeys} />
              </div>
            )}
            {tab === "simulador" && (
              <div className="px-6 md:px-10">
                <Simulador />
              </div>
            )}
            {tab === "calc-renda" && (
              <div className="px-6 md:px-10">
                <CalculadoraRenda />
              </div>
            )}
            {tab === "projecao" && (
              <div className="px-6 md:px-10">
                <Projecao
                  ativos={ativos} hidden={hidden} apiKeys={apiKeys}
                  alvoInicial={projetarAlvo}
                  onConsumirAlvo={() => setProjetarAlvo(null)}
                />
              </div>
            )}
          </>
        )}

        {/* TELA DE ANÁLISE TÉCNICA DE UM ATIVO (fluxo a partir do Análise da Carteira) */}
        {modulo === "invest" && tab === "trade-ativo" && (
          <div className="px-6 md:px-10">
            <AnaliseTrade tradeWatchlist={tradeWatchlist} ativos={ativos} alvoInicial={analiseAlvo}
                          onVoltar={() => setTab("analises")} />
          </div>
        )}

        {/* MÓDULO: CONFIGURAÇÕES */}
        {modulo === "config" && (
          <Configuracoes subtab={tab}
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
                           } else if (id === "invest") {
                             cleared.ativos = [];
                             setAtivos([]);
                           }
                           await saveAll(cleared, { immediate: true });
                         }} />
        )}
        </Suspense>
      </main>

      <Footer />
      <BottomTabBar
        modulo={modulo} setModulo={setModulo}
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
      {["analise-carteira", "trade-ativo"].includes(tab) && !tradeOnboardingVisto && (
        <OnboardingTradeModal onClose={() => setTradeOnboardingVisto(true)} />
      )}
      {modulo === "financas" && tab !== "conversa" && (
        <>
          <button
            onClick={() => setConversaFABOpen(o => !o)}
            style={{
              position: "fixed", bottom: 80, right: 20, zIndex: 200,
              width: 50, height: 50, borderRadius: "50%",
              background: T.gold, color: T.bg, border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 22,
            }}
            title="Conversa rápida"
          >
            💬
          </button>
          {conversaFABOpen && (
            <div style={{
              position: "fixed", bottom: 140, right: 20, zIndex: 200,
              width: 320, background: T.card,
              border: `1px solid ${T.border}`, borderRadius: 12,
              padding: 14, boxShadow: "0 8px 32px rgba(0,0,0,.4)",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.gold, marginBottom: 8 }}>Conversa rápida</div>
              <ConversaFABInput
                onEnviar={(texto) => {
                  setConversaFABOpen(false);
                  setTab("conversa");
                }}
                onAbrirCompleto={() => { setConversaFABOpen(false); setTab("conversa"); }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
