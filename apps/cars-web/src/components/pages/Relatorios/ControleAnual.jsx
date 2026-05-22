import React, { useState, useMemo } from "react";
import { Printer, Download, ClipboardCopy, ChevronDown, ChevronUp } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, todayISO } from "../../../lib/format.js";
import PageHeader from "../../ui/PageHeader.jsx";
import { toast } from "../../../lib/toast.js";
import { getAnualPorMes } from "../../../lib/agregador.js";

const MES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const TIPO_COR = {
  fixa:     T.gold,
  variavel: T.muted,
  parcela:  T.blue || "#60a5fa",
  ganho:    T.green,
  divida:   T.red,
};

const TIPO_LABEL = {
  fixa:     "Fixas",
  variavel: "Variáveis",
  parcela:  "Parcelas",
  ganho:    "Ganhos",
};

/**
 * Visão Anual Consolidada — 12 linhas (jan-dez) + total.
 * Colunas: Mês · Fixas · Variáveis · Parcelas · Ganhos · Dívidas pagas · Balanço · Status
 * Clicar numa linha expande detalhes agrupados por tipo.
 */
export default function ControleAnual({
  transacoes = [],
  dividas = [],
  fixaOcorrencias = [],
  fixas = [],
  parcelamentos = [],
  devedores = [],
  hidden,
}) {
  const hoje = todayISO();
  const anoCorrente = parseInt(hoje.slice(0, 4), 10);
  const mesCorrenteIdx = parseInt(hoje.slice(5, 7), 10) - 1;

  const [ano, setAno] = useState(anoCorrente);
  const [mesExpandido, setMesExpandido] = useState(null); // 0-11 ou null

  const state = { transacoes, fixas, fixaOcorrencias, parcelamentos, dividas, devedores };
  const linhas = useMemo(
    () => getAnualPorMes(ano, state),
    [ano, transacoes, fixas, fixaOcorrencias, parcelamentos, dividas, devedores]
  );

  const totais = useMemo(() => {
    return linhas.reduce((acc, l) => ({
      fixas: acc.fixas + l.fixas,
      variaveis: acc.variaveis + l.variaveis,
      parcelas: acc.parcelas + l.parcelas,
      ganhos: acc.ganhos + l.ganhos,
      dividasPagas: acc.dividasPagas + l.dividasPagas,
      balanco: acc.balanco + l.balanco,
    }), { fixas: 0, variaveis: 0, parcelas: 0, ganhos: 0, dividasPagas: 0, balanco: 0 });
  }, [linhas]);

  const maxAbsBalanco = Math.max(1, ...linhas.map(l => Math.abs(l.balanco)));

  // ===== Exportações =====
  const exportarCSV = () => {
    const header = ["Mês", "Fixas", "Variáveis", "Parcelas", "Ganhos", "Dívidas pagas", "Balanço", "Status"];
    const rows = linhas.map(l => [
      `${MES_NOMES[l.m]} ${ano}`,
      l.fixas.toFixed(2).replace(".", ","),
      l.variaveis.toFixed(2).replace(".", ","),
      l.parcelas.toFixed(2).replace(".", ","),
      l.ganhos.toFixed(2).replace(".", ","),
      l.dividasPagas.toFixed(2).replace(".", ","),
      l.balanco.toFixed(2).replace(".", ","),
      l.status,
    ]);
    rows.push([
      `TOTAL ${ano}`,
      totais.fixas.toFixed(2).replace(".", ","),
      totais.variaveis.toFixed(2).replace(".", ","),
      totais.parcelas.toFixed(2).replace(".", ","),
      totais.ganhos.toFixed(2).replace(".", ","),
      totais.dividasPagas.toFixed(2).replace(".", ","),
      totais.balanco.toFixed(2).replace(".", ","),
      "",
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `af4-controle-anual-${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV baixado.");
  };

  const copiarTabela = async () => {
    const header = ["Mês", "Fixas", "Variáveis", "Parcelas", "Ganhos", "Dívidas pagas", "Balanço", "Status"];
    const rows = linhas.map(l => [
      `${MES_NOMES[l.m]} ${ano}`,
      l.fixas.toFixed(2),
      l.variaveis.toFixed(2),
      l.parcelas.toFixed(2),
      l.ganhos.toFixed(2),
      l.dividasPagas.toFixed(2),
      l.balanco.toFixed(2),
      l.status,
    ]);
    rows.push([
      `TOTAL ${ano}`,
      totais.fixas.toFixed(2),
      totais.variaveis.toFixed(2),
      totais.parcelas.toFixed(2),
      totais.ganhos.toFixed(2),
      totais.dividasPagas.toFixed(2),
      totais.balanco.toFixed(2),
      "",
    ]);
    const tsv = [header, ...rows].map(r => r.join("\t")).join("\n");
    try {
      await navigator.clipboard.writeText(tsv);
      toast.success("Tabela copiada — cola no Excel/Sheets.");
    } catch (e) {
      toast.error("Falha ao copiar. Use o CSV.");
    }
  };

  const labelStatus = (s) => s === "fechado" ? "Fechado" : s === "em-andamento" ? "Em andamento" : "Previsto";
  const corStatus = (s) => s === "fechado" ? T.muted : s === "em-andamento" ? T.gold : T.faint;

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Finanças · Relatórios"
        title={<>Controle <em>Anual.</em></>}
        sub="12 meses do ano. Fixas, variáveis, parcelas, ganhos e dívidas pagas — clique numa linha pra ver o detalhe."
        action={
          <div className="flex gap-2 flex-wrap no-print">
            <select value={ano} onChange={e => setAno(parseInt(e.target.value))}
                    style={{ padding: "8px 11px", background: T.bgSoft, border: `1px solid ${T.border}`,
                             color: T.ink, fontSize: 12, borderRadius: 6 }}>
              {[anoCorrente - 2, anoCorrente - 1, anoCorrente, anoCorrente + 1, anoCorrente + 2].map(y =>
                <option key={y} value={y}>{y}</option>
              )}
            </select>
            <button onClick={() => window.print()} className="btn-ghost" title="Imprimir / PDF">
              <Printer size={13} className="inline mr-1.5" /> PDF
            </button>
            <button onClick={exportarCSV} className="btn-ghost" title="Baixar CSV">
              <Download size={13} className="inline mr-1.5" /> CSV
            </button>
            <button onClick={copiarTabela} className="btn-ghost" title="Copiar para Excel/Sheets">
              <ClipboardCopy size={13} className="inline mr-1.5" /> Copiar
            </button>
          </div>
        }
      />

      <div className="print-area" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "auto" }}>
        <table className="tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
          <thead>
            <tr style={{ background: T.bgSoft }}>
              <th style={{ ...th, width: 36 }}></th>
              <th style={th}>Mês</th>
              <th style={{ ...th, textAlign: "right" }}>Fixas</th>
              <th style={{ ...th, textAlign: "right" }}>Variáveis</th>
              <th style={{ ...th, textAlign: "right" }}>Parcelas</th>
              <th style={{ ...th, textAlign: "right" }}>Ganhos</th>
              <th style={{ ...th, textAlign: "right" }}>Dívidas pagas</th>
              <th style={{ ...th, textAlign: "right" }}>Balanço</th>
              <th style={{ ...th, textAlign: "center" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map(l => {
              const isCorrente = ano === anoCorrente && l.m === mesCorrenteIdx;
              const isFuturo = ano > anoCorrente || (ano === anoCorrente && l.m > mesCorrenteIdx);
              const corMes = isFuturo ? T.faint : T.ink;
              const bgRow = isCorrente ? `${T.gold}11` : "transparent";
              const pctBalanco = (l.balanco / maxAbsBalanco) * 100;
              const aberto = mesExpandido === l.m;
              const temDado = (l.fixas + l.variaveis + l.parcelas + l.ganhos + l.dividasPagas) > 0;
              return (
                <React.Fragment key={l.m}>
                  <tr
                    onClick={() => temDado && setMesExpandido(aberto ? null : l.m)}
                    style={{
                      background: bgRow, borderTop: `1px solid ${T.border}`,
                      cursor: temDado ? "pointer" : "default",
                    }}>
                    <td style={{ ...td, textAlign: "center", width: 36 }}>
                      {temDado && (
                        aberto
                          ? <ChevronUp size={14} style={{ color: T.gold }} />
                          : <ChevronDown size={14} style={{ color: T.muted }} />
                      )}
                    </td>
                    <td style={{ ...td, color: corMes, fontWeight: isCorrente ? 600 : 400 }}>
                      {isCorrente && <span style={{ color: T.gold, marginRight: 4 }}>★</span>}
                      {MES_NOMES[l.m]} {ano}
                    </td>
                    <td className="num" style={{ ...td, textAlign: "right", color: corMes }}>
                      {hidden ? "•••" : fmt(l.fixas)}
                    </td>
                    <td className="num" style={{ ...td, textAlign: "right", color: corMes }}>
                      {hidden ? "•••" : fmt(l.variaveis)}
                    </td>
                    <td className="num" style={{ ...td, textAlign: "right", color: l.parcelas > 0 ? TIPO_COR.parcela : corMes }}>
                      {hidden ? "•••" : fmt(l.parcelas)}
                    </td>
                    <td className="num" style={{ ...td, textAlign: "right", color: l.ganhos > 0 ? T.green : corMes }}>
                      {hidden ? "•••" : fmt(l.ganhos)}
                    </td>
                    <td className="num" style={{ ...td, textAlign: "right", color: corMes }}>
                      {hidden ? "•••" : fmt(l.dividasPagas)}
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <div className="num" style={{
                        color: l.balanco >= 0 ? T.green : T.red,
                        fontWeight: 600,
                      }}>
                        {hidden ? "•••" : fmt(l.balanco)}
                      </div>
                      <div style={{
                        height: 3, marginTop: 4, background: T.border, borderRadius: 2,
                        position: "relative", overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%",
                          width: `${Math.abs(pctBalanco)}%`,
                          background: l.balanco >= 0 ? T.green : T.red,
                          marginLeft: l.balanco >= 0 ? "50%" : `${50 - Math.abs(pctBalanco) / 2}%`,
                          opacity: 0.7,
                        }} />
                      </div>
                    </td>
                    <td style={{ ...td, textAlign: "center" }}>
                      <span style={{
                        fontSize: 9.5, padding: "2px 8px", borderRadius: 100,
                        letterSpacing: ".1em", textTransform: "uppercase", fontWeight: 600,
                        color: corStatus(l.status),
                        background: l.status === "em-andamento" ? `${T.gold}22` : "transparent",
                        border: l.status === "em-andamento" ? `1px solid ${T.gold}55` : "none",
                      }}>
                        {labelStatus(l.status)}
                      </span>
                    </td>
                  </tr>

                  {aberto && (
                    <tr style={{ background: T.bgSoft, borderTop: `1px solid ${T.gold}55` }}>
                      <td colSpan={9} style={{ padding: "12px 16px 14px" }}>
                        <DetalhesGrupos linha={l} hidden={hidden} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Totais */}
            <tr style={{ background: T.gold, color: T.bg, borderTop: `2px solid ${T.gold}` }}>
              <td style={{ ...td, textAlign: "center", width: 36 }} />
              <td style={{ ...td, color: T.bg, fontWeight: 700, letterSpacing: ".05em" }}>
                TOTAL {ano}
              </td>
              <td className="num" style={{ ...td, textAlign: "right", color: T.bg, fontWeight: 600 }}>
                {hidden ? "•••" : fmt(totais.fixas)}
              </td>
              <td className="num" style={{ ...td, textAlign: "right", color: T.bg, fontWeight: 600 }}>
                {hidden ? "•••" : fmt(totais.variaveis)}
              </td>
              <td className="num" style={{ ...td, textAlign: "right", color: T.bg, fontWeight: 600 }}>
                {hidden ? "•••" : fmt(totais.parcelas)}
              </td>
              <td className="num" style={{ ...td, textAlign: "right", color: T.bg, fontWeight: 600 }}>
                {hidden ? "•••" : fmt(totais.ganhos)}
              </td>
              <td className="num" style={{ ...td, textAlign: "right", color: T.bg, fontWeight: 600 }}>
                {hidden ? "•••" : fmt(totais.dividasPagas)}
              </td>
              <td className="num" style={{ ...td, textAlign: "right", color: T.bg, fontWeight: 700 }}>
                {hidden ? "•••" : fmt(totais.balanco)}
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = {
  padding: "10px 14px", textAlign: "left",
  fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
  color: "var(--tm)", fontWeight: 500,
};
const td = { padding: "12px 14px", verticalAlign: "middle" };

/* ============================================================
   DetalhesGrupos — 4 blocos (FIXAS / VARIÁVEIS / PARCELAS / GANHOS)
   ============================================================ */
function DetalhesGrupos({ linha, hidden }) {
  const fixas    = linha.despesas.filter(d => d.tipo === "fixa");
  const variaveis = linha.despesas.filter(d => d.tipo === "variavel");
  const parcelas = linha.despesas.filter(d => d.tipo === "parcela");
  const ganhos   = linha.ganhosItens;

  const blocos = [
    { tipo: "fixa",     titulo: TIPO_LABEL.fixa,     items: fixas },
    { tipo: "variavel", titulo: TIPO_LABEL.variavel, items: variaveis },
    { tipo: "parcela",  titulo: TIPO_LABEL.parcela,  items: parcelas },
    { tipo: "ganho",    titulo: TIPO_LABEL.ganho,    items: ganhos },
  ];

  const todosVazios = blocos.every(b => b.items.length === 0);
  if (todosVazios) {
    return (
      <div style={{ color: T.muted, fontStyle: "italic", fontSize: 12, textAlign: "center", padding: 14 }}>
        Sem lançamentos detalhados neste mês.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
      {blocos.map(b => (
        <BlocoTipo key={b.tipo} tipo={b.tipo} titulo={b.titulo} items={b.items} hidden={hidden} />
      ))}
    </div>
  );
}

function BlocoTipo({ tipo, titulo, items, hidden }) {
  const cor = TIPO_COR[tipo] || T.muted;
  const total = items.reduce((s, i) => s + (Number(i.valor) || 0), 0);

  return (
    <div>
      <div style={{
        display: "flex", alignItems: "baseline", justifyContent: "space-between",
        marginBottom: 8, paddingBottom: 6, borderBottom: `1px solid ${cor}33`,
      }}>
        <div style={{
          fontSize: 9.5, letterSpacing: ".2em", color: cor,
          textTransform: "uppercase", fontWeight: 700,
        }}>
          {titulo} ({items.length})
        </div>
        <div className="num" style={{ fontSize: 12, color: cor, fontWeight: 600 }}>
          {hidden ? "•••" : fmt(total)}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", padding: 6 }}>
          Sem lançamentos.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {items.map(it => {
            const statusCfg = {
              paga:     { fg: T.green, bg: `${T.green}22`, lbl: "Paga" },
              pendente: { fg: T.gold,  bg: `${T.gold}22`,  lbl: "Pend." },
              atrasada: { fg: T.red,   bg: `${T.red}22`,   lbl: "Atras." },
            }[it.status] || { fg: T.muted, bg: `${T.muted}22`, lbl: it.status };
            return (
              <div key={it.id} style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 8px", background: T.card,
                border: `1px solid ${T.border}`, borderRadius: 5,
                fontSize: 11,
              }}>
                <span style={{ flex: 1, color: T.ink, minWidth: 0,
                               overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.descricao}
                </span>
                {it.data && (
                  <span style={{ fontSize: 9.5, color: T.muted, whiteSpace: "nowrap" }}>
                    {it.data.slice(8, 10)}/{it.data.slice(5, 7)}
                  </span>
                )}
                <span style={{
                  fontSize: 8, padding: "1px 5px", borderRadius: 3,
                  background: statusCfg.bg, color: statusCfg.fg,
                  fontWeight: 700, whiteSpace: "nowrap",
                }}>{statusCfg.lbl}</span>
                <span className="num" style={{
                  color: cor, fontWeight: 600, whiteSpace: "nowrap", minWidth: 65, textAlign: "right",
                }}>
                  {hidden ? "•••" : fmt(it.valor)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
