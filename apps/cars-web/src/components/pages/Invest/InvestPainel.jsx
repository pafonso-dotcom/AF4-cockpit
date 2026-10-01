import React, { useMemo, useState, useEffect, useRef } from "react";
import { TrendingUp, TrendingDown, ArrowRight, Sparkles, Award } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN, fmtUSD } from "../../../lib/format.js";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS, ehUS } from "../../../lib/invest-constants.js";
import { calcRentabilidadeAtivo } from "../../../lib/invest-utils.js";
import { buscarCotacao } from "../../../lib/cambio.js";
import { getHistorico } from "../../../lib/brapi.js";
import { detectarFonte } from "../../../lib/cotacoes.js";
import { CARD_SHADOW } from "../../../lib/styles.js";
import IndicesGlobais from "../IndicesGlobais.jsx";
import StatusCotacoes, { resumoCotacoesOk } from "../../ui/StatusCotacoes.jsx";
import Vazio from "../../ui/Vazio.jsx";
import Card from "../../ui/Card.jsx";
import { KpiMini } from "../PainelNovo.jsx";
import Modal from "../../ui/Modal.jsx";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function InvestPainel({
  ativos = [], transacoes = [], categorias = [],
  hidden, onTabChange, onAnalisar,
  onAbrirAnaliseIdv, apiKeys = {},
  proventosRecebidos = {}, patrimonioHistorico = [],
  marketStatus = null, refreshing = false,
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
  // ===== Patrimônio total (valor de mercado em R$) e valor investido =====
  // Converte o lado EUA (US$) pra R$ via dólar ao vivo quando disponível.
  const patrimonio = useMemo(() => {
    const usaBRL = usdRate ? t.valorUSA * usdRate : 0;
    const investUSA = usdRate ? t.custoUSA * usdRate : 0;
    const total = t.valorBR + usaBRL;
    const investido = t.custoBR + investUSA;
    const ganho = total - investido;
    const pct = investido > 0 ? (ganho / investido) * 100 : 0;
    return { total, investido, ganho, pct };
  }, [t, usdRate]);

  // ===== Dividendos/proventos recebidos: total acumulado e últimos 12 meses =====
  // Fonte: aba Proventos (marcados como recebidos). Cada um guarda { dataBaixa, valor }.
  const dividendos = useMemo(() => {
    const vals = Object.values(proventosRecebidos || {});
    const total = vals.reduce((s, r) => s + (Number(r?.valor) || 0), 0);
    const corte = new Date(hoje.getFullYear(), hoje.getMonth() - 11, 1);
    const corteISO = `${corte.getFullYear()}-${String(corte.getMonth() + 1).padStart(2, "0")}-01`;
    const ult12 = vals
      .filter(r => (r?.dataBaixa || "") >= corteISO)
      .reduce((s, r) => s + (Number(r?.valor) || 0), 0);
    return { total, ult12 };
  }, [proventosRecebidos]);

  // Composição do Patrimônio investido (botão ↗ do quadradinho, igual ao Painel).
  const [compAberta, setCompAberta] = useState(false);
  const composicao = useMemo(() => {
    const acc = {};
    for (const a of ativos) {
      const v = Number(a?.qtd) * Number(a?.preco);
      if (!(v > 0)) continue;
      const us = ehUS(a);
      const k = (us ? "us:" : "br:") + (a?.tipo || "outro");
      const o = acc[k] || (acc[k] = { us, label: ASSET_CLASS_LABELS[a?.tipo] || a?.tipo || "Outros", qtd: 0, valor: 0 });
      o.qtd++; o.valor += v;
    }
    const linhas = Object.values(acc).sort((x, y) => (x.us - y.us) || (y.valor - x.valor));
    return { br: linhas.filter(l => !l.us), us: linhas.filter(l => l.us) };
  }, [ativos]);

  // Lucro total = ganho de capital (mercado − investido) + dividendos recebidos.
  const lucroTotal = patrimonio.ganho + dividendos.total;

  // Abre o fluxo de novo aporte: vai pra Carteira (onde o modal vive) e dispara
  // o evento que a tela escuta. Sem ativos, ela abre o "Novo Ativo".
  return (
    <div className="fade-up" style={{ padding: "14px 14px 20px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Header — título à esquerda; índices em selos pequenos à direita */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 500 }}>
            Investimentos · Painel
          </div>
          <h1 style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: T.ink, margin: "2px 0 0 0" }}>
            Painel do <em style={{ color: T.gold }}>Invest.</em>
          </h1>
        </div>
      </div>

      <StatusCotacoes status={marketStatus} soProblema />

      {/* Topo · 4 quadradinhos padrão (mesmo das outras telas) */}
      <section className={"tela-kpis" + (refreshing ? " skel-att" : "")} style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
        <KpiMini icone="💼" label="Patrimônio investido" valor={fmt(patrimonio.total)} oculto={hidden} cor={T.ink}
          onDetalhes={() => setCompAberta(true)} detalhesTitulo="Ver o que está sendo somado no Patrimônio investido"
          sub={`${patrimonio.pct >= 0 ? "+" : ""}${fmtN(patrimonio.pct, 1)}% sobre o investido`} />
        <KpiMini icone="📈" label="Lucro total" valor={fmt(lucroTotal)} oculto={hidden} cor={lucroTotal >= 0 ? T.green : T.red} />
        <KpiMini icone="💰" label="Proventos · 12 meses" valor={fmt(dividendos.ult12)} oculto={hidden} cor={T.green} />
        <KpiMini icone="🧺" label="Posições" valor={String(posicoes.qtd)} cor={T.ink} onClick={() => onTabChange?.("carteira")} />
      </section>

      {compAberta && (
        <Modal title="💼 Patrimônio investido — de onde vem o número" onClose={() => setCompAberta(false)}>
          <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
            Soma do valor de mercado (quantidade × último preço) de cada ativo. O lado EUA entra convertido pelo dólar do dia.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {composicao.br.map(l => (
              <div key={"br" + l.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: T.bgSoft, borderRadius: 12 }}>
                <span style={{ flex: 1, fontSize: 13, color: T.ink }}>🇧🇷 {l.label} <span style={{ color: T.faint, fontSize: 11.5 }}>· {l.qtd} {l.qtd === 1 ? "ativo" : "ativos"}</span></span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(l.valor)}</span>
              </div>
            ))}
            {composicao.us.map(l => (
              <div key={"us" + l.label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: T.bgSoft, borderRadius: 12 }}>
                <span style={{ flex: 1, fontSize: 13, color: T.ink }}>🇺🇸 {l.label} <span style={{ color: T.faint, fontSize: 11.5 }}>· {hidden ? "•••" : fmtUSD(l.valor)}</span></span>
                <span className="num" style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, whiteSpace: "nowrap" }}>
                  {hidden ? "•••" : usdRate ? fmt(l.valor * usdRate) : "sem cotação"}
                </span>
              </div>
            ))}
          </div>
          {composicao.us.length > 0 && (
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 8, paddingLeft: 4 }}>
              {usdRate ? `Dólar usado: ${fmt(usdRate)}.` : "Dólar ainda não carregou — o lado EUA fica fora do total por enquanto."}
            </div>
          )}
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: T.ink }}>Patrimônio investido</span>
              <span className="num" style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>{hidden ? "•••••" : fmt(patrimonio.total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.muted }}>
              <span>Valor investido (custo)</span>
              <span className="num">{hidden ? "•••" : fmt(patrimonio.investido)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: T.muted }}>
              <span>Ganho de capital</span>
              <span className="num" style={{ color: patrimonio.ganho >= 0 ? T.green : T.red }}>{hidden ? "•••" : `${fmt(patrimonio.ganho)} (${patrimonio.pct >= 0 ? "+" : ""}${fmtN(patrimonio.pct, 1)}%)`}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Mercado em letreiro — uma linha rolando, no lugar da Evolução do
          patrimônio (pedido 2026-10-01: o card de evolução era grande demais). */}
      <Card style={{ marginBottom: 12, padding: "2px 0" }}>
        <IndicesGlobais apiKeys={apiKeys} letreiro statusOk={resumoCotacoesOk(marketStatus)} />
      </Card>

      {/* Linha 2 */}
      <section className="ip-mid-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10,
      }}>
        <AlocacaoRoscaCard ativos={ativos} valorBR={t.valorBR} valorUSA={t.valorUSA} usdRate={usdRate} hidden={hidden} />
        <TopAtivosCard items={topAtivos} hidden={hidden} onAnalisar={onAnalisar} onSeeAll={() => onTabChange?.("carteira")} />
      </section>

      {/* Linha 3 */}
      <section className="ip-bot-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10,
      }}>
        <ClassesExpansiveisCard ativos={ativos} hidden={hidden} onAnalisar={onAnalisar} fmtUSD={fmtUSD} />
        <GainersLosersCard topGain={topGain} topLoss={topLoss} hidden={hidden} onAnalisar={onAnalisar} />
      </section>

      {/* Informações & relatórios CVM do ativo selecionado */}
      <section style={{ marginBottom: 16 }}>
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
        .ip-mid-grid > *, .ip-bot-grid > * { min-width: 0; }
        @media (max-width: 768px) {
          .painel-rosca { flex-direction: column; align-items: stretch !important; }
          .painel-rosca > div:first-child { align-self: center; }
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

// Alocação por classe em rosca (tons suaves). Lado EUA entra convertido pelo
// dólar ao vivo; sem cotação ainda, a rosca mostra só o Brasil.
const CORES_CLASSE = ["#4DD9C0", "#e0b45c", "#6f9bd1", "#d97a6c", "#9b8cd6", "#7fbf7f", "#c9a0a0", "#8fb8c9"];
function AlocacaoRoscaCard({ ativos = [], valorBR = 0, valorUSA = 0, usdRate, hidden }) {
  const fatias = useMemo(() => {
    const acc = {};
    for (const a of ativos) {
      const v = Number(a?.qtd) * Number(a?.preco);
      if (!(v > 0)) continue;
      const brl = ehUS(a) ? (usdRate ? v * usdRate : 0) : v;
      if (!brl) continue;
      const tipo = a?.tipo || "outro";
      acc[tipo] = (acc[tipo] || 0) + brl;
    }
    return Object.entries(acc)
      .map(([tipo, valor]) => ({ tipo, nome: ASSET_CLASS_LABELS[tipo] || tipo, valor }))
      .sort((x, y) => y.valor - x.valor);
  }, [ativos, usdRate]);
  const total = fatias.reduce((s, d) => s + d.valor, 0);
  const usaBRL = usdRate ? valorUSA * usdRate : 0;
  const totMoeda = valorBR + usaBRL;
  const pctBR = totMoeda > 0 ? (valorBR / totMoeda) * 100 : 100;
  return (
    <Card>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.ink, marginBottom: 10 }}>Alocação por classe</div>
      {fatias.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>Sem ativos cadastrados.</div>
      ) : (
        <>
          <div className="painel-rosca" style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 150, height: 150, position: "relative", flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={fatias} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={70} paddingAngle={2} stroke="none" isAnimationActive>
                    {fatias.map((_, i) => <Cell key={i} fill={CORES_CLASSE[i % CORES_CLASSE.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
                <div>
                  <div style={{ fontSize: 10, color: T.muted }}>classes</div>
                  <div className="num" style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{fatias.length}</div>
                </div>
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7 }}>
              {fatias.map((d, i) => (
                <div key={d.tipo} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: CORES_CLASSE[i % CORES_CLASSE.length], flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.nome}</span>
                  <span style={{ color: T.faint, fontSize: 11 }}>{fmtN((d.valor / total) * 100, 0)}%</span>
                  <span className="num" style={{ color: T.muted, whiteSpace: "nowrap", minWidth: 72, textAlign: "right" }}>{hidden ? "•••" : fmt(d.valor)}</span>
                </div>
              ))}
            </div>
          </div>
          {valorUSA > 0 && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: T.muted, marginBottom: 6 }}>
                <span>🇧🇷 Brasil {fmtN(pctBR, 0)}%</span>
                <span>🇺🇸 EUA {fmtN(100 - pctBR, 0)}%</span>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", background: T.bgSoft }}>
                <div style={{ width: `${pctBR}%`, background: "#e0b45c" }} />
                <div style={{ width: `${100 - pctBR}%`, background: "#6f9bd1" }} />
              </div>
            </div>
          )}
        </>
      )}
    </Card>
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
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, boxShadow: CARD_SHADOW }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 600 }}>Top 5 Ativos</div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Ver carteira</button>
      </div>
      <div>
        {items.length === 0 ? (
          <Vazio compacto icone="📦" texto="Sem ativos na carteira ainda — cadastre o primeiro na aba Carteira." />
        ) : items.map(({ ativo, rentab }) => {
          const cor = rentab >= 0 ? T.green : T.red;
          const serie = sparks[ativo.ticker || ativo.symbol];
          return (
          <button key={ativo.id} onClick={() => onAnalisar?.(ativo)}
            style={{ width: "100%", background: "transparent", border: "none", padding: "8px 0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 12, background: ASSET_CLASS_COLORS[ativo.tipo] || T.gold, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
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
      m.get(tipo).push({ ativo: a, valor: r.valor, rentab: r.pctGanho, ganho: r.ganho });
    });
    return [...m.entries()]
      .map(([tipo, items]) => ({
        tipo,
        label: ASSET_CLASS_LABELS[tipo] || tipo,
        cor: ASSET_CLASS_COLORS[tipo] || T.gold,
        moedaUS: US.has(tipo),
        items: items.sort((a, b) => b.valor - a.valor),
        total: items.reduce((s, x) => s + (Number(x.valor) || 0), 0),
        ganho: items.reduce((s, x) => s + (Number(x.ganho) || 0), 0),
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
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Classes da Carteira</div>
      {grupos.length === 0 ? (
        <Vazio compacto icone="📦" texto="Sem ativos na carteira ainda — cadastre o primeiro na aba Carteira." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {grupos.map(g => {
            const aberta = abertas.has(g.tipo);
            return (
              <div key={g.tipo} style={{ border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>
                <button onClick={() => toggle(g.tipo)} aria-expanded={aberta}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: aberta ? T.bgSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                  <span style={{ color: aberta ? T.gold : T.muted, fontSize: 11, width: 12, flexShrink: 0, transition: "transform .15s ease", transform: aberta ? "rotate(0deg)" : "rotate(0deg)" }}>{aberta ? "▾" : "▸"}</span>
                  <span style={{ width: 9, height: 9, borderRadius: 8, background: g.cor, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.label}</span>
                  <span style={{ fontSize: 10.5, color: T.muted, flexShrink: 0 }}>{g.items.length} {g.items.length === 1 ? "ativo" : "ativos"}</span>
                  {/* Total da classe pintado pelo RESULTADO do conjunto:
                      verde = ganhando, vermelho = perdendo (pedido 2026-09-14). */}
                  <span className="num" title={hidden ? undefined : `Resultado da classe: ${g.ganho >= 0 ? "+" : "−"}${moeda(g.moedaUS, Math.abs(g.ganho))}`}
                        style={{ fontSize: 12.5, fontWeight: 700, color: g.ganho >= 0 ? T.green : T.red, flexShrink: 0, minWidth: 64, textAlign: "right" }}>
                    {hidden ? "•••" : `${g.ganho >= 0 ? "▲ " : "▼ "}${moeda(g.moedaUS, g.total)}`}
                  </span>
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

function GainersLosersCard({ topGain, topLoss, hidden, onAnalisar }) {
  const altas = (topGain || []).filter(x => x.pct > 0);
  const baixas = (topLoss || []).filter(x => x.pct < 0);
  return (
    <div className="ip-card" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 10, boxShadow: CARD_SHADOW }}>
      <div style={{ fontFamily: T.serif, fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Maiores Variações</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: ".15em", color: T.green, fontWeight: 600, marginBottom: 5 }}>↗ MAIORES ALTAS</div>
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
          <div style={{ fontSize: 10, letterSpacing: ".15em", color: T.red, fontWeight: 600, marginBottom: 5 }}>↘ MAIORES BAIXAS</div>
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
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ width: 40, height: 40, borderRadius: 16, background: `${cor}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
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


