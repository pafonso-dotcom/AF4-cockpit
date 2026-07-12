import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  RefreshCw, Eye, EyeOff, LogOut, LayoutGrid, Settings2, Check,
  LayoutDashboard, Briefcase, TrendingUp, Target, Copy, PieChart,
  Calculator, LineChart, Award, Coins, FileText, Plus, Settings, ChevronDown, Shield,
  Search, CalendarClock, Boxes, MessageCircle,
} from "lucide-react";

import { T, applyTheme, THEMES } from "./lib/theme.js";
import { simulateTick } from "./lib/format.js";
import { atualizarCarteira } from "./lib/cotacoes.js";
import { loadInvestState, saveInvestState } from "./lib/cloudStore.js";
import { supabaseConfigured, signOut, getUser, getSession } from "./lib/supabase.js";
import { PLANO_PRECO, APP_NOME } from "./lib/config.js";
import { iniciarAssinatura } from "./lib/checkout.js";
import { billingEnabled, getSubscription, acessoLiberado } from "./lib/subscription.js";
import { ehAdmin } from "./lib/admin.js";
import { toast } from "./lib/toast.js";
import Paywall from "./components/billing/Paywall.jsx";
import Admin from "./components/admin/Admin.jsx";
import { carregarFundamentos } from "./lib/fundamentos.js";

import GlobalStyles from "./components/ui/GlobalStyles.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import ConfirmDialog from "./components/ui/ConfirmDialog.jsx";
import Footer from "./components/ui/Footer.jsx";
import Logo from "./components/ui/Logo.jsx";

import InvestPainel from "./components/pages/Invest/InvestPainel.jsx";
import Investimentos from "./components/pages/Investimentos.jsx";
import AnalisesUnificada from "./components/pages/Invest/Analises.jsx";
import ObjetivosCarteira from "./components/pages/Invest/ObjetivosCarteira.jsx";
import CarteiraModelo from "./components/pages/Invest/CarteiraModelo.jsx";
import MonteSuaCarteira from "./components/pages/Invest/MonteSuaCarteira.jsx";
import Proventos from "./components/pages/Invest/Proventos.jsx";
import RelatoriosInvest from "./components/pages/Invest/RelatoriosInvest.jsx";
import CalculadoraRenda from "./components/pages/Invest/CalculadoraRenda.jsx";
import Projecao from "./components/pages/Invest/Projecao.jsx";
import EvolucaoPatrimonio from "./components/pages/Invest/EvolucaoPatrimonio.jsx";
import Planejador from "./components/pages/Invest/Planejador.jsx";
import RendaDividendos from "./components/pages/Invest/RendaDividendos.jsx";
import Screener from "./components/pages/Invest/Screener.jsx";
import ConstrutorMercado from "./components/pages/ConstrutorMercado.jsx";
import AnaliseTrade from "./components/pages/Trade/Analise.jsx";

/* ============================================================
   Persistência: dados de Investimentos vão pro cloudStore (nuvem por
   usuário + cache local). As chaves de API ficam no localStorage do
   dispositivo (Fase 3 troca por proxy no servidor).
   ============================================================ */
const KEYS_KEY = "invest:apikeys:v1";
const lget = (k, fb) => { try { const v = localStorage.getItem(k); return v != null ? JSON.parse(v) : fb; } catch { return fb; } };
const lset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

