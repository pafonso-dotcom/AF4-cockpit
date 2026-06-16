import React, { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import AReceberEDividas from "../AReceberEDividas.jsx";
import DespesasFixas from "../DespesasFixas.jsx";
import ControleAnual from "../Relatorios/ControleAnual.jsx";

/**
 * Centro de Controle — um RESUMO fixo no topo (totais de A Receber e Fixas,
 * sempre visível) e os módulos OCULTOS: cada seção abre só ao clicar
 * (acordeão, uma por vez), em largura total. Sem "Visão Executiva".
 */
export default function Planejamento(props) {
  const { devedores = [], fixas = [], fixaOcorrencias = [], hidden } = props;
  const [aberto, setAberto] = useState(null); // "areceber" | "fixas" | "anual" | null

  const toggle = (id) => setAberto(prev => (prev === id ? null : id));

  // ===== Resumo fixo (sempre visível) =====
  const resumoReceber = useMemo(() => {
    const abertos = devedores.filter(d => !d.recebido);
    const total = abertos.reduce((s, d) => s + Math.max(0, (Number(d.valor) || 0) - (Number(d.valorRecebido) || 0)), 0);
    return { total, qtd: abertos.length };
  }, [devedores]);

  const resumoFixas = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const existe = (id) => fixas.some(f => f.id === id);
    const occ = fixaOcorrencias.filter(o => o.mes === mes && existe(o.fixaId));
    const total = occ.reduce((s, o) => s + (Number(o.valorPago ?? o.valor) || 0), 0);
    const aPagar = occ.filter(o => o.status !== "paga").length;
    return { total, qtd: occ.length, aPagar };
  }, [fixas, fixaOcorrencias]);

  const ResumoCard = ({ label, valor, sub, cor }) => (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 14px", borderLeft: `3px solid ${cor}` }}>
      <div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: T.faint, fontWeight: 700 }}>{label}</div>
      <div className="num" style={{ fontFamily: T.mono || T.serif, fontSize: 20, fontWeight: 700, color: cor, marginTop: 5, lineHeight: 1.05 }}>
        {hidden ? "•••••" : fmt(valor)}
      </div>
      <div style={{ fontSize: 9.5, color: T.faint, marginTop: 3 }}>{sub}</div>
    </div>
  );

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

      {/* Resumo fixo — sempre visível */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <ResumoCard
          label="A Receber"
          valor={resumoReceber.total}
          cor={T.green}
          sub={`${resumoReceber.qtd} ${resumoReceber.qtd === 1 ? "em aberto" : "em aberto"}`}
        />
        <ResumoCard
          label="Despesas Fixas (mês)"
          valor={resumoFixas.total}
          cor={T.gold}
          sub={`${resumoFixas.aPagar} a pagar de ${resumoFixas.qtd}`}
        />
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
