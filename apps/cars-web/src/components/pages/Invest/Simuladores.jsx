import React, { useState } from "react";
import { ChevronDown, TrendingUp, Calculator } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";
import SimuladorFiiRf from "./SimuladorFiiRf.jsx";
import CalculadoraRenda from "./CalculadoraRenda.jsx";

const KEY = "af4:simuladores:abertos:v1";
const ler = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '["fii-rf"]')); } catch { return new Set(["fii-rf"]); } };

/**
 * Hub "Simuladores" — junta os dois simuladores "e se eu investir?" num módulo
 * só, em seções recolhíveis (acordeão):
 *   • FIIs × Renda Fixa (fase de ACUMULAR — aporte mensal → patrimônio)
 *   • Calculadora de Renda (fase de VIVER da renda — capital pronto → renda/mês)
 * São complementares: um forma o patrimônio, o outro mostra quanto ele rende.
 */
export default function Simuladores() {
  const [abertos, setAbertos] = useState(ler);

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
        title={<>Simuladores.</>}
        sub="Duas contas de investimento num lugar só: quanto você forma aportando todo mês (FIIs × Renda Fixa) e quanto um capital pronto rende por mês. Abra a seção que precisar."
      />
      <div style={{ marginTop: 8 }}>
        <Secao id="fii-rf" icon={TrendingUp} titulo="FIIs × Renda Fixa · aporte mensal"
               desc="Você aporta todo mês por N anos. Compara o patrimônio formado em FIIs vs Renda Fixa, a renda mensal no fim e o efeito da inflação.">
          <SimuladorFiiRf embed />
        </Secao>
        <Secao id="calc" icon={Calculator} titulo="Calculadora de Renda · capital pronto"
               desc="Parte de um capital já formado e mostra quanto rende por mês — bruto, líquido e preservando o patrimônio contra a inflação.">
          <CalculadoraRenda embed />
        </Secao>
      </div>
    </div>
  );
}
