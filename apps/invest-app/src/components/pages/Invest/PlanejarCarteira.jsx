import React, { useState, useEffect } from "react";
import { Package, Target, ClipboardList } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";

import MonteSuaCarteira from "./MonteSuaCarteira.jsx";
import ObjetivosCarteira from "./ObjetivosCarteira.jsx";
import CarteiraModelo from "./CarteiraModelo.jsx";

const VIEWS = [
  { id: "monte",     label: "Monte (mix)",        icon: Package },
  { id: "objetivos", label: "Objetivos (árvore)", icon: Target },
  { id: "modelo",    label: "Carteira Modelo",    icon: ClipboardList },
];

/**
 * Hub "Monte sua Carteira" — consolida as 3 abordagens de planejamento de
 * alocação (mix por sliders, árvore de objetivos e carteira-modelo com
 * tickers) numa tela só com abas internas, no mesmo padrão de Análises.
 * As antigas abas "objetivos" e "modelo" viram atalhos pra cá (viewInicial),
 * então links/busca existentes continuam funcionando.
 */
export default function PlanejarCarteira({
  ativos = [], hidden, apiKeys = {},
  objetivosCarteira, setObjetivosCarteira,
  carteirasModeloCustom, setCarteirasModeloCustom,
  modeloAtivoId, setModeloAtivoId,
  viewInicial,
}) {
  const [view, setView] = useState(viewInicial || "monte");

  // Se o tab externo mudar (ex.: Cmd+K → "Carteira Modelo" com o hub já
  // aberto), acompanha; cliques nas abas internas só mexem no estado local.
  useEffect(() => {
    if (viewInicial) setView(viewInicial);
  }, [viewInicial]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Investimentos"
        title="Monte sua Carteira"
        sub="Três jeitos de planejar a mesma alocação — mix por perfil, árvore de objetivos ou carteira-modelo com tickers."
      />

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
        {view === "monte" && <MonteSuaCarteira ativos={ativos} apiKey={apiKeys.anthropic} />}
        {view === "objetivos" && (
          <ObjetivosCarteira
            ativos={ativos}
            objetivosCarteira={objetivosCarteira}
            setObjetivosCarteira={setObjetivosCarteira}
            hidden={hidden}
            apiKeys={apiKeys}
          />
        )}
        {view === "modelo" && (
          <CarteiraModelo
            ativos={ativos}
            carteirasModeloCustom={carteirasModeloCustom}
            setCarteirasModeloCustom={setCarteirasModeloCustom}
            modeloAtivoId={modeloAtivoId}
            setModeloAtivoId={setModeloAtivoId}
            hidden={hidden}
            apiKeys={apiKeys}
          />
        )}
      </div>
    </div>
  );
}
