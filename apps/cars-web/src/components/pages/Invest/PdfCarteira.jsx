import React, { useMemo, useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt, todayISO } from "../../../lib/format.js";
import Modal from "../../ui/Modal.jsx";

/**
 * Modal print-friendly: PDF completo da carteira de investimentos.
 *  - Capa: resumo geral
 *  - 1 página por ativo (page-break entre)
 *  - Filtro de quais ativos incluir
 */
export default function PdfCarteira({ ativos = [], proventos = [], operacoes = [], onClose, initialSelectedId = null }) {
  // Se vier `initialSelectedId`, só esse ativo começa marcado (impressão
  // individual a partir da página de Investimentos). Senão, todos.
  const [selecionados, setSelecionados] = useState(() => {
    const m = {};
    if (initialSelectedId) {
      ativos.forEach(a => { m[a.id] = a.id === initialSelectedId; });
    } else {
      ativos.forEach(a => { m[a.id] = true; });
    }
    return m;
  });

  const ativosFiltrados = useMemo(
    () => ativos.filter(a => selecionados[a.id]),
    [ativos, selecionados]
  );

  // ===== Cálculos da capa =====
  const resumo = useMemo(() => {
    const totalInvestido = ativosFiltrados.reduce(
      (s, a) => s + (Number(a.qtd) || 0) * Number(a.pm ?? a.precoMedio ?? a.preco ?? 0), 0
    );
    const valorAtual = ativosFiltrados.reduce(
      (s, a) => s + (Number(a.qtd) || 0) * (Number(a.preco) || 0), 0
    );
    const resultado = valorAtual - totalInvestido;
    const resultadoPct = totalInvestido > 0 ? (resultado / totalInvestido) * 100 : 0;

    // % por classe
    const porClasse = {};
    ativosFiltrados.forEach(a => {
      const tipo = (a.tipo || "outro").toUpperCase();
      const v = (Number(a.qtd) || 0) * (Number(a.preco) || 0);
      porClasse[tipo] = (porClasse[tipo] || 0) + v;
    });
    const classeRows = Object.entries(porClasse)
      .map(([k, v]) => ({ classe: k, valor: v, pct: valorAtual > 0 ? (v / valorAtual) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor);

    // Proventos 12m
    const proventos12m = (proventos || []).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);

    return { totalInvestido, valorAtual, resultado, resultadoPct, classeRows, proventos12m };
  }, [ativosFiltrados, proventos]);

  const toggle = (id) => setSelecionados(s => ({ ...s, [id]: !s[id] }));
  const toggleAll = (val) => {
    const m = {};
    ativos.forEach(a => { m[a.id] = val; });
    setSelecionados(m);
  };

  const proventosDoAtivo = (a) => {
    return (proventos || []).filter(p =>
      (p.ticker && p.ticker === a.ticker) || (p.ativoId && p.ativoId === a.id)
    );
  };
  const operacoesDoAtivo = (a) => {
    return (operacoes || []).filter(op =>
      (op.ticker && op.ticker === a.ticker) || (op.ativoId && op.ativoId === a.id)
    );
  };

  return (
    <Modal title="📄 Exportar PDF da carteira" onClose={onClose} wide>
      {/* Filtros (não imprime) */}
      <div className="no-print" style={{
        display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12,
      }}>
        <span style={{ fontSize: 12, color: T.muted }}>
          {ativosFiltrados.length} de {ativos.length} ativos selecionados
        </span>
        <button onClick={() => toggleAll(true)} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}>
          Selecionar todos
        </button>
        <button onClick={() => toggleAll(false)} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 11 }}>
          Desmarcar todos
        </button>
        <button onClick={() => window.print()} className="btn-gold" style={{ marginLeft: "auto" }}>
          🖨️ Imprimir / PDF
        </button>
      </div>

      <div className="no-print" style={{
        maxHeight: 140, overflowY: "auto", padding: 8,
        background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6,
        marginBottom: 16, fontSize: 12,
      }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {ativos.map(a => (
            <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={!!selecionados[a.id]} onChange={() => toggle(a.id)}
                     style={{ accentColor: T.gold }} />
              <span style={{ color: T.ink }}>{a.ticker || a.nome}</span>
              <span style={{ color: T.faint, fontSize: 10 }}>· {a.tipo || "—"}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ===== Área de impressão ===== */}
      <div className="print-area" style={{ background: "#fff", color: "#111", padding: 24, borderRadius: 6 }}>
        {/* CAPA */}
        <div style={{ minHeight: 600, paddingBottom: 30 }}>
          <div style={{ borderBottom: "3px solid #c9a574", paddingBottom: 16, marginBottom: 24 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0, color: "#222" }}>
              Carteira de Investimentos
            </h1>
            <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
              Afinanças · Relatório completo · {todayISO()}
            </div>
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>Resumo geral</h2>
          <table style={{ width: "100%", fontSize: 13, marginBottom: 24 }}>
            <tbody>
              <tr style={rowSep}>
                <td style={cell}>Total investido (custo)</td>
                <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(resumo.totalInvestido)}</td>
              </tr>
              <tr style={rowSep}>
                <td style={cell}>Valor atual de mercado</td>
                <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(resumo.valorAtual)}</td>
              </tr>
              <tr style={rowSep}>
                <td style={cell}>Resultado (R$)</td>
                <td style={{
                  ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums",
                  color: resumo.resultado >= 0 ? "#0a7c2c" : "#b00020", fontWeight: 700,
                }}>
                  {resumo.resultado >= 0 ? "+ " : "− "}{fmt(Math.abs(resumo.resultado))}
                </td>
              </tr>
              <tr style={rowSep}>
                <td style={cell}>Resultado (%)</td>
                <td style={{
                  ...cell, textAlign: "right",
                  color: resumo.resultadoPct >= 0 ? "#0a7c2c" : "#b00020", fontWeight: 700,
                }}>
                  {resumo.resultadoPct.toFixed(2)}%
                </td>
              </tr>
              <tr style={rowSep}>
                <td style={cell}>Proventos recebidos (12m)</td>
                <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(resumo.proventos12m)}</td>
              </tr>
            </tbody>
          </table>

          <h2 style={{ fontSize: 16, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>Composição por classe</h2>
          <table style={{ width: "100%", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f3f3f3" }}>
                <th style={th}>Classe</th>
                <th style={{ ...th, textAlign: "right" }}>Valor</th>
                <th style={{ ...th, textAlign: "right" }}>%</th>
              </tr>
            </thead>
            <tbody>
              {resumo.classeRows.map(row => (
                <tr key={row.classe} style={rowSep}>
                  <td style={cell}>{row.classe}</td>
                  <td style={{ ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(row.valor)}</td>
                  <td style={{ ...cell, textAlign: "right" }}>{row.pct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 32, fontSize: 11, color: "#888", textAlign: "center" }}>
            — {ativosFiltrados.length} ativos detalhados nas próximas páginas —
          </div>
        </div>

        {/* UMA PÁGINA POR ATIVO */}
        {ativosFiltrados.map((a, idx) => {
          const qtd = Number(a.qtd) || 0;
          const pm = Number(a.pm ?? a.precoMedio ?? a.preco ?? 0);
          const preco = Number(a.preco) || 0;
          const valorMercado = qtd * preco;
          const investido = qtd * pm;
          const result = valorMercado - investido;
          const resultPct = investido > 0 ? (result / investido) * 100 : 0;

          const provs = proventosDoAtivo(a);
          const dividendos = provs.filter(p => /divid/i.test(p.tipo || p.categoria || "")).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
          const jcp = provs.filter(p => /jcp|juros/i.test(p.tipo || p.categoria || "")).reduce((s, p) => s + (parseFloat(p.valor) || 0), 0);
          const provTotal = dividendos + jcp;
          const yieldOnCost = investido > 0 ? (provTotal / investido) * 100 : 0;
          const dy12m = valorMercado > 0 ? (provTotal / valorMercado) * 100 : 0;

          const ops = operacoesDoAtivo(a);

          return (
            <div key={a.id} className="pdf-page-break" style={{ paddingTop: 24, paddingBottom: 30, minHeight: 600 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between",
                            borderBottom: "2px solid #c9a574", paddingBottom: 8, marginBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>
                  {a.ticker || a.nome}
                </h2>
                <div style={{ fontSize: 11, color: "#666" }}>
                  Página {idx + 2} de {ativosFiltrados.length + 1}
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>
                {a.nome && a.ticker ? a.nome + " · " : ""}{a.tipo || "—"}
              </div>

              <h3 style={subHead}>Posição</h3>
              <table style={{ width: "100%", fontSize: 12 }}>
                <tbody>
                  <tr style={rowSep}><td style={cell}>Quantidade</td><td style={cellRight}>{qtd}</td></tr>
                  <tr style={rowSep}><td style={cell}>Preço médio (PM)</td><td style={cellRight}>{fmt(pm)}</td></tr>
                  <tr style={rowSep}><td style={cell}>Preço atual</td><td style={cellRight}>{fmt(preco)}</td></tr>
                  <tr style={rowSep}><td style={cell}>Valor de mercado</td><td style={cellRight}>{fmt(valorMercado)}</td></tr>
                  <tr style={rowSep}><td style={cell}>Investido</td><td style={cellRight}>{fmt(investido)}</td></tr>
                </tbody>
              </table>

              <h3 style={subHead}>Resultado</h3>
              <table style={{ width: "100%", fontSize: 12 }}>
                <tbody>
                  <tr style={rowSep}>
                    <td style={cell}>R$</td>
                    <td style={{ ...cellRight, color: result >= 0 ? "#0a7c2c" : "#b00020", fontWeight: 600 }}>
                      {result >= 0 ? "+ " : "− "}{fmt(Math.abs(result))}
                    </td>
                  </tr>
                  <tr style={rowSep}>
                    <td style={cell}>%</td>
                    <td style={{ ...cellRight, color: resultPct >= 0 ? "#0a7c2c" : "#b00020", fontWeight: 600 }}>
                      {resultPct.toFixed(2)}%
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3 style={subHead}>Proventos (12 meses)</h3>
              <table style={{ width: "100%", fontSize: 12 }}>
                <tbody>
                  <tr style={rowSep}><td style={cell}>Dividendos</td><td style={cellRight}>{fmt(dividendos)}</td></tr>
                  <tr style={rowSep}><td style={cell}>JCP / Juros</td><td style={cellRight}>{fmt(jcp)}</td></tr>
                  <tr style={rowSep}><td style={{ ...cell, fontWeight: 600 }}>Total</td><td style={{ ...cellRight, fontWeight: 600 }}>{fmt(provTotal)}</td></tr>
                  <tr style={rowSep}><td style={cell}>Yield on Cost</td><td style={cellRight}>{yieldOnCost.toFixed(2)}%</td></tr>
                  <tr style={rowSep}><td style={cell}>Dividend Yield 12m</td><td style={cellRight}>{dy12m.toFixed(2)}%</td></tr>
                </tbody>
              </table>

              <h3 style={subHead}>Histórico de operações</h3>
              {ops.length === 0 ? (
                <div style={{ fontSize: 11, color: "#888", fontStyle: "italic" }}>
                  Sem operações registradas para este ativo.
                </div>
              ) : (
                <table style={{ width: "100%", fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: "#f3f3f3" }}>
                      <th style={th}>Data</th>
                      <th style={th}>Tipo</th>
                      <th style={{ ...th, textAlign: "right" }}>Qtd</th>
                      <th style={{ ...th, textAlign: "right" }}>Preço</th>
                      <th style={{ ...th, textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.map(op => (
                      <tr key={op.id} style={rowSep}>
                        <td style={cell}>{op.data}</td>
                        <td style={cell}>{op.tipo}</td>
                        <td style={cellRight}>{op.qtd}</td>
                        <td style={cellRight}>{fmt(parseFloat(op.preco) || 0)}</td>
                        <td style={cellRight}>{fmt((parseFloat(op.preco) || 0) * (parseFloat(op.qtd) || 0))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

const cell = { padding: "5px 8px", verticalAlign: "top" };
const cellRight = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const rowSep = { borderBottom: "1px solid #eee" };
const th = { padding: "6px 8px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid #999", fontSize: 11 };
const subHead = { fontSize: 13, fontWeight: 700, marginTop: 18, marginBottom: 6, color: "#222" };
