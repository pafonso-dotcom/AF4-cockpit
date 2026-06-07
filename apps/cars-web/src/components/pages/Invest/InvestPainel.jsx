import React, { useMemo } from "react";
import { Briefcase, Wallet, TrendingUp, TrendingDown, ArrowRight, Sparkles, BarChart3, DollarSign, Award } from "lucide-react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN } from "../../../lib/format.js";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS, PROVENTO_REGEX } from "../../../lib/invest-constants.js";
import { calcAlocacaoPorClasse, calcRentabilidadeAtivo } from "../../../lib/invest-utils.js";
import IndicesGlobais from "../IndicesGlobais.jsx";

const MESES_PT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];

export default function InvestPainel({
  ativos = [], transacoes = [], categorias = [],
  hidden, onTabChange, onAnalisar,
  onAbrirAnaliseCarteira, onAbrirAnaliseIdv, apiKeys = {},
}) {
  const mask = (s) => hidden ? "•••••" : s;
  const hoje = new Date();

  // ===== Totais (custo, valor, resultado, %) =====
  const t = useMemo(() => {
    let custo = 0, valor = 0;
    ativos.forEach(a => {
      const qtd = Number(a.qtd || 0);
      custo += qtd * Number(a.pm ?? a.precoMedio ?? 0);
      valor += qtd * Number(a.preco || 0);
    });
    const resultado = valor - custo;
    const pct = custo > 0 ? (resultado / custo) * 100 : 0;
    return { custo, valor, resultado, pct };
  }, [ativos]);

  // ===== Posições / classes únicas =====
  const posicoes = useMemo(() => ({
    qtd: ativos.length,
    classes: new Set(ativos.map(a => a.tipo)).size,
  }), [ativos]);

  // ===== Alocação por classe (donut) =====
  const alocacao = useMemo(() => calcAlocacaoPorClasse(ativos), [ativos]);

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

  // ===== Proventos do mês + série 12m =====
  const ehProvento = (tx) => tx?.tipo === "receita" && (PROVENTO_REGEX.test(tx.categoria || "") || PROVENTO_REGEX.test(tx.descricao || ""));
  const proventosMes = useMemo(() => {
    const mesISO = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,"0")}`;
    return transacoes
      .filter(tx => ehProvento(tx) && (tx.data || "").startsWith(mesISO))
      .reduce((s, tx) => s + Number(tx.valor || 0), 0);
  }, [transacoes]);

  const proventos12m = useMemo(() => {
    const arr = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - (11 - i), 1);
      return {
        mes: MESES_PT[d.getMonth()],
        iso: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`,
        total: 0,
      };
    });
    transacoes.forEach(tx => {
      if (!ehProvento(tx)) return;
      const slot = arr.find(s => (tx.data || "").startsWith(s.iso));
      if (slot) slot.total += Number(tx.valor || 0);
    });
    return arr;
  }, [transacoes]);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, fontWeight: 500 }}>
          Investimentos · Painel
        </div>
        <h1 style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 600, color: T.ink, margin: "4px 0 0 0" }}>
          Sua carteira, <em style={{ color: T.gold }}>com clareza.</em>
        </h1>
      </div>

      {/* Índices globais ao vivo */}
      <IndicesGlobais apiKeys={apiKeys} />

      {/* KPIs */}
      <section className="ip-kpi-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 12, marginBottom: 16,
      }}>
        <KpiHero label="Patrimônio Investido" valor={t.valor} pct={t.pct} hidden={hidden} />
        <Kpi label="Custo Investido" valor={mask(fmt(t.custo))} sub="Total aportado" icon={Wallet} cor={T.muted} />
        <Kpi label="Resultado" valor={mask(fmt(t.resultado))} variation={t.pct} cor={t.resultado >= 0 ? T.green : T.red}
             icon={t.resultado >= 0 ? TrendingUp : TrendingDown} />
        <Kpi label="Proventos · mês" valor={mask(fmt(proventosMes))} sub="Receita passiva" icon={DollarSign} cor={T.green} />
        <Kpi label="Posições" valor={String(posicoes.qtd)} sub={`${posicoes.classes} classes`} icon={Briefcase} cor={T.gold} />
      </section>

      {/* Linha 2 */}
      <section className="ip-mid-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <AlocacaoCard data={alocacao} total={t.valor} hidden={hidden} />
        <TopAtivosCard items={topAtivos} hidden={hidden} onAnalisar={onAnalisar} onSeeAll={() => onTabChange?.("carteira")} />
      </section>

      {/* Linha 3 */}
      <section className="ip-bot-grid" style={{
        display: "grid", gridTemplateColumns: "1fr 1.2fr 1fr", gap: 12, marginBottom: 16,
      }}>
        <ValorPorClasseCard data={alocacao} hidden={hidden} />
        <ProventosMesesCard data={proventos12m} hidden={hidden} />
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
        @media (max-width: 1024px) {
          .ip-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .ip-mid-grid, .ip-bot-grid, .ip-foot-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 380px) {
          .ip-kpi-grid { grid-template-columns: 1fr !important; gap: 8px !important; }
        }
      `}</style>
    </div>
  );
}

/* ============================================================
   Sub-componentes
   ============================================================ */

function KpiHero({ label, valor, pct, hidden }) {
  const bg = "linear-gradient(135deg, #0d2818 0%, #1a3a26 100%)";
  return (
    <div style={{ background: bg, color: "#fff", borderRadius: 12, padding: 14, minHeight: 110 }}>
      <div style={{ fontSize: 11, color: "#86efac" }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 600, marginTop: 6 }}>
        {hidden ? "•••••" : fmt(valor)}
      </div>
      <div style={{ fontSize: 11, color: pct >= 0 ? "#86efac" : "#fca5a5", marginTop: 4 }}>
        {pct >= 0 ? "↗" : "↘"} {fmtN(pct, 2)}%
        <span style={{ color: "rgba(255,255,255,0.55)", marginLeft: 4 }}>rentabilidade total</span>
      </div>
    </div>
  );
}

function Kpi({ label, valor, sub, variation, icon: Icon, cor }) {
  const num = typeof variation === "number" ? variation : null;
  const varStr = num != null ? (num >= 0 ? "↗ +" : "↘ ") + fmtN(num, 2) + "%" : null;
  const positive = num != null && num >= 0;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, minHeight: 110, position: "relative", boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)" }}>
      <div style={{ fontSize: 11, color: T.muted }}>{label}</div>
      <div className="num" style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, marginTop: 6, color: T.ink }}>{valor}</div>
      {varStr && <div style={{ fontSize: 11, color: positive ? T.green : T.red, marginTop: 4 }}>{varStr}</div>}
      {sub && <div style={{ fontSize: 10, color: T.muted, marginTop: 2 }}>{sub}</div>}
      {Icon && (
        <div style={{ position: "absolute", top: 14, right: 14, width: 32, height: 32, borderRadius: "50%", background: `${cor || T.gold}1f`, display: "grid", placeItems: "center" }}>
          <Icon size={16} style={{ color: cor || T.gold }} />
        </div>
      )}
    </div>
  );
}

function AlocacaoCard({ data, total, hidden }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)" }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Alocação por Classe</div>
      {data.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>Sem ativos cadastrados.</div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
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
          <div style={{ flex: 1, minWidth: 0, fontSize: 11, display: "flex", flexDirection: "column", gap: 5 }}>
            {data.map((d,i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.cor, flexShrink: 0 }} />
                <span style={{ flex: 1, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.label}</span>
                <span style={{ color: T.ink }}>{fmtN(d.pct, 0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TopAtivosCard({ items, hidden, onAnalisar, onSeeAll }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600 }}>Top 5 Ativos</div>
        <button onClick={onSeeAll} style={{ background: "transparent", border: "none", color: T.green, fontSize: 11, cursor: "pointer" }}>Ver carteira</button>
      </div>
      <div>
        {items.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>Sem ativos.</div>
        ) : items.map(({ ativo, valor, rentab }) => (
          <button key={ativo.id} onClick={() => onAnalisar?.(ativo)}
            style={{ width: "100%", background: "transparent", border: "none", padding: "8px 0", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", textAlign: "left", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, background: ASSET_CLASS_COLORS[ativo.tipo] || T.gold, display: "grid", placeItems: "center", color: "#fff", fontWeight: 700, fontSize: 10, flexShrink: 0 }}>
              {String(ativo.ticker || "?").slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ativo.ticker}</div>
              <div style={{ fontSize: 10, color: T.muted }}>{ASSET_CLASS_LABELS[ativo.tipo] || ativo.tipo}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="num" style={{ fontSize: 12, color: T.ink, whiteSpace: "nowrap" }}>{hidden ? "•••" : fmt(valor)}</div>
              <div className="num" style={{ fontSize: 10, color: rentab >= 0 ? T.green : T.red }}>{rentab >= 0 ? "+" : ""}{fmtN(rentab, 1)}%</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SinaisCTA({ onClick }) {
  const bg = "linear-gradient(135deg, #0d2818 0%, #1a3a26 100%)";
  return (
    <div style={{ background: bg, color: "#fff", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>🤖 Análise da Carteira</div>
      <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5, marginBottom: 14, color: "rgba(255,255,255,0.85)" }}>
        Varredura técnica completa — RSI, MACD, tendência e score 0-100 para cada ativo da carteira. Sinais de compra, venda e neutro em uma única tela.
      </div>
      <button onClick={onClick}
              style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", padding: "8px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer", alignSelf: "flex-start" }}>
        Abrir análise →
      </button>
    </div>
  );
}

function ValorPorClasseCard({ data, hidden }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)" }}>
      <div style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Valor por Classe</div>
      {data.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 12 }}>Sem ativos.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.map((d,i) => (
            <div key={i}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: T.ink, fontWeight: 600 }}>{d.label}</span>
                <span className="num" style={{ color: T.muted }}>{hidden ? "•••" : fmt(d.valor)} · {fmtN(d.pct, 1)}%</span>
              </div>
              <div style={{ height: 6, background: T.border, borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${d.pct}%`, height: "100%", background: d.cor }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProventosMesesCard({ data, hidden }) {
  const total = data.reduce((s,d) => s+d.total, 0);
  const ehVazio = total === 0;
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)" }}>
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
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, boxShadow: "0 1px 2px rgba(16,24,40,.04), 0 1px 3px rgba(16,24,40,.06)" }}>
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
    <button onClick={onClick}
            style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
      <div style={{ width: 40, height: 40, borderRadius: 8, background: `${cor}22`, display: "grid", placeItems: "center", flexShrink: 0 }}>
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
