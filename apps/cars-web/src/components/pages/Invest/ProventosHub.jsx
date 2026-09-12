import React, { useState, useEffect } from "react";
import { DollarSign, CalendarDays } from "lucide-react";
import { T } from "../../../lib/theme.js";
import Proventos from "./Proventos.jsx";
import RendaDividendos from "./RendaDividendos.jsx";

const VIEWS = [
  { id: "recebidos", label: "Proventos (recebidos)",  icon: DollarSign },
  { id: "renda",     label: "Renda & Dividendos",     icon: CalendarDays },
];

/**
 * Hub "Proventos & Renda" — funde a tela de proventos recebidos com o hub de
 * Renda & Dividendos (mapa/calendário + projeção) numa aba só (fusão da
 * auditoria 2026-09). Abas antigas "mapa-dividendos" e "projecao" viram
 * atalhos pra view "renda". Cada página interna mantém o próprio header.
 */
export default function ProventosHub({ viewInicial, proventosProps = {}, rendaProps = {} }) {
  const [view, setView] = useState(viewInicial || "recebidos");
  useEffect(() => { if (viewInicial) setView(viewInicial); }, [viewInicial]);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", padding: "18px 24px 0" }}>
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
      {view === "recebidos" && <Proventos {...proventosProps} />}
      {view === "renda" && (
        <div className="px-6 md:px-10">
          <RendaDividendos {...rendaProps} />
        </div>
      )}
    </div>
  );
}
