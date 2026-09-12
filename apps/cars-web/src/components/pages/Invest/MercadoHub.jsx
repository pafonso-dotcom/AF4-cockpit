import React, { useState, useEffect } from "react";
import { HandCoins, Radar } from "lucide-react";
import { T } from "../../../lib/theme.js";
import ConstrutorMercado from "../ConstrutorMercado.jsx";
import Screener from "./Screener.jsx";

const VIEWS = [
  { id: "construtor", label: "Construtor de mercado", icon: HandCoins },
  { id: "screener",   label: "Screener",              icon: Radar },
];

/**
 * Hub "Mercado" — funde Construtor de mercado e Screener numa aba só
 * (fusão da auditoria 2026-09). As abas antigas "screener" e
 * "construtor-mercado" viram atalhos pra view interna certa, então links e
 * busca continuam funcionando. Cada página interna mantém o próprio header;
 * aqui ficam só os chips de troca.
 */
export default function MercadoHub({ viewInicial, onIrMonteCarteira, hidden }) {
  const [view, setView] = useState(viewInicial || "construtor");
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
      {view === "construtor" && <ConstrutorMercado onIrMonteCarteira={onIrMonteCarteira} />}
      {view === "screener" && (
        <div className="px-6 md:px-10">
          <Screener hidden={hidden} />
        </div>
      )}
    </div>
  );
}
