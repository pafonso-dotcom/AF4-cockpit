import React, { useMemo, useState } from "react";
import { Activity, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "../../../lib/invest-constants.js";
import { calcCarteiraSaude } from "../../../lib/invest-utils.js";
import AlocacaoPieChart from "../../ui/AlocacaoPieChart.jsx";

/**
 * Painel de saúde da carteira — bloco de topo na página de Investimentos.
 *
 * 3 elementos:
 *  1. Score 0-100 agregando: diversificação (Herfindahl) + % no lucro +
 *     quantidade de ativos. Quanto maior melhor.
 *  2. Pie chart de alocação por classe (toggle pra ver por segmento).
 *  3. Insight contextual: alerta de concentração, maior queda hoje, etc.
 *
 * Tudo computado client-side com dados que já existem (sem API extra).
 */

const CORES_SEG = ["#22c55e","#3b82f6","#f59e0b","#ef4444","#a855f7","#06b6d4","#ec4899","#84cc16","#6b7280","#14b8a6","#fbbf24","#0ea5e9"];

export default function CarteiraSaude({ ativos = [], hidden }) {
  const [agruparPor, setAgruparPor] = useState("classe"); // "classe" | "segmento"

  const stats = useMemo(() => {
    const ativosValidos = (ativos || []).filter(a => {
      const v = Number(a.qtd || 0) * Number(a.preco || 0);
      return v > 0;
    });
    if (ativosValidos.length === 0) {
      return { vazia: true };
    }

    const base = calcCarteiraSaude(ativosValidos);
    if (base.total <= 0) {
      return { vazia: true };
    }

    // Alocação por chave (classe ou segmento) — agrupamento é apresentação
    const porChave = {};
    ativosValidos.forEach(a => {
      const valor = Number(a.qtd || 0) * Number(a.preco || 0);
      const k = agruparPor === "classe"
        ? (a.tipo || "outro")
        : ((a.segmento && String(a.segmento).trim()) || "Sem segmento");
      porChave[k] = (porChave[k] || 0) + valor;
    });
    const pieData = Object.entries(porChave)
      .map(([k, v], i) => ({
        nome: agruparPor === "classe" ? (ASSET_CLASS_LABELS[k] || k) : k,
        valor: v,
        pct: (v / base.total) * 100,
        cor: agruparPor === "classe"
          ? (ASSET_CLASS_COLORS[k] || "#9ca3af")
          : CORES_SEG[i % CORES_SEG.length],
      }))
      .sort((a, b) => b.valor - a.valor);

    // Maior posição (% do total)
    const maiorPosicao = pieData[0] || { nome: "—", pct: 0 };

    // Ativos com maior queda 24h (pra insight)
    const comQueda = ativosValidos
      .filter(a => Number.isFinite(Number(a.variacao24h)) && Number(a.variacao24h) < -5)
      .sort((a, b) => Number(a.variacao24h) - Number(b.variacao24h));

    // Insight prioritário
    let insight = null;
    if (comQueda.length > 0) {
      const top = comQueda.slice(0, 3);
      insight = {
        tipo: "queda",
        titulo: `${comQueda.length} ativo(s) caindo > 5% hoje`,
        detalhe: top.map(a => `${a.ticker} ${Number(a.variacao24h).toFixed(1)}%`).join(" · "),
        cor: T.red,
      };
    } else if (base.herfindahl > 0.30) {
      insight = {
        tipo: "concentracao",
        titulo: `Carteira concentrada`,
        detalhe: `${maiorPosicao.nome} representa ${maiorPosicao.pct.toFixed(1)}% do patrimônio. Considere diversificar.`,
        cor: T.gold,
      };
    } else if (base.pctLucro >= 70) {
      insight = {
        tipo: "lucro",
        titulo: `Carteira saudável`,
        detalhe: `${base.noLucro} de ${base.totalAtivos} ativos no lucro. Performance positiva.`,
        cor: T.green,
      };
    } else if (base.pctLucro <= 30) {
      insight = {
        tipo: "perda",
        titulo: `Maioria no prejuízo`,
        detalhe: `Só ${base.noLucro} de ${base.totalAtivos} ativos no lucro. Reveja a tese.`,
        cor: T.red,
      };
    } else {
      insight = {
        tipo: "neutro",
        titulo: `Carteira equilibrada`,
        detalhe: `${base.noLucro} no lucro · ${base.totalAtivos - base.noLucro} em prejuízo · diversificação OK.`,
        cor: T.muted,
      };
    }

    return {
      vazia: false,
      total: base.total,
      pieData,
      herfindahl: base.herfindahl,
      maiorPosicao,
      pctLucro: base.pctLucro,
      noLucro: base.noLucro,
      totalAtivos: base.totalAtivos,
      score: base.score,
      insight,
    };
  }, [ativos, agruparPor]);

  if (stats.vazia) return null;

  const scoreCor = stats.score >= 70 ? T.green : stats.score >= 50 ? T.gold : T.red;
  const scoreLabel = stats.score >= 80 ? "Excelente"
                   : stats.score >= 65 ? "Boa"
                   : stats.score >= 50 ? "Razoável"
                   : "Atenção";

  return (
    <div className="no-print invest-saude-grid" style={{
      display: "grid",
      gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1.2fr) minmax(220px, 1fr)",
      gap: 12,
      marginBottom: 18,
    }}>
      {/* SCORE */}
      <div style={cardStyle(T)}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>Saúde da carteira</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div style={{
            fontFamily: T.serif, fontSize: 44, fontWeight: 600,
            color: scoreCor, lineHeight: 1, fontVariantNumeric: "tabular-nums",
          }}>
            {stats.score}
          </div>
          <div style={{ fontSize: 13, color: T.muted }}>/ 100</div>
        </div>
        <div style={{ fontSize: 11, color: scoreCor, fontWeight: 600, letterSpacing: ".05em",
                       textTransform: "uppercase", marginTop: 4 }}>
          {scoreLabel}
        </div>

        {/* Mini metricas que compõem o score */}
        <div style={{ marginTop: 14, display: "grid", gap: 6, fontSize: 11, color: T.muted }}>
          <Row label="Ativos" value={stats.totalAtivos} />
          <Row label="No lucro" value={`${stats.noLucro} (${stats.pctLucro.toFixed(0)}%)`} />
          <Row label="Diversificação" value={
            stats.herfindahl < 0.15 ? "Ótima" :
            stats.herfindahl < 0.25 ? "Boa" :
            stats.herfindahl < 0.40 ? "Razoável" : "Concentrada"
          } />
          <Row label="Patrimônio" value={hidden ? "•••••" : fmt(stats.total)} />
        </div>
      </div>

      {/* PIE: ALOCAÇÃO */}
      <div style={cardStyle(T)}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div className="label-eyebrow">Alocação</div>
          <div style={{ display: "inline-flex", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 5, padding: 2 }}>
            {[{ id: "classe", l: "Classe" }, { id: "segmento", l: "Segmento" }].map(o => (
              <button key={o.id} onClick={() => setAgruparPor(o.id)}
                style={{
                  padding: "3px 9px", fontSize: 9.5, letterSpacing: ".05em", textTransform: "uppercase",
                  fontWeight: 600, border: "none", borderRadius: 3, cursor: "pointer",
                  background: agruparPor === o.id ? T.gold : "transparent",
                  color: agruparPor === o.id ? T.bg : T.muted,
                }}>
                {o.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10, alignItems: "center" }}>
          <div style={{ width: 120, height: 120 }}>
            <AlocacaoPieChart data={stats.pieData} hidden={hidden} innerRadius={32} outerRadius={56} height={120} />
          </div>
          <div style={{ display: "grid", gap: 4, fontSize: 11, overflow: "auto", maxHeight: 130 }}>
            {stats.pieData.slice(0, 6).map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: p.cor, flexShrink: 0 }} />
                <span style={{ color: T.ink, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</span>
                <span style={{ color: T.muted, fontVariantNumeric: "tabular-nums" }}>{p.pct.toFixed(1)}%</span>
              </div>
            ))}
            {stats.pieData.length > 6 && (
              <div style={{ color: T.faint, fontSize: 10 }}>+ {stats.pieData.length - 6} outros</div>
            )}
          </div>
        </div>
      </div>

      {/* INSIGHT */}
      <div style={{ ...cardStyle(T), borderLeft: `3px solid ${stats.insight.cor}` }}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>Insight</div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: stats.insight.cor, flexShrink: 0, marginTop: 2 }}>
            {stats.insight.tipo === "queda" ? <TrendingDown size={18} />
              : stats.insight.tipo === "lucro" ? <TrendingUp size={18} />
              : stats.insight.tipo === "concentracao" ? <AlertCircle size={18} />
              : <Activity size={18} />}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: stats.insight.cor, fontWeight: 600 }}>
              {stats.insight.titulo}
            </div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4, lineHeight: 1.45 }}>
              {stats.insight.detalhe}
            </div>
          </div>
        </div>
      </div>

      {/* Stack vertical em mobile via style global escopado */}
      <style>{`
        @media (max-width: 768px) {
          .invest-saude-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

const cardStyle = (T) => ({
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 8,
  padding: 14,
});

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}:</span>
      <span style={{ color: "var(--tx)", fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
