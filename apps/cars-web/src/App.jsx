import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from "react";

import { T, applyTheme, THEMES } from "./lib/theme.js";
import { uid } from "./lib/format.js";
import { somaContasBRL } from "./lib/cambio.js";
import { MESES_LONGO } from "./lib/meses.js";
import { loadAll, saveAll, loadKeys, saveKeys, flushSave } from "./lib/storage.js";
import { comTumbas, idsRemovidos } from "./lib/tumbas.js";
import { API, COIN_MAP } from "./lib/api.js";
import { generateRecurringForCurrentMonth } from "./lib/recorrencia.js";
import { lerEscopo, salvarEscopo } from "./lib/escopo.js";
import { aplicarDadosCarregados, aplicarSeeds } from "./lib/appPersistencia.js";
import { backupDiario, criarBackup, obterBackup } from "./lib/autobackup.js";
import { gistBackupAutomatico } from "./lib/gistSync.js";
import { useMercado } from "./lib/hooks/useMercado.js";
import BackupsModal from "./components/modals/BackupsModal.jsx";
import CompraCartaoModal from "./components/modals/CompraCartaoModal.jsx";
import ComprasFotoModal from "./components/modals/ComprasFotoModal.jsx";
import CalculadoraJurosModal from "./components/modals/CalculadoraJurosModal.jsx";
import CalculadoraBasicaModal from "./components/modals/CalculadoraBasicaModal.jsx";
import { toast } from "./lib/toast.js";
import { createBackup, shouldAutoBackup } from "./lib/autoBackup.js";
import { audit } from "./lib/auditLog.js";
import { checkAndNotify, getConfig as getNotifCfg } from "./lib/notifications.js";

import GlobalStyles from "./components/ui/GlobalStyles.jsx";
import Footer from "./components/ui/Footer.jsx";
import Header, { SUBTAB_IDS } from "./components/Header.jsx";
import BottomTabBar from "./components/BottomTabBar.jsx";
import KeyboardShortcuts from "./components/ui/KeyboardShortcuts.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import ConfirmDialog from "./components/ui/ConfirmDialog.jsx";
import InstallPWA from "./components/ui/InstallPWA.jsx";

import ThemePicker from "./components/modals/ThemePicker.jsx";
import VarreduraDuplicidades from "./components/modals/VarreduraDuplicidades.jsx";
import SettingsModal from "./components/modals/SettingsModal.jsx";
import PerfisModal from "./components/modals/PerfisModal.jsx";
import { getPerfilAtivo } from "./lib/perfis.js";
import { garantirOcorrenciasDoAno } from "./lib/fixas.js";
import { capitalizarCdbsMeta, autoAplicarCofrinhos } from "./lib/cdbMeta.js";
import { useKeyboardShortcuts } from "./lib/keyboardShortcuts.js";
import { useLayout } from "./lib/useLayout.js";
import AtalhosOverlay from "./components/modals/AtalhosOverlay.jsx";
import CommandPalette from "./components/ui/CommandPalette.jsx";
import OnboardingTradeModal from "./components/modals/OnboardingTradeModal.jsx";
import PomodoroFloat from "./components/PomodoroFloat.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";

// Carrega um chunk de página com auto-recuperação: se o import falhar porque
// o chunk mudou de nome num deploy novo (página/cache antigo), recarrega a
// página UMA vez pra buscar o index.html + chunks atualizados. Evita a "tela
// branca" ao abrir uma aba após deploy. Guardado por sessionStorage pra não
// entrar em loop — se falhar de novo, o ErrorBoundary mostra a tela de erro.
const carregarComReload = (factory) => factory().catch((err) => {
  const ehChunk = /Loading chunk|dynamically imported module|module script|Failed to fetch/i.test(err?.message || "");
  let jaTentou = false;
  try { jaTentou = !!sessionStorage.getItem("af4:chunk-reload"); } catch {}
  if (ehChunk && !jaTentou && typeof window !== "undefined") {
    try { sessionStorage.setItem("af4:chunk-reload", "1"); } catch {}
    window.location.reload();
    return new Promise(() => {}); // nunca resolve: a página está recarregando
  }
  throw err;
});
const lz = (factory) => lazy(() => carregarComReload(factory));

// Páginas carregadas sob demanda (code-splitting por aba). Cada página vira um
// chunk próprio, então o bundle inicial não carrega Negócio/Treino/Invest etc.
// só pra abrir o Dashboard. O <Suspense> que envolve o <main> mostra o fallback
// enquanto o chunk da aba é baixado.
const AnaliseTrade = lz(() => import("./components/pages/Trade/Analise.jsx"));
const Dashboard = lz(() => import("./components/pages/Dashboard.jsx"));
const Contas = lz(() => import("./components/pages/Contas.jsx"));
const Cartoes = lz(() => import("./components/pages/Cartoes.jsx"));
const Transacoes = lz(() => import("./components/pages/Transacoes.jsx"));
const Calendario = lz(() => import("./components/pages/Calendario.jsx"));
const Categorias = lz(() => import("./components/pages/Categorias.jsx"));
const Metas = lz(() => import("./components/pages/Metas.jsx"));
const Notas = lz(() => import("./components/pages/Notas.jsx"));
const Tarefas = lz(() => import("./components/pages/Tarefas.jsx"));
const AgendaInicio = lz(() => import("./components/pages/AgendaInicio.jsx"));
const Despesas = lz(() => import("./components/pages/Despesas.jsx"));
const Planejamento = lz(() => import("./components/pages/Planejamento/index.jsx"));
const AnaliseFatura = lz(() => import("./components/pages/AnaliseFatura.jsx"));
const Investimentos = lz(() => import("./components/pages/Investimentos.jsx"));
const MercadoHub = lz(() => import("./components/pages/Invest/MercadoHub.jsx"));
const Simuladores = lz(() => import("./components/pages/Invest/Simuladores.jsx"));
const AnalisesUnificada = lz(() => import("./components/pages/Invest/Analises.jsx"));
const PlanejarCarteira = lz(() => import("./components/pages/Invest/PlanejarCarteira.jsx"));

