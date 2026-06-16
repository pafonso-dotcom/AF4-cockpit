import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import AReceberEDividas from "../AReceberEDividas.jsx";
import DespesasFixas from "../DespesasFixas.jsx";
import ControleAnual from "../Relatorios/ControleAnual.jsx";

/**
 * Centro de Controle — os módulos ficam OCULTOS por padrão: cada seção abre
 * só ao clicar (acordeão, uma por vez), em largura total. Sem "Visão Executiva".
 */
export default function Planejamento(props) {
  const [aberto, setAberto] = useState(null); // "areceber" | "fixas" | "anual" | null

  const toggle = (id) => setAberto(prev => (prev === id ? null : id));

  const Secao = ({ id, titulo, children }) => {
    const on = aberto === id;
    return (
      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, marginBottom: 12, overflow: "hidden" }}>
        <button
          onClick={() => toggle(id)}
          style={{
            width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 16px", background: on ? T.bgSoft : "transparent",
            border: "none", cursor: "pointer", color: T.ink, textAlign: "left",
          }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: on ? T.gold : T.ink }}>
            {titulo}
          </span>
          <ChevronDown size={18} style={{ color: on ? T.gold : T.muted, transform: on ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>
        {on && (
          <div style={{ padding: "0 16px 16px", overflowX: "auto" }}>
            {children}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fade-up py-6 px-3 sm:px-6">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: ".2em", color: T.faint, textTransform: "uppercase", fontWeight: 600 }}>
          Finanças
        </div>
        <h1 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 300, letterSpacing: "-.02em", marginTop: 6 }}>
          Centro de <em style={{ color: T.gold, fontStyle: "italic" }}>controle.</em>
        </h1>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 6, fontStyle: "italic" }}>
          Toque numa seção para abrir os detalhes.
        </p>
      </div>

      {/* Módulos ocultos — abrem ao clicar */}
      <div style={{ marginTop: 4 }}>
        <Secao id="areceber" titulo="A Receber & Dívidas">
          <AReceberEDividas {...props} embed />
        </Secao>
        <Secao id="fixas" titulo="Despesas Fixas">
          <DespesasFixas {...props} embed />
        </Secao>
        <Secao id="anual" titulo="Controle Anual">
          <ControleAnual {...props} embed />
        </Secao>
      </div>
    </div>
  );
}
