import React, { useMemo, useState, useEffect, useRef } from "react";
import { Briefcase, Wallet, TrendingUp, TrendingDown, ArrowRight, Sparkles, BarChart3, DollarSign, Award, RefreshCw, Plus } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN, fmtUSD } from "../../../lib/format.js";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS, ehUS } from "../../../lib/invest-constants.js";
import { calcAlocacaoPorClasse, calcRentabilidadeAtivo } from "../../../lib/invest-utils.js";
import { buscarCotacao } from "../../../lib/cambio.js";
import { getHistorico } from "../../../lib/brapi.js";
import { detectarFonte } from "../../../lib/cotacoes.js";
import { CARD_SHADOW } from "../../../lib/styles.js";
import IndicesGlobais from "../IndicesGlobais.jsx";

export default function InvestPainel({
  ativos = [], transacoes = [], categorias = [],
  hidden, onTabChange, onAnalisar,
  onAbrirAnaliseCarteira, onAbrirAnaliseIdv, apiKeys = {},
  proventosRecebidos = {}, onRefresh, refreshing = false,
}) {
  const hoje = new Date();

  // ===== Totais (custo, valor, resultado, %) — separados BR (R$) e USA (US$) =====
  // Ativos US (Stocks/REITs) têm preço em DÓLAR, então NÃO entram na soma em R$.
  const t = useMemo(() => {
    let custoBR = 0, valorBR = 0, custoUSA = 0, valorUSA = 0;
    ativos.forEach(a => {
      const qtd = Number(a.qtd || 0);
      const c = qtd * Number(a.pm ?? a.precoMedio ?? 0);
      const v = qtd * Number(a.preco || 0);
      if (ehUS(a)) { custoUSA += c; valorUSA += v; }
      else { custoBR += c; valorBR += v; }
    });
    const custo = custoBR + custoUSA, valor = valorBR + valorUSA; // legado (não exibido)
    const resultado = valor - custo;
    const pct = custo > 0 ? (resultado / custo) * 100 : 0;
    const pctBR = custoBR > 0 ? ((valorBR - custoBR) / custoBR) * 100 : 0;
    const pctUSA = custoUSA > 0 ? ((valorUSA - custoUSA) / custoUSA) * 100 : 0;
    return { custo, valor, resultado, pct, valorBR, custoBR, pctBR, valorUSA, custoUSA, pctUSA };
  }, [ativos]);

  // ===== Cotação do dólar ao vivo (R$ por 1 US$) =====
  // Usada para mostrar o saldo dos ativos em dólar convertido em real, abaixo
  // do "Custo Investido". null = ainda carregando / indisponível.
  const [usdRate, setUsdRate] = useState(null);
  useEffect(() => {
    let vivo = true;
    buscarCotacao("USD").then(r => { if (vivo && r) setUsdRate(r); });
    return () => { vivo = false; };
  }, []);

  // ===== Posições / classes únicas =====
  const posicoes = useMemo(() => ({
    qtd: ativos.length,
    classes: new Set(ativos.map(a => a.tipo)).size,
  }), [ativos]);

  // ===== Alocação por classe (donut) =====
  // Alocação separada por moeda: Brasil (R$) e EUA (US$). Stocks/REITs = EUA.
  const alocacaoBR = useMemo(() => calcAlocacaoPorClasse(ativos.filter(a => !["stock", "reit"].includes(a?.tipo))), [ativos]);
  const alocacaoUSA = useMemo(() => calcAlocacaoPorClasse(ativos.filter(a => ["stock", "reit"].includes(a?.tipo))), [ativos]);

  // ===== Top 5 ativos por valor =====
  const topAtivos = useMemo(() => {
    return ativos
      .map(a => {
        const r = calcRentabilidadeAtivo(a);
        return { ativo: a, valor: r.valor, custo: r.custo, rentab: r.pctGanho };
      })
      .filter(x => x.valor > 0)
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5);
  }, [ativos]);

  // ===== Variações por ativo (gainers / losers) =====
  const variacoes = useMemo(() => {
    return ativos
      .map(a => {
        const r = calcRentabilidadeAtivo(a);
        return { ativo: a, ganho: r.ganho, pct: r.pctGanho };
      })
      .filter(x => isFinite(x.pct) && Number(x.ativo.qtd) > 0);
  }, [ativos]);
  const topGain = useMemo(() => [...variacoes].sort((a,b) => b.pct - a.pct).slice(0, 3), [variacoes]);
  const topLoss = useMemo(() => [...variacoes].sort((a,b) => a.pct - b.pct).slice(0, 3), [variacoes]);

  // ===== Proventos do mês =====
  // Fonte: aba Proventos (proventos marcados como recebidos). Cada recebido
  // guarda { dataBaixa, valor }. Somamos os do mês corrente. Antes isso era
  // uma heurística por regex nas transações, que inflava o número (pegava
  // rendimento de poupança/CDB etc).
  const proventosMes = useMemo(() => {
    const mesISO = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
    return Object.values(proventosRecebidos || {})
      .filter(r => (r?.dataBaixa || "").startsWith(mesISO))
      .reduce((s, r) => s + (Number(r?.valor) || 0), 0);
  }, [proventosRecebidos]);

  // Abre o fluxo de novo aporte: vai pra Carteira (onde o modal vive) e dispara
  // o evento que a tela escuta. Sem ativos, ela abre o "Novo Ativo".
  const novoAporte = () => {
    onTabChange?.("carteira");
    setTimeout(() => window.dispatchEvent(new CustomEvent("af4:open-new-aporte")), 60);
  };

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Header — título à esquerda */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 500 }}>
          Investimentos · Painel
        </div>
        <h1 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 600, color: T.ink, margin: "4px 0 0 0" }}>
          Sua carteira, <em style={{ color: T.gold }}>com clareza.</em>
        </h1>
      </div>

      {/* Topo · 2 colunas: esquerda = Alocação por Moeda + ações; direita =
          índices de mercado + KPIs. Alturas igualadas (alignItems stretch). */}
      <section className="ip-top" style={{
        display: "grid", gridTemplateColumns: "minmax(230px, 1fr) 3fr", gap: 12, marginBottom: 16, alignItems: "stretch",
      }}>
        {/* Esquerda */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <div style={{ flex: 1, display: "flex" }}>
            <MoedaCard valorBR={t.valorBR} valorUSA={t.valorUSA} usdRate={usdRate} hidden={hidden} fmtUSD={fmtUSD} fill />
          </div>
          <div className="ip-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {onRefresh && (
              <button onClick={onRefresh} disabled={refreshing} className="ip-btn ip-btn-primary" title="Atualizar cotações do mercado">
                <RefreshCw size={13} className={refreshing ? "spin" : ""} style={{ flexShrink: 0 }} />
                {refreshing ? "Atualizando…" : "Atualizar mercado"}
              </button>
            )}
            <button onClick={novoAporte} className="ip-btn ip-btn-gold" title="Registrar um novo aporte">
              <Plus size={13} style={{ flexShrink: 0 }} />
              Novo aporte
            </button>
          </div>
        </div>
        {/* Direita */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
          <IndicesGlobais apiKeys={apiKeys} />
          <div className="ip-kpi4" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, flex: 1, alignItems: "stretch" }}>
            <Kpi label="Custo Investido" value={t.custo} format={fmt} hidden={hidden} sub="Total aportado" icon={Wallet} cor={T.muted} />
            <Kpi label="Resultado" value={t.resultado} format={fmt} hidden={hidden} variation={t.pct} cor={t.resultado >= 0 ? T.green : T.red}
                 icon={t.resultado >= 0 ? TrendingUp : TrendingDown} />
            <Kpi label="Proventos · mês" value={proventosMes} format={fmt} hidden={hidden} sub="Receita passiva" icon={DollarSign} cor={T.green} />
            <Kpi label="Posições" value={posicoes.qtd} format={(n) => String(Math.round(n))} sub={`${posicoes.classes} classes`} icon={Briefcase} cor={T.gold} />
          </div>
        </div>
      </section>

      {/* Linha 2 */}
      <section className="ip-mid-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <AlocacaoCard dataBR={alocacaoBR} totalBR={t.valorBR} dataUSA={alocacaoUSA} totalUSA={t.valorUSA} hidden={hidden} fmtUSD={fmtUSD} />
        <TopAtivosCard items={topAtivos} hidden={hidden} onAnalisar={onAnalisar} onSeeAll={() => onTabChange?.("carteira")} />
      </section>

      {/* Linha 3 */}
      <section className="ip-bot-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <ClassesExpansiveisCard ativos={ativos} hidden={hidden} onAnalisar={onAnalisar} fmtUSD={fmtUSD} />
        <GainersLosersCard topGain={topGain} topLoss={topLoss} hidden={hidden} onAnalisar={onAnalisar} />
      </section>

      {/* Atalhos */}
      <section className="ip-foot-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
      }}>
        <AtalhoCard label="Análise IdV" sub="Critérios fundamentalistas"
                    icon={Award} cor={T.green} onClick={() => onAbrirAnaliseIdv?.()} />
        <AtalhoCard label="Pergunte à IA" sub="Tire dúvidas e obtenha análises"
                    icon={Sparkles} cor={T.blue || "#60a5fa"} onClick={() => onTabChange?.("perguntar")} />
      </section>

      <style>{`
        /* Botões de ação rápida */
        .ip-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 13px; border-radius: 10px; font-size: 12px; font-weight: 600;
          cursor: pointer; white-space: nowrap; transition: transform .12s ease, filter .15s ease, background .15s ease;
          border: 1px solid ${T.border};
        }
        .ip-btn:active { transform: scale(0.97); }
        .ip-btn:disabled { opacity: .55; cursor: default; }
        .ip-btn-primary { background: ${T.bgSoft}; color: ${T.ink}; }
        .ip-btn-primary:hover:not(:disabled) { background: ${T.cardHi}; }
        .ip-btn-gold { background: ${T.gold}; color: ${T.dark ? "#1a1a1a" : "#fff"}; border-color: ${T.gold}; }
        .ip-btn-gold:hover { filter: brightness(1.07); }

        /* Chips de atalho (Carteira, Proventos, …) */
        .ip-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 6px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 500;
          background: transparent; border: 1px solid ${T.border}; color: ${T.muted};
          cursor: pointer; white-space: nowrap; transition: color .15s ease, border-color .15s ease, background .15s ease;
        }
        .ip-chip:hover { color: ${T.gold}; border-color: ${T.gold}66; background: ${T.gold}12; }

        /* Cards: leve elevação no hover + entrada escalonada */
        .ip-card { transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
        .ip-card:hover { transform: translateY(-2px); }
        .ip-atalho:hover { border-color: ${T.gold}66; }
        .ip-kpi-grid > * { animation: ipUp .42s ease both; }
        .ip-kpi-grid > *:nth-child(2) { animation-delay: .05s; }
        .ip-kpi-grid > *:nth-child(3) { animation-delay: .1s; }
        .ip-kpi-grid > *:nth-child(4) { animation-delay: .15s; }
        .ip-kpi-grid > *:nth-child(5) { animation-delay: .2s; }
        @keyframes ipUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 600px) {
          .ip-chip-label { display: none; }
          .ip-chip { padding: 6px 9px; }
        }
        @media (max-width: 1024px) {
          .ip-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ip-mid-grid, .ip-bot-grid, .ip-foot-grid, .ip-evo-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .ip-top { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 560px) {
          .ip-kpi4 { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 380px) {
          .ip-kpi-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ip-card:hover { transform: none; }
          .ip-kpi-grid > * { animation: none; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Sub-componentes
   ============================================================ */

// Respeita a preferência do sistema por menos movimento (acessibilidade).
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const h = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", h);
    return () => mq.removeEventListener?.("change", h);
  }, []);
  return reduced;
}

// Número que "conta" suavemente até o valor (count-up). Anima do 0 ao montar
// e entre mudanças de valor — dá a sensação de painel vivo/ágil. Quando
// oculto (modo privacidade) ou com reduced-motion, mostra direto sem animar.
function AnimatedNumber({ value, format = (n) => String(n), hidden, hiddenText = "•••••", duration = 650, className, style }) {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (hidden) return; // não anima escondido; retoma do último valor ao reexibir
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (reduced || from === to) { setDisplay(to); fromRef.current = to; return; }
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setDisplay(from + (to - from) * eased);
      if (p < 1) { rafRef.current = requestAnimationFrame(tick); }
      else { fromRef.current = to; }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, hidden, reduced, duration]);

  if (hidden) return <span className={className} style={style}>{hiddenText}</span>;
  return <span className={className} style={style}>{format(display)}</span>;
}

// Alocação por moeda (Brasil R$ vs EUA US$) com bandeiras. Converte o lado EUA
// pra R$ (via dólar ao vivo) só para calcular a proporção da barra; os valores
// continuam exibidos em cada moeda.
function MoedaCard({ valorBR = 0, valorUSA = 0, usdRate, hidden, fmtUSD, fill = false }) {
  const usaEmBRL = usdRate ? valorUSA * usdRate : 0;
  const totalBRL = valorBR + usaEmBRL;
  const pctBR = totalBRL > 0 ? (valorBR / totalBRL) * 100 : (valorUSA > 0 ? 0 : 100);
  const pctUSA = totalBRL > 0 ? (usaEmBRL / totalBRL) * 100 : 0;
  const temUSA = valorUSA > 0;
  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW, width: "100%", height: fill ? "100%" : undefined }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Alocação por Moeda</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }} aria-hidden="true">🇧🇷</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: T.muted }}>Brasil · R$</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{hidden ? "•••••" : fmt(valorBR)}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: T.gold }}>{fmtN(pctBR, 0)}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22, opacity: temUSA ? 1 : 0.4 }} aria-hidden="true">🇺🇸</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, color: T.muted }}>EUA · US$</div>
            <div className="num" style={{ fontSize: 16, fontWeight: 700, color: temUSA ? T.ink : T.muted }}>{hidden ? "•••••" : fmtUSD(valorUSA)}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#2dd4bf" }}>{temUSA ? `${fmtN(pctUSA, 0)}%` : "—"}</span>
        </div>
        {/* Barra dividida */}
        <div style={{ display: "flex", height: 16, borderRadius: 999, overflow: "hidden", background: T.bgSoft, marginTop: 2 }}>
          <div style={{ width: `${pctBR}%`, background: T.gold }} />
          <div style={{ width: `${pctUSA}%`, background: "#2dd4bf" }} />
        </div>
        <div style={{ fontSize: 9.5, color: T.faint, fontStyle: "italic" }}>
          {temUSA
            ? (usdRate ? `Proporção convertida ao dólar ${fmt(usdRate)}.` : "Carregando dólar para a proporção…")
            : "Sem ativos em dólar."}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, format = (n) => String(n), hidden, sub, variation, icon: Icon, cor, extra }) {
  const num = typeof variation === "number" ? variation : null;
  const varStr = num != null ? (num >= 0 ? "↗ +" : "↘ ") + fmtN(num, 2) + "%" : null;
  const positive = num != null && num >= 0;
  return (
    <div style={{ position: "relative", paddingTop: 9 }}>
      {/* aba da pasta — branca/clara, no mesmo estilo dos folder cards */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: "32%", right: "9%", height: 15, borderRadius: "10px 10px 0 0", background: T.bgSoft, border: `1px solid ${T.border}`, borderBottom: "none", zIndex: 0 }} />
      <div className="ip-card" style={{ position: "relative", zIndex: 1, background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, minHeight: 110, boxShadow: CARD_SHADOW }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <AnimatedNumber value={value} format={format} hidden={hidden}
        className="num" style={{ display: "block", fontFamily: T.serif, fontSize: 22, fontWeight: 700, marginTop: 6, color: T.ink }} />
      {varStr && <div style={{ fontSize: 11, color: positive ? T.green : T.red, marginTop: 4 }}>{varStr}</div>}
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sub}</div>}
      {extra && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 9.5, letterSpacing: ".04em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>{extra.label}</div>
          <div className="num" style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 700, color: T.ink, marginTop: 1 }}>{extra.valor}</div>
          {extra.sub && <div style={{ fontSize: 9.5, color: T.muted, marginTop: 1 }}>{extra.sub}</div>}
        </div>
      )}
      {Icon && (
        <div style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", background: `${cor || T.gold}1f`, display: "grid", placeItems: "center" }}>
          <Icon size={16} style={{ color: cor || T.gold }} />
        </div>
      )}
      </div>
    </div>
  );
}

function DonutBloco({ titulo, data, total, fmtMoeda, hidden }) {
  const max = Math.max(1, ...data.map(d => Number(d.valor) || 0));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>{titulo}</div>
        <div className="num" style={{ fontFamily: T.serif, fontSize: 12.5, fontWeight: 700, color: T.ink }}>{hidden ? "•••" : fmtMoeda(total)}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((d,i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 88, flexShrink: 0, fontSize: 11, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
            <div style={{ flex: 1, height: 8, borderRadius: 999, background: T.bgSoft, overflow: "hidden" }}>
              <div style={{ width: `${(Number(d.valor) / max) * 100}%`, height: "100%", borderRadius: 999, background: d.cor }} />
            </div>
            <span style={{ width: 36, textAlign: "right", flexShrink: 0, fontSize: 10.5, color: T.ink }}>{fmtN(d.pct, 0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AlocacaoCard({ dataBR = [], totalBR = 0, dataUSA = [], totalUSA = 0, hidden, fmtUSD }) {
  const semNada = dataBR.length === 0 && dataUSA.length === 0;
  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Alocação por Classe</div>
      {semNada ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>Sem ativos cadastrados.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {dataBR.length > 0 && <DonutBloco titulo="🇧🇷 Brasil · R$" data={dataBR} total={totalBR} fmtMoeda={fmt} hidden={hidden} />}
          {dataUSA.length > 0 && (
            <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
              <DonutBloco titulo="🇺🇸 EUA · US$" data={dataUSA} total={totalUSA} fmtMoeda={fmtUSD} hidden={hidden} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Sparklines reais (histórico de preço via BRAPI), com cache local =====
const SPARK_TTL = 12 * 3600 * 1000; // 12h — evita estourar o limite mensal BRAPI
const sparkKey = (tk) => `af4:spark:${tk}`;

function lerSparkCache(tk) {
  try {
    const raw = localStorage.getItem(sparkKey(tk));
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || !Array.isArray(o.serie) || o.serie.length < 2) return null;
    return o; // { t, serie }
  } catch { return null; }
}
function gravarSparkCache(tk, serie) {
  try { localStorage.setItem(sparkKey(tk), JSON.stringify({ t: Date.now(), serie })); } catch {}
}

// Busca (com cache) a série de fechamento dos últimos meses para os tickers BRAPI
// visíveis. Sem token BRAPI ou para cripto/renda fixa, não busca → cai no fallback.
function useSparklines(items) {
  const [map, setMap] = useState({});
  const tickers = (items || [])
    .map(x => x.ativo)
    .filter(a => a && (a.ticker || a.symbol) && detectarFonte(a.ticker || a.symbol) === "brapi" && a.tipo !== "capitalSocial")
    .map(a => a.ticker || a.symbol);
  const chave = tickers.join(",");
  useEffect(() => {
    let cancel = false;
    let temToken = false;
    try { temToken = !!localStorage.getItem("af4:brapi-token"); } catch {}
    const out = {};
    // 1) Cache fresco entra na hora.
    for (const tk of tickers) {
      const c = lerSparkCache(tk);
      if (c && Date.now() - c.t < SPARK_TTL) out[tk] = c.serie;
    }
    if (Object.keys(out).length) setMap(prev => ({ ...prev, ...out }));
    // 2) Sem token, não tenta rede (renda fixa/cripto também não têm histórico BRAPI).
    if (!temToken) return () => { cancel = true; };
    (async () => {
      for (const tk of tickers) {
        if (out[tk]) continue; // já veio do cache
        try {
          const hist = await getHistorico(tk, "3mo", "1d");
          const serie = hist.map(h => h.close).filter(v => Number.isFinite(v) && v > 0);
          if (serie.length >= 2) {
            gravarSparkCache(tk, serie);
            if (!cancel) setMap(prev => ({ ...prev, [tk]: serie }));
          }
        } catch { /* token inválido / limite / rede: silencioso, usa fallback */ }
        if (cancel) return;
      }
    })();
    return () => { cancel = true; };
  }, [chave]);
  return map;
}

// Mini-gráfico do ativo. Com histórico real (série BRAPI) desenha a curva de
// fechamento; sem ele, cai numa linha de tendência do ganho vs preço médio.
// Verde sobe, vermelho desce.
function MiniTrend({ serie, rentab = 0, cor, w = 56, h = 20 }) {
  const real = Array.isArray(serie) && serie.length >= 2;
  const data = real ? serie : [100, 100 + (Number(rentab) || 0)];
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / span) * (h - 3) - 1.5;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block", flexShrink: 0 }} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={cor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function TopAtivosCard({ items, hidden, onAnalisar, onSeeAll }) {
  const sparks = useSparklines(items);
  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Top 5 Ativos</div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Ver carteira</button>
      </div>
      <div>
        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>Sem ativos.</div>
        ) : items.map(({ ativo, rentab }) => {
          const cor = rentab >= 0 ? T.green : T.red;
          const serie = sparks[ativo.ticker || ativo.symbol];
          return (
          <button key={ativo.id} onClick={() => onAnalisar?.(ativo)}
            style={{ width: "100%", background: "transparent", border: "none", padding: "8px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 11, background: ASSET_CLASS_COLORS[ativo.tipo] || T.gold, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
              {String(ativo.ticker || "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ativo.ticker}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{ASSET_CLASS_LABELS[ativo.tipo] || ativo.tipo}</div>
            </div>
            <MiniTrend serie={serie} rentab={rentab} cor={cor} />
            <div className="num" style={{ fontSize: 11.5, color: cor, fontWeight: 600, minWidth: 46, textAlign: "right", flexShrink: 0 }}>
              {rentab >= 0 ? "+" : ""}{fmtN(rentab, 1)}%
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}

function SinaisCTA({ onClick }) {
  const bg = "linear-gradient(135deg, #0d2818 0%, #1a3a26 100%)";
  return (
    <div style={{ background: bg, color: "#fff", borderRadius: 18, padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>🤖 Análise da Carteira</div>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, marginBottom: 14, color: "rgba(255,255,255,0.85)" }}>
        Varredura técnica completa — RSI, MACD, tendência e score 0-100 para cada ativo da carteira. Sinais de compra, venda e neutro em uma única tela.
      </div>
      <button onClick={onClick}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px 12px", borderRadius: 11, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
        Abrir análise →
      </button>
    </div>
  );
}

// Lista expansível por classe de ativo: cada classe mostra nº de ativos e valor
// total; clicar abre/fecha a lista dos ativos daquela classe (drill-down).
// Substitui o antigo "Valor por Classe" (estático) por uma visão navegável.
function ClassesExpansiveisCard({ ativos = [], hidden, onAnalisar, fmtUSD }) {
  const US = new Set(["stock", "reit"]);
  const grupos = useMemo(() => {
    const m = new Map();
    (ativos || []).forEach(a => {
      const tipo = a?.tipo || "outro";
      if (!m.has(tipo)) m.set(tipo, []);
      const r = calcRentabilidadeAtivo(a);
      m.get(tipo).push({ ativo: a, valor: r.valor, rentab: r.pctGanho });
    });
    return [...m.entries()]
      .map(([tipo, items]) => ({
        tipo,
        label: ASSET_CLASS_LABELS[tipo] || tipo,
        cor: ASSET_CLASS_COLORS[tipo] || T.gold,
        moedaUS: US.has(tipo),
        items: items.sort((a, b) => b.valor - a.valor),
        total: items.reduce((s, x) => s + (Number(x.valor) || 0), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [ativos]);

  // Por padrão, a classe de maior valor já vem aberta.
  const [abertas, setAbertas] = useState(() => new Set(grupos[0] ? [grupos[0].tipo] : []));
  const toggle = (tipo) => setAbertas(prev => {
    const n = new Set(prev);
    n.has(tipo) ? n.delete(tipo) : n.add(tipo);
    return n;
  });
  const moeda = (us, v) => us ? fmtUSD(v) : fmt(v);

  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Classes da Carteira</div>
      {grupos.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>Sem ativos.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {grupos.map(g => {
            const aberta = abertas.has(g.tipo);
            return (
              <div key={g.tipo} style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => toggle(g.tipo)} aria-expanded={aberta}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: aberta ? T.bgSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ color: aberta ? T.gold : T.muted, fontSize: 11, width: 12, flexShrink: 0, transition: "transform .15s ease", transform: aberta ? "rotate(0deg)" : "rotate(0deg)" }}>{aberta ? "▾" : "▸"}</span>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: g.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</span>
                  <span style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>{g.items.length} {g.items.length === 1 ? "ativo" : "ativos"}</span>
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 700, color: T.gold, flexShrink: 0, minWidth: 64, textAlign: "right" }}>{hidden ? "•••" : moeda(g.moedaUS, g.total)}</span>
                </button>
                {aberta && (
                  <div style={{ padding: "2px 11px 8px", borderTop: `1px dashed ${T.border}` }}>
                    {g.items.map(({ ativo, valor, rentab }) => (
                      <button key={ativo.id} onClick={() => onAnalisar?.(ativo)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "6px 0 6px 20px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ativo.ticker}</span>
                        <span className="num" style={{ fontSize: 11.5, color: T.ink, whiteSpace: "nowrap" }}>{hidden ? "•••" : moeda(g.moedaUS, valor)}</span>
                        <span className="num" style={{ fontSize: 10.5, width: 52, textAlign: "right", color: rentab >= 0 ? T.green : T.red }}>{rentab >= 0 ? "+" : ""}{fmtN(rentab, 1)}%</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProventosMesesCard({ data, hidden }) {
  const total = data.reduce((s,d) => s+d.total, 0);
  const ehVazio = total === 0;
  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Proventos · 12 meses</div>
        <div className="num" style={{ fontSize: 12, color: T.green }}>{hidden ? "•••" : fmt(total)}</div>
      </div>
      {ehVazio ? (
        <div style={{ padding: 32, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>
          Sem proventos detectados. Categorize transações como <strong style={{ color: T.green }}>"Provento"</strong>, <strong style={{ color: T.green }}>"Dividendo"</strong> ou <strong style={{ color: T.green }}>"Rendimento"</strong> para aparecerem aqui.
        </div>
      ) : (
        <div style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: T.muted }} />
              <YAxis tick={{ fontSize: 9, fill: T.muted }} width={40} />
              <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11 }} />
              <Bar dataKey="total" fill={T.green} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function GainersLosersCard({ topGain, topLoss, hidden, onAnalisar }) {
  const altas = (topGain || []).filter(x => x.pct > 0);
  const baixas = (topLoss || []).filter(x => x.pct < 0);
  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Maiores Variações</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: ".15em", color: T.green, fontWeight: 600, marginBottom: 5 }}>↗ MAIORES ALTAS</div>
          {altas.length === 0 ? (
            <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>—</div>
          ) : altas.map(({ ativo, ganho, pct }) => (
            <button key={ativo.id} onClick={() => onAnalisar?.(ativo)}
              style={{ width: "100%", background: "transparent", border: "none", padding: "4px 0", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}>
              <span style={{ flex: 1, fontSize: 12, color: T.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ativo.ticker}</span>
              <span className="num" style={{ fontSize: 11, color: T.green, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(ganho)}</span>
              <span className="num" style={{ fontSize: 11, color: T.green, width: 56, textAlign: "right" }}>+{fmtN(pct, 1)}%</span>
            </button>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: ".15em", color: T.red, fontWeight: 600, marginBottom: 5 }}>↘ MAIORES BAIXAS</div>
          {baixas.length === 0 ? (
            <div style={{ fontSize: 11, color: T.muted, fontStyle: "italic" }}>—</div>
          ) : baixas.map(({ ativo, ganho, pct }) => (
            <button key={ativo.id} onClick={() => onAnalisar?.(ativo)}
              style={{ width: "100%", background: "transparent", border: "none", padding: "4px 0", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left" }}>
              <span style={{ flex: 1, fontSize: 12, color: T.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ativo.ticker}</span>
              <span className="num" style={{ fontSize: 11, color: T.red, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(ganho)}</span>
              <span className="num" style={{ fontSize: 11, color: T.red, width: 56, textAlign: "right" }}>{fmtN(pct, 1)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AtalhoCard({ label, sub, icon: Icon, cor, onClick }) {
  return (
    <button onClick={onClick} className="ip-card ip-atalho"
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ width: 40, height: 40, borderRadius: 14, background: `${cor}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon size={20} style={{ color: cor }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{sub}</div>
      </div>
      <ArrowRight size={16} style={{ color: T.muted }} />
    </button>
  );
}