const InvestPainel = lz(() => import("./components/pages/Invest/InvestPainel.jsx"));
const Emprestimos = lz(() => import("./components/pages/Emprestimos.jsx"));
const ProventosHub = lz(() => import("./components/pages/Invest/ProventosHub.jsx"));
const MapaDividendos = lz(() => import("./components/pages/Invest/MapaDividendos.jsx"));

const RelatoriosInvest = lz(() => import("./components/pages/Invest/RelatoriosInvest.jsx"));
const AnalisesFinancas = lz(() => import("./components/pages/AnalisesFinancas.jsx"));

const CartaoExtrato = lz(() => import("./components/pages/CartaoExtrato.jsx"));
const ContaExtrato = lz(() => import("./components/pages/ContaExtrato.jsx"));
const PergunteAoClaude = lz(() => import("./components/pages/PergunteAoClaude.jsx"));
const Configuracoes = lz(() => import("./components/pages/Configuracoes.jsx"));
// Módulo Negócio REMOVIDO da interface (pedido 2026-09-18: "não uso mais").
// Os DADOS negocio* continuam no estado e nos backups — nada é apagado; se um
// dia voltar, é só restaurar as páginas (histórico do git) e religar aqui.
const Lembretes = lz(() => import("./components/pages/Lembretes.jsx"));
const Treino = lz(() => import("./components/pages/Treino.jsx"));
const Voos = lz(() => import("./components/pages/Voos.jsx"));
const JarbasChamada = lz(() => import("./components/JarbasChamada.jsx"));
const JarbasBolha = lz(() => import("./components/JarbasBolha.jsx"));
import { EXERCICIOS_BASE } from "./lib/exerciciosBase.js";
import { dispararLembretes } from "./lib/lembretes.js";

