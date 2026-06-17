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
      if (a?.tipo === "capitalSocial") return false; // fora dos cálculos de saúde/alocação
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
    <div className="no-print" style={{ marginBottom: 18 }}>
      {/* SCORE — Saúde da carteira (alocação e insight saíram da carteira) */}
      <div style={cardStyle(T)}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div className="label-eyebrow">Saúde da carteira</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <div style={{ fontFamily: T.serif, fontSize: 32, fontWeight: 600, color: scoreCor, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {stats.score}
            </div>
            <div style={{ fontSize: 12, color: T.muted }}>/ 100</div>
            <div style={{ fontSize: 11, color: scoreCor, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", marginLeft: 4 }}>
              {scoreLabel}
            </div>
          </div>
        </div>

        {/* Mini métricas que compõem o score */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "6px 18px", fontSize: 11, color: T.muted }}>
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
    </div>
  );
}

const cardStyle = (T) => ({
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 14,
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
