import React, { useState, useMemo } from "react";
import { T } from "../../../lib/theme.js";
import { fmt, todayISO } from "../../../lib/format.js";
import { getContaLojaNome } from "../../../lib/bancoLoja.js";
import Modal from "../../ui/Modal.jsx";

/**
 * 3 relatórios print-friendly da Loja AF4:
 *  - Cheques recebidos (agrupado por mês, totais por status)
 *  - Banco da Loja (extrato com saldo acumulado)
 *  - Funil de leads (por estágio, conversão, tempo médio)
 *
 * Cada um tem botão "🖨️ Imprimir / PDF" usando window.print().
 */

const PERIODOS = [
  { id: "mes",  label: "Mês corrente" },
  { id: "3m",   label: "Últimos 3 meses" },
  { id: "ano",  label: "Ano corrente" },
  { id: "tudo", label: "Tudo" },
];

function periodoLimite(periodo) {
  const hoje = new Date();
  if (periodo === "mes")  return new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
  if (periodo === "3m")   return new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1).toISOString().slice(0, 10);
  if (periodo === "ano")  return `${hoje.getFullYear()}-01-01`;
  return "";
}

const MES_NOMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

/* ========================================================
   RELATÓRIO 1: CHEQUES RECEBIDOS
   ======================================================== */
