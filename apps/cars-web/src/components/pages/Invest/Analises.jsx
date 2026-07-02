import React, { useState, useEffect } from "react";
import { TrendingUp, Sparkles, Radar, Award, Stethoscope } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";

import Performance from "./Performance.jsx";
import AnaliseIdV from "../Trade/AnaliseIdV.jsx";
import AnaliseCarteira from "./AnaliseCarteira.jsx";
import FundamentosIA from "./FundamentosIA.jsx";
import DiagnosticoIA from "./DiagnosticoIA.jsx";

const VIEWS = [
  { id: "diagnostico",      label: "Diagnóstico IA",       icon: Stethoscope },
  { id: "performance",      label: "Performance",          icon: TrendingUp },
  { id: "fundamentos",      label: "Fundamentos (IA)",     icon: Award },
  { id: "idv",              label: "Análise IdV",          icon: Sparkles },
  { id: "carteira-analise", label: "Análise da Carteira",  icon: Radar },
];

export default function AnalisesUnificada({
  ativos, hidden,
  tradeAnalisesIdV, setTradeAnalisesIdV,
  onAnalisarAtivo,
  apiKeys = {},
  viewInicial,
  onConsumirViewInicial,
}) {
  const [view, setView] = useState("diagnostico");

  // Quando alguém pede pra abrir numa view específica (ex: InvestPainel
  // → "Análise da Carteira" / "Análise IdV"), troca a view e limpa o
  // sinal pra não voltar quando o user trocar manualmente depois.
  useEffect(() => {
    if (viewInicial) {
      setView(viewInicial);
      onConsumirViewInicial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewInicial]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Investimentos"
        title="Análises"
        sub="Tudo o que importa pra entender e projetar sua carteira num lugar só."
      />

      {/* Inner tabs */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>
        {VIEWS.map(v => {
          const Icon = v.icon;
          const ativo = view === v.id;
          return (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{
                padding: "9px 16px",
                background: ativo ? `${T.gold}22` : T.card,
                border: `1px solid ${ativo ? T.gold : T.border}`,
                color: ativo ? T.gold : T.muted,
                fontSize: 12, fontWeight: 600, borderRadius: 100,
                cursor: "pointer", letterSpacing: ".03em",
                display: "inline-flex", alignItems: "center", gap: 7,
                transition: "all .15s ease",
              }}>
              <Icon size={14} />
              {v.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: -16 /* compensa o py-8 das páginas internas */ }}>
        {view === "diagnostico"      && <DiagnosticoIA ativos={ativos} hidden={hidden} />}
        {view === "performance"      && <Performance ativos={ativos} hidden={hidden} />}
        {view === "fundamentos"      && <div className="py-8"><FundamentosIA ativos={ativos} /></div>}
        {view === "idv"              && <AnaliseIdV analises={tradeAnalisesIdV} setAnalises={setTradeAnalisesIdV} ativos={ativos} />}
        {view === "carteira-analise" && <AnaliseCarteira ativos={ativos} hidden={hidden} onAnalisar={onAnalisarAtivo} />}
      </div>
    </div>
  );
}
