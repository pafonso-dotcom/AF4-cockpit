import React, { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Eye, EyeOff, LogOut, Palette } from "lucide-react";

import { T, applyTheme, THEMES } from "./lib/theme.js";
import { simulateTick } from "./lib/format.js";
import { atualizarCarteira } from "./lib/cotacoes.js";
import { loadInvestState, saveInvestState } from "./lib/cloudStore.js";
import { supabaseConfigured, signOut } from "./lib/supabase.js";
import { billingEnabled, getSubscription, acessoLiberado } from "./lib/subscription.js";
import { toast } from "./lib/toast.js";
import Paywall from "./components/billing/Paywall.jsx";

import GlobalStyles from "./components/ui/GlobalStyles.jsx";
import ToastContainer from "./components/ui/ToastContainer.jsx";
import ConfirmDialog from "./components/ui/ConfirmDialog.jsx";
import Footer from "./components/ui/Footer.jsx";

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
  { id: "investimentos", label: "Painel" },
  { id: "carteira", label: "Carteira" },
  { id: "objetivos", label: "Objetivos" },
  { id: "modelo", label: "Carteira modelo" },
  { id: "monte-carteira", label: "Monte sua carteira" },
  { id: "calc-renda", label: "Calculadora" },
  { id: "projecao", label: "Projeção" },
  { id: "analises", label: "Análises" },
  { id: "proventos", label: "Proventos" },
  { id: "relatorios-i", label: "Relatórios" },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [tab, setTab] = useState("investimentos");
  // Assinatura (Fase 4). Só trava o acesso quando a cobrança está ligada.
  const [sub, setSub] = useState(null);
  const [subLoading, setSubLoading] = useState(billingEnabled);
  const [refreshing, setRefreshing] = useState(false);
  const [marketStatus, setMarketStatus] = useState({ at: null, mode: "sim", okCount: 0, total: 0 });
  // Paleta de cores escolhida (preferência do dispositivo).
  const [themeId, setThemeId] = useState(() => { try { return localStorage.getItem("invest:theme") || "gold"; } catch { return "gold"; } });
  const [paletaAberta, setPaletaAberta] = useState(false);
  const trocarTema = (id) => { setThemeId(id); try { localStorage.setItem("invest:theme", id); } catch {} };

  const [apiKeys, setApiKeys] = useState({ brapi: "", alphavantage: "", anthropic: "", useRealMarket: true });

  // Estado de Investimentos
  const [ativos, setAtivos] = useState([]);
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
    });
  }, [loading, ativos, objetivosCarteira, carteirasModeloCustom, modeloAtivoId,
      carteiraProventos, proventosRecebidos, proventosIgnorados, proventosManuais,
      tradeAnalisesIdV, tradeWatchlist, contas, categorias, transacoes]);

  useEffect(() => { if (!loading) lset(KEYS_KEY, apiKeys); }, [loading, apiKeys]);

  // Carrega o status da assinatura (só quando a cobrança está ligada).
  useEffect(() => {
    if (!billingEnabled) return;
    getSubscription().then(s => { setSub(s); setSubLoading(false); });
  }, []);

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
  if (billingEnabled && !acessoLiberado(sub)) {
    return (
      <Paywall
        motivo={sub && sub.status !== "none" ? "expirada" : ""}
        onSair={() => signOut()}
        onAssinar={() => toast.success("Pagamento via Mercado Pago será ativado em breve.")}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.ink }}>
      <GlobalStyles />
      <style>{`.invest-nav::-webkit-scrollbar{display:none}.invest-nav{scrollbar-width:none}`}</style>

      {/* Cabeçalho */}
      <header style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        padding: "14px 20px", borderBottom: `1px solid ${T.border}`, background: T.card,
      }}>
        <div style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: T.gold, letterSpacing: "-0.02em" }}>
          Investimentos
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => setHidden(h => !h)} title={hidden ? "Mostrar valores" : "Ocultar valores"}
                  style={btn()}>
            {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button onClick={refreshMarket} disabled={refreshing} title="Atualizar cotações"
                  style={btn(refreshing)}>
            <RefreshCw size={14} className={refreshing ? "spin" : ""} />
            {marketStatus.mode === "real" ? `Real · ${marketStatus.okCount}/${marketStatus.total}` : "Atualizar"}
          </button>
          {/* Paleta de cores */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setPaletaAberta(v => !v)} title="Mudar paleta de cores" style={btn()}>
              <Palette size={14} /> Cores
            </button>
            {paletaAberta && (
              <>
                <div onClick={() => setPaletaAberta(false)}
                     style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 41,
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
                  padding: 10, width: "min(230px, calc(100vw - 32px))", boxShadow: `0 8px 24px ${T.bg}99`,
                }}>
                  <div style={{ fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, marginBottom: 8, fontWeight: 600 }}>
                    Paleta de cores
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
                    {Object.values(THEMES).map(tema => {
                      const ativo = tema.id === themeId;
                      return (
                        <button key={tema.id} onClick={() => { trocarTema(tema.id); setPaletaAberta(false); }}
                                title={tema.subtitulo || tema.nome}
                                style={{
                                  display: "flex", alignItems: "center", gap: 7, padding: "6px 8px",
                                  borderRadius: 7, cursor: "pointer", textAlign: "left",
                                  border: `1px solid ${ativo ? tema.gold : T.border}`,
                                  background: ativo ? `${tema.gold}22` : "transparent",
                                }}>
                          <span style={{
                            width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                            background: `linear-gradient(135deg, ${tema.gold}, ${tema.goldHi})`,
                            border: `1px solid ${T.border}`,
                          }} />
                          <span style={{ fontSize: 11.5, color: ativo ? tema.gold : T.ink, fontWeight: ativo ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {tema.nome}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
          {supabaseConfigured && (
            <button onClick={() => signOut()} title="Sair da conta" style={btn()}>
              <LogOut size={14} /> Sair
            </button>
          )}
        </div>
      </header>

      {/* Navegação por abas */}
      <nav className="invest-nav" style={{
        display: "flex", gap: 4, padding: "10px 16px",
        borderBottom: `1px solid ${T.border}`, background: T.card,
        // No celular vira uma faixa rolável na horizontal (em vez de quebrar em
        // várias linhas e ocupar meia tela).
        flexWrap: "nowrap", overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => irParaTab(t.id)}
                  style={{
                    padding: "6px 14px", borderRadius: 100, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${tab === t.id ? T.gold : T.border}`,
                    background: tab === t.id ? `${T.gold}22` : "transparent",
                    color: tab === t.id ? T.gold : T.muted, fontWeight: tab === t.id ? 600 : 400,
                    whiteSpace: "nowrap", flexShrink: 0,
                  }}>
            {t.label}
          </button>
        ))}
      </nav>

      <main className="fade-up" style={{ paddingBottom: 40 }}>
        {tab === "investimentos" && (
          <InvestPainel ativos={ativos} transacoes={transacoes} categorias={categorias} hidden={hidden}
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
                           hidden={hidden} />
          </div>
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
        {tab === "trade-ativo" && (
          <div className="px-6 md:px-10">
            <AnaliseTrade tradeWatchlist={tradeWatchlist} ativos={ativos} alvoInicial={analiseAlvo}
                          onVoltar={() => setTab("analises")} />
          </div>
        )}
      </main>

      <Footer />
      <ToastContainer />
      <ConfirmDialog />
    </div>
  );
}

const btn = (busy) => ({
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "7px 12px", borderRadius: 7, fontSize: 12, fontWeight: 500,
  background: "transparent", border: `1px solid ${T.border}`, color: T.muted,
  cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
});