export function RelatorioCheques({ cheques = [], onClose }) {
  const [periodo, setPeriodo] = useState("ano");
  const limite = periodoLimite(periodo);

  const filtrados = useMemo(() => {
    return cheques
      .filter(c => !limite || (c.data || "") >= limite)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  }, [cheques, limite]);

  const porMes = useMemo(() => {
    const map = new Map();
    filtrados.forEach(c => {
      const key = (c.data || "").slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtrados]);

  const totaisStatus = useMemo(() => {
    const t = { aguardando: 0, compensado: 0, devolvido: 0, substituido: 0 };
    filtrados.forEach(c => {
      if (t[c.status] != null) t[c.status] += parseFloat(c.valor) || 0;
    });
    return t;
  }, [filtrados]);

  return (
    <Modal title="🖨️ Relatório · Cheques recebidos" onClose={onClose} wide>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T.muted }}>Período:</span>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
          {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button onClick={() => window.print()} className="btn-gold" style={{ marginLeft: "auto" }}>
          🖨️ Imprimir / PDF
        </button>
      </div>

      <div className="print-area" style={{ background: "#fff", color: "#111", padding: 24, borderRadius: 6, fontSize: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>AF4 · Loja de Veículos</h2>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>
          Relatório de cheques recebidos · {PERIODOS.find(p => p.id === periodo)?.label} · {todayISO()}
        </div>

        {porMes.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, fontStyle: "italic", color: "#888" }}>
            Nenhum cheque no período.
          </div>
        ) : porMes.map(([mes, list]) => {
          const [y, m] = mes.split("-");
          const totalMes = list.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0);
          return (
            <div key={mes} style={{ marginBottom: 18 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #ccc" }}>
                {MES_NOMES[parseInt(m, 10) - 1]} / {y}  ·  {list.length} cheques  ·  {fmt(totalMes)}
              </h3>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#f3f3f3" }}>
                    <th style={thPrint}>#</th>
                    <th style={thPrint}>Emitente</th>
                    <th style={thPrint}>Banco</th>
                    <th style={thPrint}>Vencimento</th>
                    <th style={{ ...thPrint, textAlign: "right" }}>Valor</th>
                    <th style={thPrint}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(c => (
                    <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={tdPrint}>{c.numero || "—"}</td>
                      <td style={tdPrint}>{c.emitente || "—"}</td>
                      <td style={tdPrint}>{c.banco || "—"}</td>
                      <td style={tdPrint}>{c.data ? `${c.data.slice(8, 10)}/${c.data.slice(5, 7)}/${c.data.slice(0, 4)}` : "—"}</td>
                      <td style={{ ...tdPrint, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(parseFloat(c.valor) || 0)}</td>
                      <td style={tdPrint}>{c.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

        <div style={{ marginTop: 24, paddingTop: 12, borderTop: "2px solid #333", fontSize: 12 }}>
          <strong>Totais por status</strong>
          <table style={{ width: "100%", marginTop: 8 }}>
            <tbody>
              <tr><td>Aguardando:</td><td style={{ textAlign: "right" }}>{fmt(totaisStatus.aguardando)}</td></tr>
              <tr><td>Compensado:</td><td style={{ textAlign: "right" }}>{fmt(totaisStatus.compensado)}</td></tr>
              <tr><td>Devolvido:</td><td style={{ textAlign: "right" }}>{fmt(totaisStatus.devolvido)}</td></tr>
              <tr><td>Substituído:</td><td style={{ textAlign: "right" }}>{fmt(totaisStatus.substituido)}</td></tr>
              <tr style={{ borderTop: "1px solid #ccc", fontWeight: 700 }}>
                <td>Total geral:</td>
                <td style={{ textAlign: "right" }}>
                  {fmt(Object.values(totaisStatus).reduce((s, v) => s + v, 0))}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/* ========================================================
   RELATÓRIO 2: BANCO DA LOJA · EXTRATO
   ======================================================== */
export function RelatorioBancoLoja({ transacoes = [], contas = [], onClose }) {
  const [periodo, setPeriodo] = useState("mes");
  const limite = periodoLimite(periodo);
  const contaNome = getContaLojaNome(contas);

  const movimentos = useMemo(() => {
    if (!contaNome) return [];
    const lista = transacoes
      .filter(t => t.conta === contaNome)
      .filter(t => !limite || (t.data || "") >= limite)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    let saldo = 0;
    return lista.map(t => {
      const v = parseFloat(t.valor) || 0;
      saldo += t.tipo === "receita" ? v : -v;
      return { ...t, saldoAcumulado: saldo };
    });
  }, [transacoes, contaNome, limite]);

  const totais = useMemo(() => {
    const por = {};
    movimentos.forEach(t => {
      const key = t.tipo;
      por[key] = (por[key] || 0) + (parseFloat(t.valor) || 0);
    });
    return por;
  }, [movimentos]);

  return (
    <Modal title="🖨️ Relatório · Extrato Banco da Loja" onClose={onClose} wide>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: T.muted }}>Período:</span>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)}>
          {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button onClick={() => window.print()} className="btn-gold" style={{ marginLeft: "auto" }}>
          🖨️ Imprimir / PDF
        </button>
      </div>

      <div className="print-area" style={{ background: "#fff", color: "#111", padding: 24, borderRadius: 6, fontSize: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>AF4 · Extrato Banco da Loja</h2>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>
          Conta: {contaNome || "(não configurada)"} · {PERIODOS.find(p => p.id === periodo)?.label} · {todayISO()}
        </div>

        {!contaNome ? (
          <div style={{ textAlign: "center", padding: 30, fontStyle: "italic", color: "#888" }}>
            Conta "Banco da Loja · CC" não encontrada.
          </div>
        ) : movimentos.length === 0 ? (
          <div style={{ textAlign: "center", padding: 30, fontStyle: "italic", color: "#888" }}>
            Sem movimentações no período.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ background: "#f3f3f3" }}>
                <th style={thPrint}>Data</th>
                <th style={thPrint}>Descrição</th>
                <th style={thPrint}>Tipo</th>
                <th style={{ ...thPrint, textAlign: "right" }}>Valor</th>
                <th style={{ ...thPrint, textAlign: "right" }}>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movimentos.map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={tdPrint}>{t.data ? `${t.data.slice(8, 10)}/${t.data.slice(5, 7)}` : "—"}</td>
                  <td style={tdPrint}>{t.descricao}</td>
                  <td style={tdPrint}>{t.categoria || t.tipo}</td>
                  <td style={{ ...tdPrint, textAlign: "right", fontVariantNumeric: "tabular-nums",
                               color: t.tipo === "receita" ? "#0a7c2c" : "#b00020" }}>
                    {t.tipo === "receita" ? "+ " : "− "}{fmt(parseFloat(t.valor) || 0)}
                  </td>
                  <td style={{ ...tdPrint, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(t.saldoAcumulado)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 24, paddingTop: 12, borderTop: "2px solid #333" }}>
          <strong>Totalizadores</strong>
          <table style={{ width: "100%", marginTop: 8 }}>
            <tbody>
              {Object.entries(totais).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ textTransform: "capitalize" }}>{k}:</td>
                  <td style={{ textAlign: "right" }}>{fmt(v)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "1px solid #ccc", fontWeight: 700 }}>
                <td>Saldo final:</td>
                <td style={{ textAlign: "right" }}>
                  {movimentos.length > 0 ? fmt(movimentos[movimentos.length - 1].saldoAcumulado) : fmt(0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

/* ========================================================
   RELATÓRIO 3: FUNIL DE LEADS
   ======================================================== */
export function RelatorioFunil({ leads = [], onClose }) {
  const ESTAGIOS = [
    { id: "novo",        label: "Novo" },
    { id: "atendimento", label: "Atendimento" },
    { id: "negociacao",  label: "Negociação" },
    { id: "aprov",       label: "Aprovação" },
    { id: "fechado",     label: "Fechado" },
  ];

  const porEstagio = useMemo(() => {
    return ESTAGIOS.map((e, idx) => {
      const items = leads.filter(l => l.estagio === e.id);
      const valorTotal = items.reduce((s, l) => s + (parseFloat(l.valorEstimado) || 0), 0);
      // tempo médio em dias desde createdAt
      const hoje = new Date();
      let mediaDias = 0;
      if (items.length > 0) {
        const dias = items.map(l => {
          const d = new Date(l.createdAt || hoje);
          return Math.max(0, Math.round((hoje - d) / 86400000));
        });
        mediaDias = Math.round(dias.reduce((s, d) => s + d, 0) / items.length);
      }
      return {
        ...e,
        count: items.length,
        valorTotal,
        mediaDias,
      };
    });
  }, [leads]);

  const totalLeads = leads.length;
  const fechados = leads.filter(l => l.estagio === "fechado").length;
  const conversaoGeral = totalLeads > 0 ? (fechados / totalLeads) * 100 : 0;

  return (
    <Modal title="🖨️ Relatório · Funil de leads" onClose={onClose} wide>
      <div className="no-print" style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center" }}>
        <button onClick={() => window.print()} className="btn-gold" style={{ marginLeft: "auto" }}>
          🖨️ Imprimir / PDF
        </button>
      </div>

      <div className="print-area" style={{ background: "#fff", color: "#111", padding: 24, borderRadius: 6, fontSize: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>AF4 · Funil de Leads</h2>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 16 }}>
          {totalLeads} leads totais · {fechados} fechados · taxa de conversão {conversaoGeral.toFixed(1)}% · {todayISO()}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#f3f3f3" }}>
              <th style={thPrint}>Estágio</th>
              <th style={{ ...thPrint, textAlign: "right" }}>Quantidade</th>
              <th style={{ ...thPrint, textAlign: "right" }}>Valor estimado</th>
              <th style={{ ...thPrint, textAlign: "right" }}>Tempo médio</th>
              <th style={{ ...thPrint, textAlign: "right" }}>Conversão até aqui</th>
            </tr>
          </thead>
          <tbody>
            {porEstagio.map((e, idx) => {
              const conv = totalLeads > 0 ? (e.count / totalLeads) * 100 : 0;
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ ...tdPrint, fontWeight: 600 }}>{e.label}</td>
                  <td style={{ ...tdPrint, textAlign: "right" }}>{e.count}</td>
                  <td style={{ ...tdPrint, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    {fmt(e.valorTotal)}
                  </td>
                  <td style={{ ...tdPrint, textAlign: "right" }}>{e.mediaDias}d</td>
                  <td style={{ ...tdPrint, textAlign: "right" }}>{conv.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Conversões entre estágios */}
        <div style={{ marginTop: 20 }}>
          <strong>Conversão entre estágios</strong>
          <table style={{ width: "100%", marginTop: 8, fontSize: 11 }}>
            <tbody>
              {porEstagio.slice(0, -1).map((e, i) => {
                const prox = porEstagio[i + 1];
                const conv = e.count > 0 ? (prox.count / e.count) * 100 : 0;
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid #eee" }}>
                    <td style={tdPrint}>{e.label} → {prox.label}</td>
                    <td style={{ ...tdPrint, textAlign: "right" }}>
                      {e.count} → {prox.count}
                    </td>
                    <td style={{ ...tdPrint, textAlign: "right", fontWeight: 600 }}>
                      {conv.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}

const thPrint = {
  textAlign: "left", padding: "6px 8px", fontWeight: 600,
  borderBottom: "1px solid #999", fontSize: 11,
};
const tdPrint = {
  padding: "5px 8px", verticalAlign: "top",
};
