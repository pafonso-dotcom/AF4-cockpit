import React, { useState, useEffect } from "react";
import { ChevronDown, CalendarDays, Calculator, LineChart } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";
import MapaDividendos from "./MapaDividendos.jsx";
import CalculadoraRenda from "./CalculadoraRenda.jsx";
import Projecao from "./Projecao.jsx";

const KEY = "af4:renda-hub:abertos:v1";
const ler = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '["mapa"]')); } catch { return new Set(["mapa"]); } };

/**
 * Hub "Renda & Dividendos" — junta o Mapa de Dividendos, a Calculadora de Renda
 * e a Projeção num módulo só, em seções recolhíveis (acordeão), pra a tela não
 * ficar gigante. Cada seção abre/fecha independente; o estado fica salvo.
 */
export default function RendaDividendos({ ativos = [], proventosManuais = [], hidden = false, apiKeys = {}, alvoInicial, onConsumirAlvo }) {
  const [abertos, setAbertos] = useState(ler);
  // Veio um "projetar alvo" de outra tela → abre a seção Projeção.
  useEffect(() => { if (alvoInicial) setAbertos((prev) => new Set(prev).add("projecao")); }, [alvoInicial]);

  const toggle = (id) => setAbertos((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...n])); } catch {}
    return n;
  });

  const Secao = ({ id, icon: Icon, titulo, desc, children }) => {
    const on = abertos.has(id);
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
        <button onClick={() => toggle(id)}
          style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                   padding: "14px 16px", background: on ? T.bgSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left", color: T.ink }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <Icon size={17} style={{ color: on ? T.gold : T.muted, flexShrink: 0 }} />
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700, letterSpacing: ".02em", color: on ? T.gold : T.ink }}>{titulo}</span>
              <span style={{ display: "block", fontSize: 11.5, color: T.faint, marginTop: 1 }}>{desc}</span>
            </span>
          </span>
          <ChevronDown size={18} style={{ color: on ? T.gold : T.muted, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s", flexShrink: 0 }} />
        </button>
        {on && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
      </div>
    );
  };

  return (
    <div className="fade-up py-6 px-6">
      <PageHeader
        eyebrow="Investimentos"
        title={<>Renda &amp; <em>Dividendos.</em></>}
        sub="Meta de renda, mapa de proventos, simulador de renda fixa e projeção num lugar só. Abra as seções conforme precisar."
      />
      <div style={{ marginTop: 8 }}>
        <Secao id="mapa" icon={CalendarDays} titulo="Mapa de Dividendos"
               desc="Meta de renda, o que cada ativo paga, comparativo dividendos × renda fixa e projeção de patrimônio.">
          <MapaDividendos ativos={ativos} proventosManuais={proventosManuais} hidden={hidden} embed />
        </Secao>
        <Secao id="calc" icon={Calculator} titulo="Calculadora de Renda"
               desc="Simule quanto um capital em renda fixa rende por mês — bruto, líquido e preservando o patrimônio.">
          <CalculadoraRenda embed />
        </Secao>
        <Secao id="projecao" icon={LineChart} titulo="Projeção"
               desc="Simule a evolução de um ativo (da carteira ou personalizado) com aporte regular.">
          <Projecao ativos={ativos} hidden={hidden} apiKeys={apiKeys} alvoInicial={alvoInicial} onConsumirAlvo={onConsumirAlvo} embed />
        </Secao>
      </div>
    </div>
  );
}
