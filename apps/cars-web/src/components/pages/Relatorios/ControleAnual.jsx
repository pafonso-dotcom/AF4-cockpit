import React, { useState, useMemo } from "react";
import { Printer, Download, ClipboardCopy, ChevronDown, ChevronUp, Trash2, TrendingUp, TrendingDown, Wallet, CreditCard } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, todayISO } from "../../../lib/format.js";
import PageHeader from "../../ui/PageHeader.jsx";
import { StatTile } from "../../ui/widget.jsx";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import { getAnualPorMes } from "../../../lib/agregador.js";
import { MESES_LONGO as MES_NOMES } from "../../../lib/meses.js";

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
  setTransacoes,
  contas = [],
  dividas = [],
  fixaOcorrencias = [],
  setFixaOcorrencias,
  fixas = [],
  setFixas,
  parcelamentos = [],
  setParcelamentos,
  devedores = [],
  cheques = [],
  escopoAtivo = "tudo",
  embed = false,
  hidden,
}) {
  const hoje = todayISO();
  const anoCorrente = parseInt(hoje.slice(0, 4), 10);
  const mesCorrenteIdx = parseInt(hoje.slice(5, 7), 10) - 1;

  const [ano, setAno] = useState(anoCorrente);
  const [mesExpandido, setMesExpandido] = useState(null); // 0-11 ou null

  // Inclui `contas` no state: o aplicarEscopo precisa delas pra mapear quais
  // transações pertencem ao escopo (Pessoal/Negócio). Sem isso o relatório
  // mostrava receitas/despesas de TODOS os escopos, sem bater com a tela de
  // Transações (que é filtrada por escopo).
  const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques };
  const linhas = useMemo(
    () => getAnualPorMes(ano, state, escopoAtivo),
    [ano, transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cheques, escopoAtivo]
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

  // Remove duplicadas que aparecem no controle anual: fixas (mesmo nome + valor)
  // e parcelamentos (mesmo nome + valor da parcela + total). Mantém uma de cada
  // e remove as cópias; pagamentos/parcelas pagas da que sobra ficam intactos.
  const removerDuplicadas = async () => {
    const norm = (s) => (s || "").toLowerCase().normalize("NFD")
      .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "")
      .replace(/\s+/g, " ").trim();
    const valorParcela = (p) =>
      Number(p.valorParcela || (p.valorTotal && p.totalParcelas ? p.valorTotal / p.totalParcelas : 0)) || 0;

    // Fixas duplicadas
    const gFix = {};
    (fixas || []).forEach(f => {
      const k = `${norm(f.descricao)}|${Math.round((Number(f.valor) || 0) * 100)}`;
      (gFix[k] = gFix[k] || []).push(f);
    });
    const fixasRemover = [];
    Object.values(gFix).filter(g => g.length > 1).forEach(g => {
      const ord = [...g].sort((a, b) =>
        (fixaOcorrencias.filter(o => o.fixaId === b.id).length) -
        (fixaOcorrencias.filter(o => o.fixaId === a.id).length));
      fixasRemover.push(...ord.slice(1));
    });

    // Parcelamentos duplicados
    const gParc = {};
    (parcelamentos || []).forEach(p => {
      const k = `${norm(p.descricao)}|${Math.round(valorParcela(p) * 100)}|${p.totalParcelas || 0}`;
      (gParc[k] = gParc[k] || []).push(p);
    });
    const parcRemover = [];
    Object.values(gParc).filter(g => g.length > 1).forEach(g => {
      const ord = [...g].sort((a, b) => (b.parcelasPagas?.length || 0) - (a.parcelasPagas?.length || 0));
      parcRemover.push(...ord.slice(1));
    });

    // Transações de pagamento contando EM DOBRO: "Pagamento para X" (despesa
    // compensada, SEM vínculo de origem) que casa com uma ocorrência de fixa
    // paga OU uma dívida paga no mesmo mês. Em vez de apagar (o que bagunçaria
    // o saldo), VINCULAMOS a transação à origem — aí o agregador para de somar
    // duas vezes e o saldo continua igual.
    const semVinculo = (transacoes || []).filter(t =>
      t.tipo === "despesa" && t.compensado &&
      !t.origemFixaOcorrenciaId && !t.origemParcelamentoId && !t.origemDividaId &&
      /^pagamento para /i.test(t.descricao || ""));
    const vincFixa = [];   // { txId, occId }
    const vincDivida = []; // { txId, dividaId }
    const usados = new Set();
    for (const t of semVinculo) {
      const alvo = norm((t.descricao || "").replace(/^pagamento para /i, ""));
      const mes = (t.data || "").slice(0, 7);
      const valorTx = Number(t.valor) || 0;
      // tenta casar com fixa paga no mês
      const fixaMatch = (fixas || []).find(f => norm(f.descricao) === alvo);
      let casou = false;
      if (fixaMatch) {
        const occ = (fixaOcorrencias || []).find(o =>
          o.fixaId === fixaMatch.id && o.mes === mes && o.status === "paga" &&
          !usados.has(o.id) &&
          Math.abs((Number(o.valorPago ?? o.valor) || 0) - valorTx) < 0.02);
        if (occ) { vincFixa.push({ txId: t.id, occId: occ.id }); usados.add(occ.id); casou = true; }
      }
      // senão tenta casar com dívida paga no mês
      if (!casou) {
        const div = (dividas || []).find(d =>
          d.pago && norm(d.nome) === alvo && (d.vencimento || "").startsWith(mes) &&
          !usados.has(d.id) && Math.abs((Number(d.valor) || 0) - valorTx) < 0.02);
        if (div) { vincDivida.push({ txId: t.id, dividaId: div.id }); usados.add(div.id); }
      }
    }
    const totalVinc = vincFixa.length + vincDivida.length;

    const total = fixasRemover.length + parcRemover.length + totalVinc;
    if (total === 0) {
      toast.info("Nenhuma duplicidade encontrada no controle anual.");
      return;
    }
    const ok = await confirm({
      title: `Corrigir ${total} duplicidade${total === 1 ? "" : "s"}?`,
      body: `Encontrei ${fixasRemover.length} fixa(s) e ${parcRemover.length} parcelamento(s) repetidos (removo as cópias) e ${totalVinc} pagamento(s) contando em dobro (vinculo à origem, sem mexer no saldo). Tem Desfazer.`,
      danger: true, confirmLabel: "Corrigir",
    });
    if (!ok) return;

    const fixaIds = new Set(fixasRemover.map(f => f.id));
    const parcIds = new Set(parcRemover.map(p => p.id));
    const backupFixas = fixas, backupOcc = fixaOcorrencias, backupParc = parcelamentos, backupTx = transacoes;

    if (typeof setFixas === "function") setFixas((fixas || []).filter(f => !fixaIds.has(f.id)));
    if (typeof setFixaOcorrencias === "function") {
      setFixaOcorrencias((fixaOcorrencias || []).filter(o => !fixaIds.has(o.fixaId)));
    }
    if (typeof setParcelamentos === "function") setParcelamentos((parcelamentos || []).filter(p => !parcIds.has(p.id)));

    if (totalVinc > 0 && typeof setTransacoes === "function") {
      const mapFixa = new Map(vincFixa.map(v => [v.txId, v.occId]));
      const mapDiv = new Map(vincDivida.map(v => [v.txId, v.dividaId]));
      setTransacoes((transacoes || []).map(t =>
        mapFixa.has(t.id) ? { ...t, origemFixaOcorrenciaId: mapFixa.get(t.id) }
        : mapDiv.has(t.id) ? { ...t, origemDividaId: mapDiv.get(t.id) }
        : t));
    }

    toast.success(`${total} duplicidade${total === 1 ? "" : "s"} corrigida${total === 1 ? "" : "s"}.`, {
      duration: 6000,
      action: {
        label: "Desfazer",
        onClick: () => {
          if (setFixas) setFixas(backupFixas);
          if (setFixaOcorrencias) setFixaOcorrencias(backupOcc);
          if (setParcelamentos) setParcelamentos(backupParc);
          if (setTransacoes) setTransacoes(backupTx);
        },
      },
    });
  };

  return (
    <div className={embed ? "" : "fade-up py-8 px-6"}>
      {!embed && (
      <PageHeader
        eyebrow="Finanças · Relatórios"
        title={<>Controle <em>Anual.</em></>}
        sub="12 meses do ano. Fixas, variáveis, parcelas, ganhos e dívidas pagas — clique numa linha pra ver o detalhe."
        action={
          <div className="flex gap-2 flex-wrap no-print">
            <select value={ano} onChange={e => setAno(parseInt(e.target.value))}
                    style={{ padding: "8px 11px", background: T.bgSoft, border: `1px solid ${T.border}`,
                             color: T.ink, fontSize: 12, borderRadius: 11 }}>
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
            <button onClick={removerDuplicadas} className="btn-ghost" title="Remove fixas/parcelamentos repetidos e corrige pagamentos contados em dobro"
                    style={{ color: T.red, borderColor: `${T.red}55` }}>
              <Trash2 size={13} className="inline mr-1.5" /> Excluir duplicidade
            </button>
          </div>
        }
      />
      )}

      {/* No Centro de controle (embed) o cabeçalho some — mostra só o seletor de ano. */}
      {embed && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <select value={ano} onChange={e => setAno(parseInt(e.target.value))}
                  style={{ padding: "6px 10px", background: T.bgSoft, border: `1px solid ${T.border}`,
                           color: T.ink, fontSize: 12, borderRadius: 10, cursor: "pointer" }}>
            {[anoCorrente - 2, anoCorrente - 1, anoCorrente, anoCorrente + 1, anoCorrente + 2].map(y =>
              <option key={y} value={y}>{y}</option>
            )}
          </select>
        </div>
      )}

      {/* Resumo do ano no estilo widget — sparklines com o real (12 meses) */}
      <div className="no-print" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 12 }}>
        <StatTile label="Ganhos (ano)" valor={totais.ganhos} hidden={hidden} cor={T.green} icon={TrendingUp} sub={String(ano)} spark={linhas.map(l => l.ganhos)} />
        <StatTile label="Gastos (ano)" valor={totais.fixas + totais.variaveis + totais.parcelas} hidden={hidden} cor={T.red} icon={TrendingDown} sub="fixas + variáveis + parcelas" spark={linhas.map(l => l.fixas + l.variaveis + l.parcelas)} />
        <StatTile label="Dívidas pagas" valor={totais.dividasPagas} hidden={hidden} cor={T.gold} icon={CreditCard} sub={String(ano)} spark={linhas.map(l => l.dividasPagas)} />
        <StatTile label="Balanço (ano)" valor={totais.balanco} hidden={hidden} cor={totais.balanco >= 0 ? T.green : T.red} icon={Wallet} sub="ganhos − saídas" spark={linhas.map(l => l.balanco)} />
      </div>

      <div className="print-area" style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, overflow: "auto" }}>
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
    { tipo: "ganho",    titulo: TIPO_LABEL.ganho,    items: ganhos },
    { tipo: "variavel", titulo: TIPO_LABEL.variavel, items: variaveis },
    { tipo: "parcela",  titulo: TIPO_LABEL.parcela,  items: parcelas },
  ];

  const todosVazios = blocos.every(b => b.items.length === 0);
  if (todosVazios) {
    return (
      <div style={{ color: T.muted, fontStyle: "italic", fontSize: 12, textAlign: "center", padding: 14 }}>
        Sem lançamentos detalhados neste mês.
      </div>
    );
  }

  const byTipo = Object.fromEntries(blocos.map(b => [b.tipo, b]));
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14, alignItems: "start" }}>
      {/* Coluna 1: Fixas com Ganhos logo abaixo (não no fim da tela) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <BlocoTipo {...byTipo.fixa} hidden={hidden} />
        <BlocoTipo {...byTipo.ganho} hidden={hidden} />
      </div>
      <BlocoTipo {...byTipo.variavel} hidden={hidden} />
      <BlocoTipo {...byTipo.parcela} hidden={hidden} />
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
