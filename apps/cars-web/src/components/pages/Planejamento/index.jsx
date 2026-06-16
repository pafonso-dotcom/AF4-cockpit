import React from "react";
import { T } from "../../../lib/theme.js";
import ResumoExecutivo from "./ResumoExecutivo.jsx";
import AReceberEDividas from "../AReceberEDividas.jsx";
import DespesasFixas from "../DespesasFixas.jsx";
import ControleAnual from "../Relatorios/ControleAnual.jsx";

/**
 * Hub de Planejamento — TUDO numa tela só:
 *   1. Informação geral (KPIs) + seletor de mês  → ResumoExecutivo
 *   2. A Receber & Dívidas  +  Despesas Fixas     → lado a lado
 *   3. Controle Anual                             → largura total
 * Os módulos são embutidos (prop `embed`), sem o cabeçalho de página de cada um.
 */
export default function Planejamento(props) {
  const painel = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 };
  const titulo = (t) => (
    <div style={{
      fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase",
      color: T.muted, fontWeight: 700, marginBottom: 10,
    }}>
      {t}
    </div>
  );

  return (
    <div className="fade-up py-8 px-6">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: ".2em", color: T.faint, textTransform: "uppercase", fontWeight: 600 }}>
          Finanças · Planejamento
        </div>
        <h1 style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 300, letterSpacing: "-.02em", marginTop: 6 }}>
          Centro de <em style={{ color: T.gold, fontStyle: "italic" }}>controle.</em>
        </h1>
      </div>

      {/* 1 · Informação geral (acima da data) + seletor de mês */}
      <ResumoExecutivo {...props} />

      {/* 2 · A Receber & Dívidas + Despesas Fixas lado a lado */}
      <div className="plan-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <div style={painel}>
          {titulo("A Receber & Dívidas")}
          <AReceberEDividas {...props} embed />
        </div>
        <div style={painel}>
          {titulo("Despesas Fixas")}
          <DespesasFixas {...props} embed />
        </div>
      </div>

      {/* 3 · Controle Anual — largura total */}
      <div style={painel}>
        {titulo("Controle Anual")}
        <ControleAnual {...props} embed />
      </div>

      <style>{`@media (max-width: 1024px){ .plan-grid2{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
