import React, { useState, useMemo } from "react";
import { ChevronDown } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import AReceberEDividas from "../AReceberEDividas.jsx";
import DespesasFixas from "../DespesasFixas.jsx";
import ControleAnual from "../Relatorios/ControleAnual.jsx";

/**
 * Centro de Controle — cada seção mostra uma VISÃO GERAL simples sempre visível
 * (recebido/pago · pendente · atrasado · total previsto) e o detalhe abre só ao
 * clicar (acordeão, uma seção por vez). Sem "Visão Executiva".
 */
export default function Planejamento(props) {
  const { devedores = [], fixas = [], fixaOcorrencias = [], hidden } = props;
  const [aberto, setAberto] = useState(null); // "areceber" | "fixas" | "anual" | null

  const toggle = (id) => setAberto(prev => (prev === id ? null : id));

  // A Receber: recebido (todos) / pendente (vence no MÊS corrente) / atrasado
  // (todos vencidos) / total previsto (tudo: recebido + tudo em aberto).
  const resumoReceber = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mes = hoje.slice(0, 7);
    let recebido = 0, pendenteMes = 0, atrasado = 0, abertoTotal = 0;
    devedores.forEach(d => {
      const valor = Number(d.valor) || 0;
      const vr = Number(d.valorRecebido) || 0;
      if (d.recebido) { recebido += vr > 0 ? vr : valor; return; }
      recebido += vr; // recebimentos parciais já contam como "recebido"
      const restante = Math.max(0, valor - vr);
      if (restante <= 0) return;
      abertoTotal += restante;
      if (d.vencimento && d.vencimento < hoje) atrasado += restante;
      else if (!d.vencimento || d.vencimento.slice(0, 7) === mes) pendenteMes += restante;
      // vencimentos de meses futuros não entram em "pendente (mês)"
    });
    return { recebido, pendente: pendenteMes, atrasado, total: recebido + abertoTotal };
  }, [devedores]);

  // Despesas Fixas · mês: já pago / pendente / atrasado / total previsto.
  const resumoFixas = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    const mes = hoje.slice(0, 7);
    const existe = (id) => fixas.some(f => f.id === id);
    let pago = 0, pendente = 0, atrasado = 0;
    fixaOcorrencias.forEach(o => {
      if (o.mes !== mes || !existe(o.fixaId)) return;
      if (o.status === "paga") pago += Number(o.valorPago ?? o.valor) || 0;
      else if ((o.dataVencimento || "") < hoje) atrasado += Number(o.valor) || 0;
      else pendente += Number(o.valor) || 0;
    });
    return { pago, pendente, atrasado, total: pago + pendente + atrasado };
  }, [fixas, fixaOcorrencias]);

  // Mini visão geral (4 números) — sempre visível, acima do detalhe da seção.
  const VisaoGeral = ({ legenda, itens }) => (
    <div style={{ borderTop: `1px solid ${T.border}`, padding: "10px 16px 12px" }}>
      <div style={{ fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: T.faint, fontWeight: 700, marginBottom: 8 }}>{legenda}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 8 }}>
        {itens.map(it => (
          <div key={it.lbl} style={{ background: T.bgSoft, borderRadius: 12, padding: "10px 11px", borderLeft: `3px solid ${it.cor}` }}>
            <div style={{ fontSize: 8.5, letterSpacing: ".05em", textTransform: "uppercase", color: T.faint, fontWeight: 700 }}>{it.lbl}</div>
            <div className="num" style={{ fontFamily: T.mono || T.serif, fontSize: 14, fontWeight: 700, color: it.cor, marginTop: 4, whiteSpace: "nowrap" }}>
              {hidden ? "•••" : fmt(it.v)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const Secao = ({ id, titulo, overview, children }) => {
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
        {overview}
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

      {/* Módulos — visão geral sempre visível; detalhe abre ao clicar */}
      <div style={{ marginTop: 4 }}>
        <Secao
          id="areceber"
          titulo="A Receber & Dívidas"
          overview={
            <VisaoGeral
              legenda="Visão geral · todos os meses"
              itens={[
                { lbl: "Recebido", v: resumoReceber.recebido, cor: T.green },
                { lbl: "Pendente (mês)", v: resumoReceber.pendente, cor: T.gold },
                { lbl: "Atrasado", v: resumoReceber.atrasado, cor: T.red },
                { lbl: "Total previsto", v: resumoReceber.total, cor: T.ink },
              ]}
            />
          }
        >
          <AReceberEDividas {...props} embed />
        </Secao>

        <Secao
          id="fixas"
          titulo="Despesas Fixas"
          overview={
            <VisaoGeral
              legenda="Visão geral · mês"
              itens={[
                { lbl: "Já pago", v: resumoFixas.pago, cor: T.green },
                { lbl: "Pendente", v: resumoFixas.pendente, cor: T.gold },
                { lbl: "Atrasado", v: resumoFixas.atrasado, cor: T.red },
                { lbl: "Total previsto", v: resumoFixas.total, cor: T.ink },
              ]}
            />
          }
        >
          <DespesasFixas {...props} embed />
        </Secao>

        <Secao id="anual" titulo="Controle Anual">
          <ControleAnual {...props} embed />
        </Secao>
      </div>
    </div>
  );
}