// Fallback enquanto o chunk de uma aba (lazy) é baixado.
function PageFallback() {
  return (
    <div style={{ padding: "64px 24px", textAlign: "center", color: T.muted }}>
      <div style={{ fontFamily: T.serif, color: T.gold, fontSize: 18, fontStyle: "italic" }}>Carregando…</div>
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
  // Sidebar vertical recolhível — mais espaço pro conteúdo (ex.: 2 telas no note).
  const [sidebarColapsada, setSidebarColapsada] = useState(() => {
    try { return localStorage.getItem("af4:sidebar-colapsada") === "1"; } catch { return false; }
  });
  const toggleSidebar = () => setSidebarColapsada(v => {
    const n = !v;
    try { localStorage.setItem("af4:sidebar-colapsada", n ? "1" : "0"); } catch {}
    return n;
  });
  const [hidden, setHidden] = useState(false);
  const [perfisOpen, setPerfisOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [themeId, setThemeId] = useState("nevoa");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [varreduraOpen, setVarreduraOpen] = useState(false);
  const [backupsOpen, setBackupsOpen] = useState(false);
  // Compra no cartão — lançamento rápido. Abre por evento global (botões em
  // Cartões / menu ⋯) ou pela URL ?acao=compra-cartao (atalho do ícone PWA).
  const [compraCartaoOpen, setCompraCartaoOpen] = useState(false);
  useEffect(() => {
    const abrir = () => setCompraCartaoOpen(true);
    window.addEventListener("af4:compra-cartao", abrir);
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("acao") === "compra-cartao") {
        setCompraCartaoOpen(true);
        window.history.replaceState({}, "", window.location.pathname);
      }
    } catch {}
    return () => window.removeEventListener("af4:compra-cartao", abrir);
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modulesEnabled, setModulesEnabled] = useState({ financas: true, invest: true });
  const [apiKeys, setApiKeys] = useState({ brapi: "", alphavantage: "", anthropic: "", useRealMarket: true });
  const [cartaoAberto, setCartaoAberto] = useState(null);
  const [contaAberta, setContaAberta] = useState(null);
  const [comprasFotoOpen, setComprasFotoOpen] = useState(false);
  // Menu do botão flutuante (＋): foto, nova transação, calculadora.
  const [fabOpen, setFabOpen] = useState(false);
  // Jarbas (global): toda entrada abre DIRETO a tela de conversa (HUD).
  // O histórico vive aqui pra sobreviver a abrir/fechar na sessão.
  const [jarbasOpen, setJarbasOpen] = useState(false);
  const [jarbasMsgs, setJarbasMsgs] = useState([]);
  // Memória PERMANENTE do Jarbas ("lembra que...") — sincronizada na conta.
  const [jarbasMemoria, setJarbasMemoria] = useState([]);
  const swipeRef = useRef(null); // swipe entre abas (mobile)
  const [calcJurosGlobalOpen, setCalcJurosGlobalOpen] = useState(false);
  const [calcBasicaOpen, setCalcBasicaOpen] = useState(false);

  applyTheme(themeId);

  const [contas, setContas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [transacoes, setTransacoesBase] = useState([]);
  // Lápides de itens apagados (lib/tumbas.js) — viajam no estado sincronizado
  // pra fusão do sync não ressuscitar o que foi deletado.
  const [tumbas, setTumbas] = useState({});
  // Notas rápidas (Contas/Cartões) — { contas: "...", cartoes: "..." }.
  // No estado sincronizado pra aparecer em todos os aparelhos (pedido 2026-09-22).
  const [notasRapidas, setNotasRapidas] = useState({});
  // Módulo Voos — { monitores: [...] } (monitores de preço-alvo, sincronizados).
  const [voosDados, setVoosDados] = useState({ monitores: [] });
  // setTransacoes rastreado: toda exclusão (id que some da lista) vira lápide
  // automaticamente — cobre os 16+ pontos de exclusão sem tocar em cada um.
  // O flush fica FORA do updater (updaters devem ser puros).
  const tumbasPendentesRef = useRef([]);
  const setTransacoes = useCallback((next) => {
    setTransacoesBase(prev => {
      const nova = typeof next === "function" ? next(prev) : next;
      const removidos = idsRemovidos(prev, nova);
      if (removidos.length) tumbasPendentesRef.current.push(...removidos);
      return nova;
    });
    queueMicrotask(() => {
      if (tumbasPendentesRef.current.length === 0) return;
      const ids = tumbasPendentesRef.current.splice(0);
      setTumbas(t => comTumbas(t, "transacoes", ids));
    });
  }, []);
  const [ativos, setAtivos] = useState([]);
  const [metas, setMetas] = useState([]);
  const [notas, setNotas] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [parcelamentos, setParcelamentos] = useState([]);
  const [devedores, setDevedores] = useState([]);
  const [dividas, setDividas] = useState([]);
  const [cheques, setCheques] = useState([]); // cheques a receber (aguardando/compensado/devolvido)

  // Escopo financeiro · Pessoal / Negócio / Tudo
  const [escopoAtivo, setEscopoAtivo] = useState(lerEscopo());

  // Despesas Fixas (módulo independente)
  const [fixas, setFixas] = useState([]);
  const [fixaOcorrencias, setFixaOcorrencias] = useState([]);

  // Lembretes de vencimento (notificação do sistema): checa na abertura
  // (com folga pros dados carregarem) e a cada 6h com o app aberto.
  // A opção liga/desliga fica em Configurações; sem permissão, é no-op.
  // ATENÇÃO: este efeito precisa ficar DEPOIS dos useState acima — as deps
  // são avaliadas no render e antes disso dá TDZ ("Cannot access 'fixas'
  // before initialization", crash de 2026-09-12).
  useEffect(() => {
    const checar = () => {
      try { dispararLembretes({ fixas, fixaOcorrencias, cartoes, cheques, dividas }); } catch {}
    };
    const t = setTimeout(checar, 8000);
    const int = setInterval(checar, 6 * 60 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(int); };
  }, [fixas, fixaOcorrencias, cartoes, cheques, dividas]);

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
  const [orcamentosFuturos, setOrcamentosFuturos] = useState([]); // compras/compromissos planejados (Painel)
  // Fotos da carteira em datas específicas (posição congelada pro IR):
  // [{ id, data, criadoEm, itens: [{ticker,tipo,qtd,pm,preco,custo,valor}] }]
  const [snapshotsCarteira, setSnapshotsCarteira] = useState([]);

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
  // Financeiro DEDICADO do Negócio (telas próprias, dados separados do
  // financeiro pessoal). Modelos:
  //   negocioFinContas:       [{ id, nome, instituicao, saldo, cor }]
  //   negocioFinCategorias:   [{ id, nome, tipo, cor }]
  //   negocioFinDespesasFixas:[{ id, descricao, valor, categoria, diaVencimento }]
  //   negocioFinDespesasVar:  [{ id, descricao, valor, categoria, data, conta }]
  const [negocioFinContas, setNegocioFinContas] = useState([]);
  const [negocioFinCategorias, setNegocioFinCategorias] = useState([]);
  const [negocioFinDespesasFixas, setNegocioFinDespesasFixas] = useState([]);
  const [negocioFinDespesasVar, setNegocioFinDespesasVar] = useState([]);
  // Financeiro por loja: lojas, loja ativa e lista de recebimentos (entradas).
  const [negocioLojas, setNegocioLojas] = useState([]);
  const [negocioLojaAtiva, setNegocioLojaAtiva] = useState("");
  const [negocioRecebimentos, setNegocioRecebimentos] = useState([]);
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

  // Setters usados no load e na restauração de backup (fonte única).
  const SETTERS = {
    // setTransacoes cru de propósito: hidratação/restauração troca a lista
    // inteira e NÃO deve gerar lápides (só exclusões do usuário geram).
    setContas, setCategorias, setTransacoes: setTransacoesBase, setAtivos, setMetas, setNotas,
    setTumbas, setNotasRapidas, setVoos: setVoosDados, setJarbasMemoria,
    setCartoes, setParcelamentos, setDevedores, setDividas, setCheques,
    setFixas, setFixaOcorrencias, setAgenda, setHabitos, setDiario, setCompras,
    setIdeias, setTarefas, setSugestoes, setLembretes, setConversaHistorico,
    setExerciciosDB, setTreinoTemplates, setTreinos, setPatrimonioHistorico,
    setNegocioVeiculos, setNegocioVendasVeiculos, setNegocioServicos,
    setNegocioVendasServicos, setNegocioContratos, setNegocioClientes,
    setNegocioInstaladores, setObjetivosCarteira, setOrcamentosFuturos, setSnapshotsCarteira, setCarteirasModeloCustom,
    setModeloAtivoId, setCarteiraProventos, setCaixaNegocio, setNegocioBancos,
    setNegocioFinContas, setNegocioFinCategorias, setNegocioFinDespesasFixas, setNegocioFinDespesasVar,
    setNegocioLojas, setNegocioLojaAtiva, setNegocioRecebimentos,
    setProventosRecebidos, setProventosIgnorados, setProventosManuais,
    setTradeWatchlist, setTradeHistorico, setTradeAnalisesIdV,
    setTradeOnboardingVisto, setThemeId,
  };

  // Blob completo do estado atual (mesmo formato que vai pro saveAll/backup).
  const montarDados = () => ({
    contas, categorias, transacoes, ativos, metas, notas,
    cartoes, parcelamentos, devedores, dividas, cheques,
    fixas, fixaOcorrencias, agenda,
    habitos, diario, compras, ideias, tarefas, sugestoes, patrimonioHistorico, objetivosCarteira, orcamentosFuturos, snapshotsCarteira,
    negocioVeiculos, negocioVendasVeiculos, negocioServicos, negocioVendasServicos, negocioContratos, negocioClientes, negocioInstaladores,
    carteirasModeloCustom, modeloAtivoId,
    carteiraProventos, proventosRecebidos, proventosIgnorados, proventosManuais,
    caixaNegocio, negocioBancos,
    negocioFinContas, negocioFinCategorias, negocioFinDespesasFixas, negocioFinDespesasVar,
    negocioLojas, negocioLojaAtiva, negocioRecebimentos,
    tradeWatchlist, tradeHistorico, tradeAnalisesIdV, tradeOnboardingVisto,
    lembretes, conversaHistorico, exerciciosDB, treinoTemplates, treinos,
    themeId,
    tumbas, notasRapidas, voos: voosDados, jarbasMemoria,
  });

  // Backup automático diário na nuvem (GitHub Gist): 1x por dia, na abertura,
  // se houver token configurado e o interruptor ligado. Roda uns segundos
  // depois do boot pra não competir com o carregamento; falha em silêncio.
  // (Efeito fica DEPOIS de todos os useState que montarDados usa — deps de
  // effect são avaliadas no render e referenciar state ainda não declarado
  // dá TDZ crash em produção.)
  const montarDadosRef = useRef(null);
  montarDadosRef.current = montarDados; // sempre a versão do render atual
  useEffect(() => {
    if (loading) return;
    const timer = setTimeout(async () => {
      const r = await gistBackupAutomatico(montarDadosRef.current());
      if (r.feito) toast.success("☁️ Backup automático enviado pro GitHub.");
      // Falha NUNCA fica muda — silêncio aqui já escondeu backup quebrado.
      else if (r.motivo === "erro") toast.error("☁️ Backup automático FALHOU — confira o token em Configurações → Backup.");
    }, 4000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Checagem automática dos MONITORES DE VOO nos horários configurados
  // (módulo Voos, 2026-09-22): roda uns segundos após abrir o app e a cada
  // 30min com ele aberto. PWA não roda fechado — o padrão é "abriu depois do
  // horário, checa". Refs evitam closure velha sem re-armar o timer.
  const voosRef = useRef(null); voosRef.current = voosDados;
  const apiKeysRef = useRef(null); apiKeysRef.current = apiKeys;
  useEffect(() => {
    if (loading) return;
    const rodar = async () => {
      const lista = voosRef.current?.monitores || [];
      const creds = { key: apiKeysRef.current?.amadeusKey, secret: apiKeysRef.current?.amadeusSecret };
      if (!creds.key || !creds.secret || !lista.length) return;
      try {
        const { deveChecarAgora, registrarChecagem, simplificarOfertas } = await import("./lib/voos.js");
        const { buscarVoos } = await import("./lib/amadeus.js");
        for (const m of lista.filter(x => deveChecarAgora(x))) {
          try {
            const json = await buscarVoos({ origem: m.origem, destino: m.destino, dataIda: m.dataIda, dataVolta: m.dataVolta, adultos: m.adultos, semEscala: m.semEscala, max: 5 }, creds);
            const melhor = simplificarOfertas(json)[0];
            if (!melhor) continue;
            const { monitor, atingiuAlvo } = registrarChecagem(m, melhor.preco);
            setVoosDados(prev => ({ ...(prev || {}), monitores: (prev?.monitores || []).map(x => x.id === m.id ? monitor : x) }));
            if (atingiuAlvo) toast.success(`🎯 Voo ${m.origem}→${m.destino} bateu o alvo: R$ ${Math.round(melhor.preco).toLocaleString("pt-BR")}!`);
          } catch { /* monitor individual falhou: tenta no próximo ciclo */ }
        }
      } catch { /* libs não carregaram (offline): tenta no próximo ciclo */ }
    };
    const t = setTimeout(rodar, 6000);
    const iv = setInterval(rodar, 30 * 60 * 1000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, [loading]);

  // Restaura um ponto de restauração (aplica o blob + salva + backup de segurança).
  const restaurarBackup = async (id) => {
    const dados = await obterBackup(id);
    if (!dados) { toast.error("Backup não encontrado."); return; }
    await criarBackup(montarDados(), "antes de restaurar");
    aplicarDadosCarregados(dados, SETTERS);
    await saveAll(dados, { immediate: true });
    setBackupsOpen(false);
    toast.success("Dados restaurados do ponto de restauração.");
  };

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
      if (data) aplicarDadosCarregados(data, SETTERS);
      else aplicarSeeds(SETTERS);
        if (keys) {
          setApiKeys(prev => ({ ...prev, ...keys }));
          // A chave do Gemini é sincronizada na conta (apiKeys.gemini, vai pra
          // nuvem). Espelha no localStorage onde lib/gemini.js efetivamente lê,
          // pra ela aparecer já configurada num aparelho novo / após limpar cache.
          try { if (keys.gemini) localStorage.setItem("af4:gemini-key", keys.gemini); } catch {}
          // Mesmo espelhamento pro token da BRAPI — lib/brapi.js lê só o
          // localStorage; sem isto, o token sincronizado na conta "sumia"
          // (Configurações mostrava configurado, mas as telas davam erro).
          try { if (keys.brapi) localStorage.setItem("af4:brapi-token", keys.brapi); } catch {}
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
    saveAll(montarDados());
  }, [contas, categorias, transacoes, ativos, metas, notas, cartoes, parcelamentos, devedores, dividas, cheques,
      fixas, fixaOcorrencias, agenda,
      habitos, diario, compras, ideias, tarefas, sugestoes, patrimonioHistorico, objetivosCarteira, orcamentosFuturos, snapshotsCarteira,
      negocioVeiculos, negocioVendasVeiculos, negocioServicos, negocioVendasServicos, negocioContratos, negocioClientes, negocioInstaladores,
      carteirasModeloCustom, modeloAtivoId,
      carteiraProventos, proventosRecebidos, proventosIgnorados, proventosManuais,
      caixaNegocio, negocioBancos,
      negocioFinContas, negocioFinCategorias, negocioFinDespesasFixas, negocioFinDespesasVar,
      negocioLojas, negocioLojaAtiva, negocioRecebimentos,
      tradeWatchlist, tradeHistorico, tradeAnalisesIdV, tradeOnboardingVisto,
      lembretes, conversaHistorico, exerciciosDB, treinoTemplates, treinos,
      themeId, tumbas, notasRapidas, voosDados, jarbasMemoria, loading]);

  useEffect(() => {
    if (loading) return;
    saveKeys(apiKeys);
  }, [apiKeys, loading]);

  /* ---------- Backup automático diário (ponto de restauração local) ---------- */
  useEffect(() => {
    if (loading) return;
    // 1x por dia: guarda um snapshot do estado atual em IndexedDB (rotativo).
    const t = setTimeout(() => backupDiario(montarDados()), 4000);
    return () => clearTimeout(t);
  }, [loading]);

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
        cartoes, parcelamentos, devedores, dividas, cheques,
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
      checkAndNotify({ devedores, dividas, cheques, fixas, fixaOcorrencias });
    };
    tick(); // primeira vez logo após boot
    const id = setInterval(tick, 30 * 60 * 1000); // a cada 30min
    return () => clearInterval(id);
  }, [loading, devedores, dividas, fixas, fixaOcorrencias]);

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
      const mesNome = MESES_LONGO[ref.getMonth()];
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

  // Navega pra uma aba zerando os detalhes abertos (conta/cartão). Antes esse
  // mesmo wrapper estava repetido inline em Header, KeyboardShortcuts, Dashboard,
  // InvestPainel e BottomTabBar.
  const irParaTab = useCallback((t) => {
    setCartaoAberto(null); setContaAberta(null);
    // Troca também o módulo quando a aba pertence a outro (ex.: card do
    // Painel → "calendario", que vive na Agenda). Sem isso a tela ficava
    // em branco (bug 2026-09-22). Aba fora do mapa: mantém o módulo atual.
    const mod = Object.keys(SUBTAB_IDS).find(m => SUBTAB_IDS[m].includes(t));
    if (mod) setModulo(mod);
    setTab(t);
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

  // Análise de gastos → abre Transações já filtrada por aquela categoria.
  const verCategoriaTransacoes = useCallback((nome) => {
    if (!nome) return;
    setCartaoAberto(null); setContaAberta(null);
    setPendingTransacao({ filtroCategoria: nome, periodo: "mes-atual" });
    setModulo("financas"); setTab("transacoes");
  }, []);

  const handleOpenPicker = useCallback(() => setPickerOpen(true), []);
  const handleOpenSettings = useCallback(() => setSettingsOpen(true), []);

  const { refreshMarket, marketStatus } = useMercado({ ativos, setAtivos, apiKeys, loading, setRefreshing });

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

  // Render por módulo (closures: capturam todo o estado/handlers acima, sem
  // prop-drilling). Mantém o <main> enxuto e o gating de módulo legível.
  const renderFinancas = () => (
    <div className="px-6 md:px-10">
      {tab === "dashboard" && (
        <Dashboard totais={totais} hidden={hidden} contas={contas} ativos={ativos}
                   transacoes={transacoes} categorias={categorias} metas={metas}
                   orcamentosFuturos={orcamentosFuturos} setOrcamentosFuturos={setOrcamentosFuturos}
                   carteiraProventos={carteiraProventos}
                   proventosRecebidos={proventosRecebidos} proventosIgnorados={proventosIgnorados} proventosManuais={proventosManuais}
                   cartoes={cartoes} parcelamentos={parcelamentos}
                   devedores={devedores} dividas={dividas} cheques={cheques}
                   fixas={fixas} fixaOcorrencias={fixaOcorrencias}
                   agenda={agenda} lembretes={lembretes} tarefas={tarefas}
                   patrimonioHistorico={patrimonioHistorico}
                   escopoAtivo={escopoAtivo}
                   onTabChange={irParaTab}
                   onQuickAction={handleQuickAction}
                   apiKeys={apiKeys}
                   onAbrirJarbas={() => setJarbasOpen(true)}
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
                  onContaClick={setContaAberta}
                  notaRapida={notasRapidas.contas}
                  onSalvarNota={(t) => setNotasRapidas(p => ({ ...p, contas: t }))} />
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
      {(tab === "areceber" || tab === "fixas" || tab === "relatorios-anual" || tab === "planejamento" || tab === "cheques") && (
        <Planejamento
          transacoes={transacoes} setTransacoes={setTransacoes}
          contas={contas} setContas={setContas}
          categorias={categorias} setCategorias={setCategorias}
          devedores={devedores} setDevedores={setDevedores}
          dividas={dividas} setDividas={setDividas}
          cheques={cheques} setCheques={setCheques}
          fixas={fixas} setFixas={setFixas}
          fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
          parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
          cartoes={cartoes} setCartoes={setCartoes}
          metas={metas} setMetas={setMetas}
          apiKey={apiKeys.anthropic}
          escopoAtivo={escopoAtivo}
          tab={tab}
          secaoInicial={tab === "cheques" ? "cheques" : tab === "fixas" ? "fixas" : tab === "areceber" ? "areceber" : tab === "relatorios-anual" ? "anual" : null}
          onVerCategoria={verCategoriaTransacoes}
          onTabChange={setTab}
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
      {tab === "perguntar" && (
        <div className="px-6 md:px-10">
          <PergunteAoClaude
            apiKey={apiKeys.anthropic}
            onSaveKey={(k) => setApiKeys(prev => ({ ...prev, anthropic: k }))}
            transacoes={transacoes} contas={contas} ativos={ativos}
            devedores={devedores} dividas={dividas} cheques={cheques}
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
                   notaRapida={notasRapidas.cartoes}
                   onSalvarNota={(t) => setNotasRapidas(p => ({ ...p, cartoes: t }))}
                   onPontoRestauracao={(motivo) => criarBackup(montarDados(), motivo)}
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
      {(tab === "relatorios-f" || tab === "inteligencia" || tab === "revisor-ganhos" || tab === "audit") && (
        <AnalisesFinancas
          transacoes={transacoes} contas={contas} ativos={ativos}
          categorias={categorias}
          fixas={fixas} fixaOcorrencias={fixaOcorrencias}
          parcelamentos={parcelamentos} dividas={dividas} devedores={devedores}
          cheques={cheques} cartoes={cartoes} metas={metas}
          proventosManuais={proventosManuais} carteiraProventos={carteiraProventos}
          patrimonioHistorico={patrimonioHistorico}
          apiKey={apiKeys.anthropic}
          escopoAtivo={escopoAtivo}
          hidden={hidden} onTabChange={setTab} />
      )}
      {/* Cheques agora é seção do Centro de controle (render acima, junto de A Receber) */}
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
        <Categorias categorias={categorias} setCategorias={setCategorias} transacoes={transacoes} setTransacoes={setTransacoes}
                    fixas={fixas} setFixas={setFixas} fixaOcorrencias={fixaOcorrencias}
                    parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
                    dividas={dividas} setDividas={setDividas} cartoes={cartoes}
                    escopoAtivo={escopoAtivo} hidden={hidden} />
      )}
      {tab === "emprestimos" && (
        <Emprestimos devedores={devedores} hidden={hidden} onTabChange={irParaTab} />
      )}
      {/* Relatórios, Inteligência, Revisor de ganhos e Histórico consolidados em Análises & Relatórios — ver bloco unificado acima */}
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
  );

  const renderAgenda = () => (
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
                    cheques={cheques} cartoes={cartoes}
                    agenda={agenda} setAgenda={setAgenda}
                    escopoAtivo={escopoAtivo} />
      )}
      {tab === "tarefas" && (
        <Tarefas tarefas={tarefas} setTarefas={setTarefas} />
      )}
      {tab === "metas" && (
        <Metas metas={metas} setMetas={setMetas} hidden={hidden}
               fixas={fixas} setFixas={setFixas}
               fixaOcorrencias={fixaOcorrencias} setFixaOcorrencias={setFixaOcorrencias}
               categorias={categorias} contas={contas} setContas={setContas}
               transacoes={transacoes} setTransacoes={setTransacoes}
               ativos={ativos} setAtivos={setAtivos} />
      )}
      {tab === "lembretes" && (
        <Lembretes lembretes={lembretes} setLembretes={setLembretes} />
      )}
      {tab === "voos" && (
        <Voos voos={voosDados} setVoos={setVoosDados} apiKeys={apiKeys} />
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
  );


  const renderInvest = () => (
    <>
      {tab === "investimentos" && (
        <InvestPainel ativos={ativos} transacoes={transacoes} categorias={categorias} hidden={hidden}
                      apiKeys={apiKeys}
                      proventosRecebidos={proventosRecebidos}
                      marketStatus={marketStatus}
                      onRefresh={refreshMarket} refreshing={refreshing}
                      patrimonioHistorico={patrimonioHistorico}
                      onTabChange={irParaTab}
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
                         carteiraProventos={carteiraProventos}
                         marketStatus={marketStatus}
                         onRefresh={refreshMarket} refreshing={refreshing}
                         onAnalisar={(ativo) => { setAnaliseAlvo(ativo); setTab("trade-ativo"); }}
                         onProjetar={(ativo) => { setProjetarAlvo(ativo); setTab("projecao"); }}
                         hidden={hidden} />
        </div>
      )}
      {/* Hub único de planejamento — abas antigas "objetivos", "modelo" e
          "planejador" continuam válidas como atalhos pra view interna certa. */}
      {(tab === "monte-carteira" || tab === "objetivos" || tab === "modelo" || tab === "planejador") && (
        <div className="px-6 md:px-10">
          <PlanejarCarteira
            ativos={ativos}
            hidden={hidden}
            apiKeys={apiKeys}
            objetivosCarteira={objetivosCarteira}
            setObjetivosCarteira={setObjetivosCarteira}
            carteirasModeloCustom={carteirasModeloCustom}
            setCarteirasModeloCustom={setCarteirasModeloCustom}
            modeloAtivoId={modeloAtivoId}
            setModeloAtivoId={setModeloAtivoId}
            transacoes={transacoes}
            viewInicial={tab === "objetivos" ? "objetivos" : tab === "modelo" ? "modelo" : tab === "planejador" ? "planejador" : "monte"}
          />
        </div>
      )}
      {/* Hub Proventos & Renda — "mapa-dividendos"/"projecao" viram atalhos
          pra view "renda" (o botão Projetar da Carteira continua funcionando). */}
      {(tab === "proventos" || tab === "mapa-dividendos" || tab === "projecao") && (
        <ProventosHub
          viewInicial={tab === "proventos" ? "recebidos" : "renda"}
          proventosProps={{
            ativos, setAtivos, hidden,
            carteiraProventos, setCarteiraProventos,
            proventosRecebidos, setProventosRecebidos,
            proventosIgnorados, setProventosIgnorados,
            proventosManuais, setProventosManuais,
            contas, setContas, categorias,
            transacoes, setTransacoes,
          }}
          rendaProps={{
            ativos, proventosManuais, hidden, apiKeys,
            alvoInicial: projetarAlvo, onConsumirAlvo: () => setProjetarAlvo(null),
          }}
        />
      )}
      {tab === "relatorios-i" && <RelatoriosInvest ativos={ativos} transacoes={transacoes} patrimonioHistorico={patrimonioHistorico} proventos={[]} operacoes={[]} hidden={hidden} snapshotsCarteira={snapshotsCarteira} setSnapshotsCarteira={setSnapshotsCarteira} />}
      {/* Hub Mercado — funde Construtor de mercado + Screener; "screener",
          "pesquisador-mercado" e a antiga "mercado" viram atalhos. */}
      {(tab === "construtor-mercado" || tab === "pesquisador-mercado" || tab === "mercado" || tab === "screener") && (
        <MercadoHub
          viewInicial={tab === "screener" ? "screener" : "construtor"}
          hidden={hidden}
          onIrMonteCarteira={() => { setModulo("invest"); irParaTab("monte-carteira"); }}
        />
      )}
      {(tab === "simulador" || tab === "calc-renda") && (
        <div className="px-6 md:px-10">
          <Simuladores />
        </div>
      )}
      {/* calc-renda agora abre o hub "Simuladores" (FIIs × Renda Fixa + Calculadora de Renda) */}
      {/* "planejador" virou view do hub Planejar; "projecao"/"mapa-dividendos"
          viraram views do hub Proventos & Renda (renders acima) */}
    </>
  );

  const renderTradeAtivo = () => (
    <div className="px-6 md:px-10">
      <AnaliseTrade tradeWatchlist={tradeWatchlist} ativos={ativos} alvoInicial={analiseAlvo}
                    onVoltar={() => setTab("analises")} />
    </div>
  );

  const renderConfig = () => (
    <Configuracoes subtab={tab}
                   themeId={themeId} setThemeId={setThemeId}
                   apiKeys={apiKeys} setApiKeys={setApiKeys}
                   onVerificarDuplicidades={() => setVarreduraOpen(true)}
                   onAbrirBackups={() => setBackupsOpen(true)}
                   modulesEnabled={modulesEnabled} setModulesEnabled={setModulesEnabled}
                   onClearModule={async (id) => {
                     // Ponto de restauração ANTES de limpar (segurança).
                     await criarBackup(montarDados(), `antes de limpar ${id}`);
                     // Calcula snapshot zerado e força save imediato
                     // (bypass do debounce de 1.5s — senão recarregar
                     // antes do timer faz a versão antiga voltar do cloud).
                     const cleared = {
                       contas, categorias, transacoes, ativos, metas, notas,
                       cartoes, parcelamentos, devedores, dividas, cheques, themeId,
                     };
                     if (id === "financas") {
                       cleared.contas = []; cleared.cartoes = []; cleared.parcelamentos = [];
                       cleared.transacoes = []; cleared.categorias = [];
                       cleared.metas = []; cleared.notas = []; cleared.devedores = []; cleared.dividas = []; cleared.cheques = [];
                       setContas([]); setCartoes([]); setParcelamentos([]);
                       setTransacoes([]); setCategorias([]);
                       setMetas([]); setNotas([]); setDevedores([]); setDividas([]); setCheques([]);
                     } else if (id === "invest") {
                       cleared.ativos = [];
                       setAtivos([]);
                     }
                     await saveAll(cleared, { immediate: true });
                   }} />
  );

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: T.body, minHeight: "100vh" }}>
      <GlobalStyles />
      <Header
        modulo={modulo} setModulo={setModulo}
        tab={tab} setTab={irParaTab}
        onCalculadoraJuros={() => setCalcJurosGlobalOpen(true)}
        onCalculadoraBasica={() => setCalcBasicaOpen(true)}
        contas={contas} cartoes={cartoes}
        contaAberta={contaAberta} setContaAberta={setContaAberta}
        cartaoAberto={cartaoAberto} setCartaoAberto={setCartaoAberto}
        hidden={hidden} setHidden={setHidden}
        escopoAtivo={escopoAtivo}
        onEscopoChange={(novo) => { setEscopoAtivo(novo); salvarEscopo(novo); }}
        onOpenPalette={() => setPaletaAberta(true)}
        onAbrirJarbas={() => setJarbasOpen(true)}
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
                const lastLight = localStorage.getItem("af4:last-theme:light") || "nevoa";
                setThemeId(lastLight);
              } else {
                const lastDark = localStorage.getItem("af4:last-theme:dark") || "gold";
                setThemeId(lastDark);
              }
            } catch {
              setThemeId(isDark ? "nevoa" : "gold");
            }
          }
          if (kind === "perfis") setPerfisOpen(true);
        }}
        onQuickAction={handleQuickAction}
        pendingCounts={pendingCounts}
        alertData={{ dividas, devedores, fixas, fixaOcorrencias, parcelamentos, cartoes, categorias, transacoes, agenda, lembretes, tarefas, voos: voosDados }}
        onNavegar={(mod, t) => { setModulo(mod); irParaTab(t); }}
        sidebarColapsada={sidebarColapsada} onToggleSidebar={toggleSidebar}
      />

      <KeyboardShortcuts
        setTab={irParaTab}
        transacoes={transacoes} contas={contas}
        ativos={ativos} cartoes={cartoes}
      />

      {varreduraOpen && (
        <VarreduraDuplicidades
          dados={{ transacoes, dividas, devedores, fixas, cheques, parcelamentos, cartoes, contas, categorias }}
          setters={{ transacoes: setTransacoes, dividas: setDividas, devedores: setDevedores, fixas: setFixas, cheques: setCheques, parcelamentos: setParcelamentos, cartoes: setCartoes, contas: setContas, categorias: setCategorias }}
          onClose={() => setVarreduraOpen(false)}
        />
      )}
      {backupsOpen && (
        <BackupsModal onRestaurar={restaurarBackup} onClose={() => setBackupsOpen(false)} />
      )}
      {compraCartaoOpen && (
        <CompraCartaoModal
          cartoes={cartoes} categorias={categorias}
          transacoes={transacoes} setTransacoes={setTransacoes}
          parcelamentos={parcelamentos} setParcelamentos={setParcelamentos}
          onClose={() => setCompraCartaoOpen(false)} />
      )}
      {calcJurosGlobalOpen && (
        <CalculadoraJurosModal onClose={() => setCalcJurosGlobalOpen(false)} />
      )}
      {calcBasicaOpen && (
        <CalculadoraBasicaModal onClose={() => setCalcBasicaOpen(false)} />
      )}
      {comprasFotoOpen && (
        <ComprasFotoModal
          cartoes={cartoes} categorias={categorias}
          transacoes={transacoes} setTransacoes={setTransacoes}
          onClose={() => setComprasFotoOpen(false)}
          onManual={() => setCompraCartaoOpen(true)} />
      )}
      {pickerOpen && (
        <ThemePicker themeId={themeId} setThemeId={setThemeId} onClose={() => setPickerOpen(false)} />
      )}
      {jarbasOpen && (
        <Suspense fallback={null}>
          <JarbasChamada
            dados={{ contas, cartoes, transacoes, ativos, devedores, dividas, cheques,
                     fixas, fixaOcorrencias, parcelamentos, agenda, lembretes, tarefas,
                     memorias: jarbasMemoria }}
            apiKeys={apiKeys}
            msgs={jarbasMsgs} setMsgs={setJarbasMsgs}
            onMemorizar={(texto) => setJarbasMemoria(prev => [...prev, { id: uid(), texto, criadoEm: new Date().toISOString() }])}
            onEsquecer={(id) => {
              setJarbasMemoria(prev => prev.filter(m => m.id !== id));
              // lápide: a fusão do sync não ressuscita a memória apagada
              setTumbas(t => comTumbas(t, "jarbasMemoria", [id]));
            }}
            onEncerrar={() => setJarbasOpen(false)} />
        </Suspense>
      )}
      {/* BOLHA flutuante do Jarbas — app inteiro, some com ele aberto */}
      {!loading && !jarbasOpen && (
        <Suspense fallback={null}>
          <JarbasBolha onAbrir={() => setJarbasOpen(true)} />
        </Suspense>
      )}

      {settingsOpen && (
        <SettingsModal apiKeys={apiKeys} setApiKeys={setApiKeys} onClose={() => setSettingsOpen(false)} />
      )}

      {perfisOpen && (
        <PerfisModal onClose={() => setPerfisOpen(false)} />
      )}

      <main
        className={isVertical ? "pb-24" : ((tab === "planejamento" || tab === "areceber" || tab === "fixas" || tab === "relatorios-anual") ? "pb-24" : "max-w-7xl mx-auto pb-24")}
        style={isVertical ? { marginLeft: sidebarColapsada ? 78 : 220, maxWidth: "none", transition: "margin-left .2s" } : undefined}
        onTouchStart={(e) => {
          const t0 = e.touches?.[0];
          swipeRef.current = t0 ? { x: t0.clientX, y: t0.clientY } : null;
        }}
        onTouchEnd={(e) => {
          // SWIPE troca de aba no celular (pedido 2026-09-22): arrasto bem
          // horizontal (≥70px, pouco vertical), fora de campos de formulário.
          const ini = swipeRef.current; swipeRef.current = null;
          const t1 = e.changedTouches?.[0];
          if (!ini || !t1 || window.innerWidth > 768) return;
          const alvoTag = (e.target?.tagName || "").toLowerCase();
          if (["input", "select", "textarea"].includes(alvoTag)) return;
          const dx = t1.clientX - ini.x, dy = t1.clientY - ini.y;
          if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
          const lista = SUBTAB_IDS[modulo] || [];
          const idx = lista.indexOf(tab);
          if (idx < 0) return; // subtela (extrato etc.): não interfere
          const prox = idx + (dx < 0 ? 1 : -1);
          if (prox < 0 || prox >= lista.length) return;
          setCartaoAberto(null); setContaAberta(null);
          setTab(lista[prox]);
        }}
      >
        <ErrorBoundary key={modulo + ":" + tab}>
        <Suspense fallback={<PageFallback />}>
        {/* MÓDULO: FINANÇAS */}
        {modulo === "financas" && renderFinancas()}

        {/* AGENDA — agora incorporada ao módulo Finanças (as tabs vivem em financas). */}
        {modulo === "agenda" && renderAgenda()}

        {/* MÓDULO: NEGÓCIO (revenda + serviços) */}

        {/* MÓDULO: INVESTIMENTOS */}
        {modulo === "invest" && renderInvest()}

        {/* TELA DE ANÁLISE TÉCNICA DE UM ATIVO (fluxo a partir do Análise da Carteira) */}
        {modulo === "invest" && tab === "trade-ativo" && renderTradeAtivo()}

        {/* MÓDULO: CONFIGURAÇÕES */}
        {modulo === "config" && renderConfig()}
        </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
      <BottomTabBar
        modulo={modulo} setModulo={setModulo}
        setTab={irParaTab}
      />
      <PomodoroFloat />
      <ToastContainer />
      <InstallPWA />
      <ConfirmDialog />
      {atalhosVisivel && <AtalhosOverlay onClose={() => setAtalhosVisivel(false)} />}
      <CommandPalette
        open={paletaAberta}
        onClose={() => setPaletaAberta(false)}
        onNavigate={({ modulo: m, tab: t }) => { setModulo(m); irParaTab(t); }}
        onQuickAction={handleQuickAction}
        transacoes={transacoes} contas={contas} ativos={ativos}
        notas={notas} metas={metas} categorias={categorias}
      />
      {["analise-carteira", "trade-ativo"].includes(tab) && !tradeOnboardingVisto && (
        <OnboardingTradeModal onClose={() => setTradeOnboardingVisto(true)} />
      )}
      {/* FAB de AÇÕES RÁPIDAS (pedido 2026-09-22): um toque abre o menu com
          compra por foto, nova transação e calculadora — e o conteúdo das
          telas ganha respiro no rodapé pra nada ficar escondido atrás dele. */}
      <style>{`@media (max-width: 768px) { main { padding-bottom: 150px !important; } }`}</style>
      {modulo === "financas" && (
        <>
          {fabOpen && (
            <div onClick={() => setFabOpen(false)}
                 style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(0,0,0,.28)" }} />
          )}
          {fabOpen && (
            <div style={{ position: "fixed", right: 20, bottom: 148, zIndex: 201,
                          display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              {[
                { icone: "🤖", rotulo: "Falar com o Jarbas", acao: () => setJarbasOpen(true) },
                { icone: "📷", rotulo: "Compra no cartão por foto", acao: () => setComprasFotoOpen(true) },
                { icone: "➕", rotulo: "Nova transação", acao: () => handleQuickAction("transacao") },
                { icone: "🧮", rotulo: "Calculadora de juros", acao: () => setCalcJurosGlobalOpen(true) },
              ].map(b => (
                <button key={b.rotulo} onClick={() => { setFabOpen(false); b.acao(); }}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 10,
                          background: T.card, color: T.ink, border: `1px solid ${T.border}`,
                          borderRadius: 100, padding: "11px 18px", fontSize: 13.5, fontWeight: 700,
                          boxShadow: "0 6px 20px rgba(0,0,0,.3)", cursor: "pointer", whiteSpace: "nowrap",
                        }}>
                  <span style={{ fontSize: 17 }}>{b.icone}</span> {b.rotulo}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setFabOpen(v => !v)}
            style={{
              position: "fixed", bottom: 80, right: 20, zIndex: 201,
              width: 54, height: 54, borderRadius: "50%",
              background: T.gold, color: T.bg, border: "none",
              boxShadow: "0 4px 16px rgba(0,0,0,.35)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", fontSize: 26, lineHeight: 1,
              transform: fabOpen ? "rotate(45deg)" : "none", transition: "transform .18s",
            }}
            title="Ações rápidas: foto, nova transação, calculadora"
            aria-label="Abrir ações rápidas"
            aria-expanded={fabOpen}
          >
            ＋
          </button>
        </>
      )}
    </div>
  );
}
