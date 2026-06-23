import React, { useMemo } from "react";
import { Brain } from "lucide-react";
import { T } from "../../lib/theme.js";
import PageHeader from "../ui/PageHeader.jsx";
import { calcularScore, gerarInsights, detectarAssinaturas, projetarCashflow } from "../../lib/intelligence.js";
import { escoparFinancas } from "../../lib/inteligenciaPainel.js";
import ScoreCard from "./Inteligencia/ScoreCard.jsx";
import InsightsList from "./Inteligencia/InsightsList.jsx";
import AssinaturasCard from "./Inteligencia/AssinaturasCard.jsx";
import CashflowCard from "./Inteligencia/CashflowCard.jsx";
import IAAnaliseCard from "./Inteligencia/IAAnaliseCard.jsx";
import CarteiraSaude from "./Invest/CarteiraSaude.jsx";

const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };

export default function Inteligencia({
  transacoes = [], contas = [], ativos = [], cartoes = [], parcelamentos = [], metas = [],
  escopoAtivo = "tudo", hidden = false, onTabChange,
}) {
  const fin = useMemo(() => escoparFinancas(transacoes, contas, escopoAtivo), [transacoes, contas, escopoAtivo]);
  const score = useMemo(() => safe(() => calcularScore(fin.transacoes, fin.contas, ativos, cartoes, parcelamentos, metas), null), [fin, ativos, cartoes, parcelamentos, metas]);
  const insights = useMemo(() => safe(() => gerarInsights(fin.transacoes, fin.contas, ativos, cartoes, parcelamentos) || [], []), [fin, ativos, cartoes, parcelamentos]);
  const assinaturas = useMemo(() => safe(() => detectarAssinaturas(fin.transacoes) || [], []), [fin]);
  const projecao = useMemo(() => safe(() => projetarCashflow(fin.transacoes, fin.contas, 3) || [], []), [fin]);

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Inteligência"
        title={<>Painel de <em>Inteligência.</em></>}
        sub="Score, insights, assinaturas e projeção — mais a saúde da carteira. Tudo calculado no seu aparelho."
      />

      <Grupo titulo="Finanças">
        <Secao titulo="Score financeiro"><ScoreCard score={score} hidden={hidden} /></Secao>
        <Secao titulo="Insights"><InsightsList insights={insights} onIr={onTabChange} /></Secao>
        <Secao titulo="Assinaturas detectadas"><AssinaturasCard assinaturas={assinaturas} hidden={hidden} /></Secao>
        <Secao titulo="Projeção de caixa (3 meses)"><CashflowCard projecao={projecao} hidden={hidden} /></Secao>
      </Grupo>

      <Grupo titulo="Investimentos">
        <Secao titulo="Saúde da carteira"><CarteiraSaude ativos={ativos} hidden={hidden} /></Secao>
      </Grupo>

      <Grupo titulo="Inteligência artificial">
        <Secao titulo="Análise com IA"><IAAnaliseCard /></Secao>
      </Grupo>
    </div>
  );
}

function Grupo({ titulo, children }) {
  return (
    <section style={{ marginTop: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Brain size={14} style={{ color: T.gold }} />
        <h2 style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: T.ink }}>{titulo}</h2>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
        {children}
      </div>
    </section>
  );
}

function Secao({ titulo, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, fontWeight: 600 }}>{titulo}</div>
      {children}
    </div>
  );
}
