import React, { useState } from "react";
import { TrendingUp, Sparkles, Radar, Calculator } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";

import Performance from "./Performance.jsx";
import AnaliseIdV from "../Trade/AnaliseIdV.jsx";
import AnaliseCarteira from "./AnaliseCarteira.jsx";
import Projecao from "./Projecao.jsx";

const VIEWS = [
  { id: "performance",      label: "Performance",          icon: TrendingUp },
  { id: "idv",              label: "Análise IdV",          icon: Sparkles },
  { id: "carteira-analise", label: "Análise da Carteira",  icon: Radar },
  { id: "projecao",         label: "Projeção",             icon: Calculator },
];

export default function AnalisesUnificada({
  ativos, hidden,
  tradeAnalisesIdV, setTradeAnalisesIdV,
  onAnalisarAtivo,
}) {
  const [view, setView] = useState("performance");

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
        {view === "performance"      && <Performance ativos={ativos} hidden={hidden} />}
        {view === "idv"              && <AnaliseIdV analises={tradeAnalisesIdV} setAnalises={setTradeAnalisesIdV} ativos={ativos} />}
        {view === "carteira-analise" && <AnaliseCarteira ativos={ativos} hidden={hidden} onAnalisar={onAnalisarAtivo} />}
        {view === "projecao"         && <Projecao ativos={ativos} hidden={hidden} />}
      </div>
    </div>
  );
}