const TABS = [
  { id: "investimentos", label: "Painel", icon: LayoutDashboard },
  { id: "carteira", label: "Carteira", icon: Briefcase },
  { id: "monte-carteira", label: "Monte sua Carteira", icon: PieChart },
  { id: "objetivos", label: "Objetivos", icon: Target },
  { id: "modelo", label: "Carteira modelo", icon: Copy },
  { id: "planejador", label: "Planejador", icon: CalendarClock },
  { id: "analises", label: "Análises", icon: Award },
  { id: "proventos", label: "Proventos", icon: Coins },
  { id: "renda-dividendos", label: "Renda & Dividendos", icon: Calculator },
  { id: "screener", label: "Screener", icon: Search },
  { id: "construtor-mercado", label: "Construtor de mercado", icon: Boxes },
  { id: "evolucao", label: "Evolução", icon: TrendingUp },
  { id: "relatorios-i", label: "Relatórios", icon: FileText },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState("investimentos");
  // Assinatura (Fase 4). Só trava o acesso quando a cobrança está ligada.
  const [sub, setSub] = useState(null);
  const [subLoading, setSubLoading] = useState(billingEnabled);
  // Usuário logado (pra liberar o painel Gerencial só pro admin).
  const [usuario, setUsuario] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ at: null, mode: "sim", okCount: 0, total: 0 });
  // Paleta de cores escolhida (preferência do dispositivo).
  const [themeId, setThemeId] = useState(() => { try { return localStorage.getItem("invest:theme") || "gold"; } catch { return "gold"; } });
  const [configAberto, setConfigAberto] = useState(false); // menu compacto de ferramentas/config
  const trocarTema = (id) => { setThemeId(id); try { localStorage.setItem("invest:theme", id); } catch {} };
  // Orientação do menu: horizontal (padrão) ou vertical (opcional).
  const [navVertical, setNavVertical] = useState(() => { try { return localStorage.getItem("invest:nav") === "vertical"; } catch { return false; } });
  const toggleNav = () => setNavVertical(v => { const n = !v; try { localStorage.setItem("invest:nav", n ? "vertical" : "horizontal"); } catch {} return n; });

  const [apiKeys, setApiKeys] = useState({ brapi: "", alphavantage: "", anthropic: "", useRealMarket: true });

  // Estado de Investimentos
  const [ativos, setAtivos] = useState([]);
  const [fundamentos, setFundamentos] = useState({});
  const [patrimonioHistorico, setPatrimonioHistorico] = useState([]);
  const [objetivosCarteira, setObjetivosCarteira] = useState([]);
  const [carteirasModeloCustom, setCarteirasModeloCustom] = useState([]);
  const [modeloAtivoId, setModeloAtivoId] = useState("idv-iniciante");
  const [carteiraProventos, setCarteiraProventos] = useState({ saldo: 0, historico: [] });
  const [proventosRecebidos, setProventosRecebidos] = useState({});
  const [proventosIgnorados, setProventosIgnorados] = useState({});
  const [proventosManuais, setProventosManuais] = useState([]);
  const [tradeAnalisesIdV, setTradeAnalisesIdV] = useState([]);
  const [tradeWatchlist, setTradeWatchlist] = useState([]);

  // Ledger leve local (Proventos/compra de ativo usam contas/transações pra
  // registrar movimentações). Desacoplado do módulo Finanças: é um livro
  // interno do próprio app de Investimentos.
  const [contas, setContas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [transacoes, setTransacoes] = useState([]);

  // Navegação interna entre telas
  const [analiseAlvo, setAnaliseAlvo] = useState(null);
  const [projetarAlvo, setProjetarAlvo] = useState(null);
  const [analiseViewInicial, setAnaliseViewInicial] = useState(null);

  applyTheme(themeId);

  /* ---------- Load on mount (nuvem por usuário + cache local) ---------- */
  useEffect(() => {
    (async () => {
    const data = await loadInvestState();
    if (data) {
      setAtivos(data.ativos || []);
      setObjetivosCarteira(data.objetivosCarteira || []);
      setCarteirasModeloCustom(data.carteirasModeloCustom || []);
      setModeloAtivoId(data.modeloAtivoId || "idv-iniciante");
      setCarteiraProventos(data.carteiraProventos || { saldo: 0, historico: [] });
      setProventosRecebidos(data.proventosRecebidos || {});
      setProventosIgnorados(data.proventosIgnorados || {});
      setProventosManuais(data.proventosManuais || []);
      setTradeAnalisesIdV(data.tradeAnalisesIdV || []);
      setTradeWatchlist(data.tradeWatchlist || []);
      setContas(data.contas || []);
      setCategorias(data.categorias || []);
      setTransacoes(data.transacoes || []);
      setPatrimonioHistorico(data.patrimonioHistorico || []);
    }
    // Sem dados salvos = carteira começa vazia (R$ 0,00). O cliente adiciona os próprios.
    setApiKeys(lget(KEYS_KEY, { brapi: "", alphavantage: "", anthropic: "", useRealMarket: true }));
    setLoading(false);
    })();
  }, []);

  /* ---------- Save (nuvem por usuário + cache local) ---------- */
  useEffect(() => {
    if (loading) return;
    saveInvestState({
      ativos, objetivosCarteira, carteirasModeloCustom, modeloAtivoId,
      carteiraProventos, proventosRecebidos, proventosIgnorados, proventosManuais,
      tradeAnalisesIdV, tradeWatchlist, contas, categorias, transacoes,
      patrimonioHistorico,
    });
  }, [loading, ativos, objetivosCarteira, carteirasModeloCustom, modeloAtivoId,
      carteiraProventos, proventosRecebidos, proventosIgnorados, proventosManuais,
      tradeAnalisesIdV, tradeWatchlist, contas, categorias, transacoes, patrimonioHistorico]);

  /* ---------- Snapshot diário do patrimônio (pra Evolução) ---------- */
  useEffect(() => {
    if (loading) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const total = (ativos || []).reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
    const investido = (ativos || []).reduce((s, a) => s + Number(a.qtd || 0) * Number(a.pm ?? a.precoMedio ?? 0), 0);
    if (total <= 0 && investido <= 0) return; // carteira vazia → não registra
    const ponto = { data: hoje, total: +total.toFixed(2), investido: +investido.toFixed(2) };
    setPatrimonioHistorico(prev => {
      const arr = [...(prev || [])];
      const i = arr.findIndex(p => p.data === hoje);
      if (i >= 0) {
        if (arr[i].total === ponto.total && arr[i].investido === ponto.investido) return prev; // sem mudança
        arr[i] = ponto;
      } else {
        arr.push(ponto);
      }
      return arr;
    });
  }, [loading, ativos]);

  useEffect(() => { if (!loading) lset(KEYS_KEY, apiKeys); }, [loading, apiKeys]);

  // Carrega o status da assinatura (só quando a cobrança está ligada).
  useEffect(() => {
    if (!billingEnabled) return;
    getSubscription().then(s => { setSub(s); setSubLoading(false); });
  }, []);

  // Carrega o usuário logado (pra mostrar a aba Gerencial só pro admin).
  useEffect(() => {
    if (!supabaseConfigured) return;
    getUser().then(setUsuario).catch(() => {});
  }, []);

  // Carrega a base de fundamentos (curadoria) pra classificação automática.
  useEffect(() => {
    if (loading) return;
    carregarFundamentos().then(setFundamentos).catch(() => {});
  }, [loading]);

  const tabsVisiveis = ehAdmin(usuario) ? [...TABS, { id: "gerencial", label: "Gerencial", icon: Shield }] : TABS;

  /* ---------- Refresh de mercado ---------- */
  const refreshMarket = async () => {
    setRefreshing(true);
    if (!apiKeys.useRealMarket) {
      setTimeout(() => {
        setAtivos(prev => prev.map(a => {
          const vol = a.tipo === "cripto" ? 0.04 : a.tipo === "fii" ? 0.012 : a.tipo === "tesouro" ? 0.005 : 0.025;
          return { ...a, preco: +simulateTick(a.preco, vol).toFixed(2), ultimaAtt: new Date().toISOString(), realtime: false };
        }));
        setMarketStatus({ at: new Date(), mode: "sim", okCount: 0, total: ativos.length });
        setRefreshing(false);
      }, 600);
      return;
    }
    try {
      const ativosComSymbol = ativos.map(a => {
        if (a.tipo === "cripto" && !/USDT$/i.test(a.ticker)) {
          return { ...a, _symbolCotacao: `${a.ticker.toUpperCase()}USDT` };
        }
        return { ...a, _symbolCotacao: a.ticker };
      });
      const lista = ativosComSymbol.map(a => ({ symbol: a._symbolCotacao, ticker: a._symbolCotacao }));
      const { cotacoes, erros } = await atualizarCarteira(lista);
      let okCount = 0;
      setAtivos(prev => prev.map(a => {
        const sym = a.tipo === "cripto" && !/USDT$/i.test(a.ticker) ? `${a.ticker.toUpperCase()}USDT` : a.ticker;
        const cot = cotacoes[sym];
        if (cot && cot.price) {
          okCount++;
          return { ...a, preco: +parseFloat(cot.price).toFixed(2), variacao24h: cot.changePercent ?? a.variacao24h, ultimaAtt: new Date().toISOString(), realtime: true, fonteCotacao: cot.fonte };
        }
        const vol = a.tipo === "tesouro" ? 0.005 : a.tipo === "cdb" ? 0.003 : 0.012;
        return { ...a, preco: +simulateTick(a.preco, vol).toFixed(2), ultimaAtt: new Date().toISOString(), realtime: false };
      }));
      setMarketStatus({ at: new Date(), mode: okCount > 0 ? "real" : "sim", okCount, total: ativos.length, erros });
    } catch (e) {
      console.error("[refreshMarket]", e);
      setMarketStatus({ at: new Date(), mode: "sim", okCount: 0, total: ativos.length, erros: [e.message] });
    } finally {
      setRefreshing(false);
    }
  };

  // Polling automático (mesma config do app original)
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
    return () => { if (timer) clearTimeout(timer); window.removeEventListener("af4:polling-changed", onChange); };
  }, [loading]);

  const irParaTab = useCallback((t) => { setTab(t); }, []);

  if (loading || (billingEnabled && subLoading)) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: T.bg, color: T.muted }}>
        Carregando…
      </div>
    );
  }

  // Trava de assinatura (só quando a cobrança está ligada).
  // O admin (dono) NUNCA é travado — sempre tem acesso, mesmo com cobrança on.
  if (billingEnabled && !acessoLiberado(sub) && !ehAdmin(usuario)) {
    return (
      <Paywall
        motivo={sub && sub.status !== "none" ? "expirada" : ""}
        preco={PLANO_PRECO}
        onSair={() => signOut()}
        onAssinar={iniciarAssinatura}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink, display: "flex", alignItems: "stretch" }}>
      <GlobalStyles />
      <style>{`.invest-nav::-webkit-scrollbar{display:none}.invest-nav{scrollbar-width:none}`}</style>

      {/* Barra lateral — marca + navegação (estilo AF.finanças) */}
      <aside style={{
        width: 224, flexShrink: 0, background: "#23272E",
        borderRight: "1px solid rgba(255,255,255,.08)",
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
      }}>
        <div style={{ padding: "16px 16px 14px" }}>
          <Logo size={26} />
        </div>

        <div style={{ padding: "0 18px 6px", fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: "rgba(240,235,225,.34)", fontWeight: 700 }}>
          Módulos
        </div>

        <nav className="invest-nav" style={{
          display: "flex", flexDirection: "column", gap: 1,
          padding: "0 10px 12px", overflowY: "auto", flex: 1,
        }}>
          {/* Módulo Investimentos (único do app) — sempre "aberto" */}
          <div style={{
            display: "flex", alignItems: "center", gap: 9,
            padding: "9px 12px", borderRadius: 8, marginBottom: 2,
            background: "rgba(232,194,90,.10)", color: "#E8C25A", fontWeight: 600, fontSize: 13,
          }}>
            <Briefcase size={16} />
            <span>Investimentos</span>
            <ChevronDown size={14} style={{ marginLeft: "auto", opacity: .7 }} />
          </div>

          {/* Sub-itens com conector à esquerda */}
          <div style={{ marginLeft: 19, paddingLeft: 10, borderLeft: "1px solid rgba(255,255,255,.10)", display: "flex", flexDirection: "column", gap: 1 }}>
            {tabsVisiveis.map(t => {
              const ativo = tab === t.id;
              const Icon = t.icon || LayoutDashboard;
              return (
                <button key={t.id} onClick={() => irParaTab(t.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "8px 10px", fontSize: 12.5, cursor: "pointer",
                    background: ativo ? "rgba(232,194,90,.14)" : "transparent",
                    border: "none", borderRadius: 7, textAlign: "left",
                    color: ativo ? "#E8C25A" : "rgba(240,235,225,.62)", fontWeight: ativo ? 600 : 400,
                    whiteSpace: "nowrap",
                  }}>
                  <Icon size={15} style={{ flexShrink: 0, opacity: ativo ? 1 : .8 }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{t.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Rodapé: Novo aporte + Configurações */}
        <div style={{ padding: "10px 12px 14px", borderTop: "1px solid rgba(255,255,255,.08)", display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => irParaTab("carteira")}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer",
              background: "rgba(60,140,90,.18)", color: "#7ed4a2", fontWeight: 600, fontSize: 13,
            }}>
            <Plus size={16} /> Novo aporte
          </button>
          <button onClick={() => setConfigAberto(true)}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
              background: "transparent", color: "rgba(240,235,225,.6)", fontSize: 13, textAlign: "left",
            }}>
            <Settings size={16} /> Configurações
          </button>
        </div>
      </aside>

      {/* Coluna de conteúdo */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
      {/* Cabeçalho — barra de utilidades (ações à direita) */}
      <header style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,.08)", background: "#23272E",
      }}>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {billingEnabled && sub?.emTrial && sub.trialRestante > 0 && (
            <span title="Período de teste" style={{
              display: "inline-flex", alignItems: "center", padding: "6px 10px", borderRadius: 100,
              fontSize: 11.5, fontWeight: 600, background: "rgba(232,194,90,.16)", color: "#E8C25A",
              border: "1px solid rgba(232,194,90,.4)", whiteSpace: "nowrap",
            }}>
              Teste · {sub.trialRestante}d
            </span>
          )}
          {/* Essenciais: ocultar valores + atualizar (compactos, só ícone) */}
          <button onClick={() => setHidden(h => !h)} title={hidden ? "Mostrar valores" : "Ocultar valores"}
                  style={btnIco()}>
            {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
          <button onClick={refreshMarket} disabled={refreshing}
                  title={marketStatus.mode === "real" ? `Cotações reais · ${marketStatus.okCount}/${marketStatus.total}` : "Atualizar cotações"}
                  style={btnIco(refreshing)}>
            <RefreshCw size={15} className={refreshing ? "spin" : ""} />
          </button>

          {/* Menu compacto de ferramentas/configurações (engrenagem) */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setConfigAberto(v => !v)} title="Configurações" style={btnIco(false, configAberto)}>
              <Settings2 size={15} />
            </button>
            {configAberto && (
              <>
                <div onClick={() => setConfigAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 41,
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
                  padding: 8, width: "min(260px, calc(100vw - 24px))", boxShadow: `0 10px 30px ${T.bg}aa`,
                }}>
                  {/* Convidar por WhatsApp — aponta pro app atual (preview ou produção) */}
                  <MenuItem onClick={() => {
                    setConfigAberto(false);
                    const url = typeof window !== "undefined" ? window.location.origin : "";
                    const msg = `Olá! 👋 Te convido pra testar a ${APP_NOME} — plataforma de investimentos.\n\nÉ grátis nesta fase de testes: crie sua conta e organize sua carteira com clareza (cotações, carteira, proventos, análises e mais). 🪙\n\nAcesse: ${url}\n\nDepois me conta o que achou! 🙏`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                  }}>
                    <MessageCircle size={15} /> Convidar por WhatsApp
                  </MenuItem>
                  <div style={{ height: 1, background: T.border, margin: "4px 6px" }} />

                  {/* Paleta de cores (submenu inline) */}
                  <div style={{ padding: "8px 10px 4px", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
                    Paleta de cores
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, padding: "0 6px 6px" }}>
                    {Object.values(THEMES).map(tema => {
                      const ativo = tema.id === themeId;
                      return (
                        <button key={tema.id} onClick={() => trocarTema(tema.id)} title={tema.subtitulo || tema.nome}
                                style={{
                                  display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                                  borderRadius: 7, cursor: "pointer", textAlign: "left",
                                  border: `1px solid ${ativo ? tema.gold : T.border}`,
                                  background: ativo ? `${tema.gold}22` : "transparent",
                                }}>
                          <span style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                            background: `linear-gradient(135deg, ${tema.gold}, ${tema.goldHi})`, border: `1px solid ${T.border}` }} />
                          <span style={{ fontSize: 11, color: ativo ? tema.gold : T.ink, fontWeight: ativo ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {tema.nome}
                          </span>
                          {ativo && <Check size={12} style={{ color: tema.gold, marginLeft: "auto" }} />}
                        </button>
                      );
                    })}
                  </div>

                  {supabaseConfigured && (
                    <>
                      <div style={{ height: 1, background: T.border, margin: "4px 6px" }} />
                      <MenuItem onClick={() => signOut()} cor={T.red}>
                        <LogOut size={15} /> Sair da conta
                      </MenuItem>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="fade-up" style={{ paddingBottom: 40, flex: 1, minWidth: 0 }}>
        {tab === "investimentos" && (
          <InvestPainel ativos={ativos} transacoes={transacoes} categorias={categorias} hidden={hidden}
                        apiKeys={apiKeys}
                        proventosRecebidos={proventosRecebidos}
                        onTabChange={(t) => setTab(t)}
                        onAbrirAnaliseCarteira={() => { setAnaliseViewInicial("carteira-analise"); setTab("analises"); }}
                        onAbrirAnaliseIdv={() => { setAnaliseViewInicial("idv"); setTab("analises"); }}
                        onAnalisar={(ativo) => { setAnaliseAlvo(ativo); setTab("trade-ativo"); }} />
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
                           fundamentos={fundamentos}
                           hidden={hidden} />
          </div>
        )}
        {tab === "evolucao" && (
          <EvolucaoPatrimonio historico={patrimonioHistorico} hidden={hidden} />
        )}
        {tab === "objetivos" && (
          <div className="px-6 md:px-10">
            <ObjetivosCarteira ativos={ativos} objetivosCarteira={objetivosCarteira}
                               setObjetivosCarteira={setObjetivosCarteira} hidden={hidden} apiKeys={apiKeys} />
          </div>
        )}
        {tab === "modelo" && (
          <div className="px-6 md:px-10">
            <CarteiraModelo ativos={ativos} carteirasModeloCustom={carteirasModeloCustom}
                            setCarteirasModeloCustom={setCarteirasModeloCustom}
                            modeloAtivoId={modeloAtivoId} setModeloAtivoId={setModeloAtivoId}
                            hidden={hidden} apiKeys={apiKeys} />
          </div>
        )}
        {tab === "monte-carteira" && (
          <div className="px-6 md:px-10">
            <MonteSuaCarteira ativos={ativos} apiKey={apiKeys.anthropic} />
          </div>
        )}
        {tab === "calc-renda" && (
          <div className="px-6 md:px-10"><CalculadoraRenda /></div>
        )}
        {tab === "projecao" && (
          <div className="px-6 md:px-10">
            <Projecao ativos={ativos} hidden={hidden} apiKeys={apiKeys}
                      alvoInicial={projetarAlvo} onConsumirAlvo={() => setProjetarAlvo(null)} />
          </div>
        )}
        {tab === "analises" && (
          <div className="px-6 md:px-10">
            <AnalisesUnificada ativos={ativos} hidden={hidden}
                               tradeAnalisesIdV={tradeAnalisesIdV} setTradeAnalisesIdV={setTradeAnalisesIdV}
                               onAnalisarAtivo={(ativo) => { setAnaliseAlvo(ativo); setTab("trade-ativo"); }}
                               apiKeys={apiKeys}
                               fundamentos={fundamentos}
                               isAdmin={ehAdmin(usuario)}
                               onMudouFundamentos={() => carregarFundamentos(true).then(setFundamentos)}
                               viewInicial={analiseViewInicial}
                               onConsumirViewInicial={() => setAnaliseViewInicial(null)} />
          </div>
        )}
        {tab === "proventos" && (
          <Proventos ativos={ativos} setAtivos={setAtivos} hidden={hidden}
                     carteiraProventos={carteiraProventos} setCarteiraProventos={setCarteiraProventos}
                     proventosRecebidos={proventosRecebidos} setProventosRecebidos={setProventosRecebidos}
                     proventosIgnorados={proventosIgnorados} setProventosIgnorados={setProventosIgnorados}
                     proventosManuais={proventosManuais} setProventosManuais={setProventosManuais}
                     contas={contas} setContas={setContas} categorias={categorias}
                     transacoes={transacoes} setTransacoes={setTransacoes} />
        )}
        {tab === "relatorios-i" && (
          <RelatoriosInvest ativos={ativos} proventos={[]} operacoes={[]} hidden={hidden} />
        )}
        {tab === "planejador" && (
          <div className="px-6 md:px-10">
            <Planejador transacoes={transacoes} hidden={hidden} />
          </div>
        )}
        {(tab === "renda-dividendos" || tab === "mapa-dividendos") && (
          <div className="px-6 md:px-10">
            <RendaDividendos ativos={ativos} proventosManuais={proventosManuais} hidden={hidden}
              apiKeys={apiKeys} alvoInicial={projetarAlvo} onConsumirAlvo={() => setProjetarAlvo(null)} />
          </div>
        )}
        {tab === "screener" && (
          <div className="px-6 md:px-10">
            <Screener hidden={hidden} />
          </div>
        )}
        {(tab === "construtor-mercado" || tab === "pesquisador-mercado") && (
          <ConstrutorMercado onIrMonteCarteira={() => irParaTab("monte-carteira")} />
        )}
        {tab === "gerencial" && ehAdmin(usuario) && <Admin />}
        {tab === "trade-ativo" && (
          <div className="px-6 md:px-10">
            <AnaliseTrade tradeWatchlist={tradeWatchlist} ativos={ativos} alvoInicial={analiseAlvo}
                          onVoltar={() => setTab("analises")} />
          </div>
        )}
      </main>
      <Footer />
      </div>

      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}

// Botões da barra de marca (fundo escuro fixo) — cores fixas, legíveis no dark.
const btn = (busy) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.16)",
  color: "rgba(240,235,225,.82)",
  cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
});

// Botão compacto só-ícone (topo). `ativo` realça quando o menu está aberto.
const btnIco = (busy, ativo) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  width: 36, height: 36, borderRadius: 9,
  background: ativo ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.04)",
  border: "1px solid rgba(255,255,255,.16)", color: "rgba(240,235,225,.85)",
  cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
});

// Item de menu (dropdown de configurações).
function MenuItem({ children, onClick, cor }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 9, width: "100%",
      padding: "9px 10px", borderRadius: 8, border: "none", background: "transparent",
      color: cor || T.ink, fontSize: 12.5, cursor: "pointer", textAlign: "left",
    }}
      onMouseEnter={e => e.currentTarget.style.background = T.bgSoft}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      {children}
    </button>
  );
}
