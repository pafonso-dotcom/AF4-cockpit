import React, { useMemo, useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtUSD, fmtN } from "../../../lib/format.js";
import { BarChart, HorizontalBarList, ReportCard, ReportGrid } from "../../ui/Charts.jsx";
import { PROVENTO_REGEX, ehUS, fmtMoedaAtivo } from "../../../lib/invest-constants.js";
import PdfCarteira from "./PdfCarteira.jsx";
import { MESES_CURTO as MESES_PT, MESES_LONGO } from "../../../lib/meses.js";
import { movimentacoesInvestMes } from "../../../lib/movimentacoesInvest.js";
import { printHTML } from "../../../lib/importExport.js";
import SecaoColapsavel from "../../ui/SecaoColapsavel.jsx";

// Últimos 12 meses (do mais antigo pro atual), com iso "YYYY-MM" e fim do mês.
function ultimos12Meses() {
  const out = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    out.push({
      label: MESES_PT[m],
      iso: `${y}-${String(m + 1).padStart(2, "0")}`,
      fimMes: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    });
  }
  return out;
}
// Não é provento: saldo/transferência/PIX/aporte/resgate (evita inflar).
const NAO_PROVENTO = /\bsaldo\b|transfer|\btransf\b|\bpix\b|aporte|resgate/i;
const ehProvento = (tx) =>
  tx?.tipo === "receita"
  && (PROVENTO_REGEX.test(tx.categoria || "") || PROVENTO_REGEX.test(tx.descricao || ""))
  && !NAO_PROVENTO.test(tx.descricao || "");

/**
 * Relatórios de Investimentos.
 */
export default function RelatoriosInvest({ ativos = [], transacoes = [], patrimonioHistorico = [], proventos: proventosProp = [], operacoes = [], hidden }) {
  const [pdfAberto, setPdfAberto] = useState(false);
  // Patrimônio atual — separado por moeda (Brasil R$ vs EUA US$).
  const valorBR = ativos.filter(a => !ehUS(a)).reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  const valorUSA = ativos.filter(a => ehUS(a)).reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  const valorAtual = valorBR + valorUSA; // só pra base da evolução simulada
  const custo = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.pm ?? a.precoMedio ?? a.preco ?? 0), 0);

  // Evolução REAL do patrimônio (12 meses) — a partir dos snapshots gravados.
  // Pra cada mês usa o último snapshot até o fim do mês (carry-forward).
  const meses12 = useMemo(() => ultimos12Meses(), []);
  const evolucao = useMemo(() => {
    const ordenado = [...(patrimonioHistorico || [])]
      .filter(p => p && p.data != null)
      .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
    let ultimo = 0;
    return meses12.map(({ label, fimMes }) => {
      const ate = ordenado.filter(p => (p.data || "") <= fimMes);
      if (ate.length) ultimo = Number(ate[ate.length - 1].total) || ultimo;
      return { label, value: ultimo };
    });
  }, [patrimonioHistorico, meses12]);
  const temEvolucao = (patrimonioHistorico || []).length >= 2;

  // Top 5 posições
  const top5 = useMemo(() =>
    [...ativos]
      .map(a => {
        const value = Number(a.qtd || 0) * Number(a.preco || 0);
        return {
          label: a.ticker || a.nome || "—",
          value,
          valorLabel: hidden ? "•••" : fmtMoedaAtivo(a, value),
        };
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
      .map(p => ({ ...p, color: T.gold })),
    [ativos, hidden]
  );

  // Proventos REAIS dos últimos 12 meses — soma das receitas de provento/
  // dividendo/rendimento (excluindo Saldo/Transferência/PIX) por mês.
  const proventosMensais = useMemo(() =>
    meses12.map(({ label, iso }) => ({
      label,
      value: (transacoes || [])
        .filter(t => ehProvento(t) && (t.data || "").startsWith(iso))
        .reduce((s, t) => s + (Number(t.valor) || 0), 0),
    })),
    [transacoes, meses12]
  );

  const totalProventos12m = proventosMensais.reduce((s, m) => s + m.value, 0);

  // IR estimado simplificado por classe
  const irEstimado = useMemo(() => {
    const ganhoAcao = ativos.filter(a => (a.tipo || "").toLowerCase() === "acao")
      .reduce((s, a) => s + (Number(a.preco || 0) - Number(a.pm ?? a.precoMedio ?? a.preco ?? 0)) * Number(a.qtd || 0), 0);
    const ganhoCripto = ativos.filter(a => (a.tipo || "").toLowerCase() === "cripto")
      .reduce((s, a) => s + (Number(a.preco || 0) - Number(a.pm ?? a.precoMedio ?? a.preco ?? 0)) * Number(a.qtd || 0), 0);

    return [
      { label: "Day Trade",    value: 0,                        nota: "20%" },
      { label: "Swing Trade",  value: Math.max(ganhoAcao * 0.15, 0),    nota: "15%" },
      { label: "Cripto",       value: Math.max(ganhoCripto * 0.15, 0),  nota: "15%" },
      { label: "FIIs (rend.)", value: 0,                        nota: "Isento" },
      { label: "Dividendos",   value: 0,                        nota: "Isento" },
    ];
  }, [ativos]);

  const totalIR = irEstimado.reduce((s, x) => s + x.value, 0);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Investimentos · Relatórios</div>
      <h1 className="h1">Análises da <em>carteira.</em></h1>
      <p className="hs">Movimentações do mês · evolução patrimônio · top posições · proventos · IR.</p>

      <MovInvestMes transacoes={transacoes} hidden={hidden} />

      <div style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        padding: 14, marginTop: 12, marginBottom: 6,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 18,
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>
            Documento completo
          </div>
          <div style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>
            📄 PDF da carteira de investimentos
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Capa com resumo geral · 1 página por ativo · posição, resultado, proventos 12m, YoC, DY, histórico de operações.
          </div>
        </div>
        <button onClick={() => setPdfAberto(true)} className="btn-gold">
          📄 Exportar PDF da carteira
        </button>
      </div>

      <ReportGrid>
        <ReportCard
          title="Evolução do Patrimônio (12 meses)"
          footer={
            <>📈 Atual · Brasil <strong style={{ color: T.green }}>{hidden ? "•••" : fmt(valorBR)}</strong>{valorUSA !== 0 && <> · EUA <strong style={{ color: T.green }}>{hidden ? "•••" : fmtUSD(valorUSA)}</strong></>}</>
          }
        >
          {temEvolucao ? (
            <BarChart
              data={evolucao}
              color={T.gold}
              formatValue={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
            />
          ) : (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Ainda sem histórico suficiente. Os snapshots do patrimônio vão sendo
              gravados ao longo do tempo — volte depois pra ver a evolução real.
            </div>
          )}
        </ReportCard>

        <ReportCard title="Top 5 Posições">
          {top5.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem ativos na carteira.
            </div>
          ) : (
            <HorizontalBarList
              data={top5}
              formatValue={v => hidden ? "•••" : fmt(v)}
            />
          )}
        </ReportCard>

        <ReportCard
          title="Proventos Recebidos (12 meses)"
          footer={
            <>💵 Total: <strong style={{ color: T.green }}>{hidden ? "•••" : fmt(totalProventos12m)}</strong> · Média: {hidden ? "•••" : fmt(totalProventos12m / 12)}/mês</>
          }
        >
          <BarChart
            data={proventosMensais}
            color={T.gold}
            formatValue={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
          />
        </ReportCard>

        <ReportCard
          title="Imposto de Renda (estimado)"
          footer={
            <>📋 Total estimado: <strong>{hidden ? "•••" : fmt(totalIR)}</strong> · Export DARF disponível</>
          }
        >
          <HorizontalBarList
            data={irEstimado.map(x => ({
              label: `${x.label} (${x.nota})`,
              value: x.value,
              color: x.value > 0 ? T.gold : T.muted,
            }))}
            formatValue={v => hidden ? "•••" : v > 0 ? fmt(v) : "Isento"}
          />
        </ReportCard>
      </ReportGrid>

      {pdfAberto && (
        <PdfCarteira
          ativos={ativos}
          proventos={proventosProp}
          operacoes={operacoes}
          onClose={() => setPdfAberto(false)}
        />
      )}
    </div>
  );
}

// ===== Movimentações do mês (compras, vendas, proventos) =====
const nomeMesLongo = (iso) => { const [a, m] = (iso || "").split("-").map(Number); return `${MESES_LONGO[(m || 1) - 1]} ${a || ""}`; };

function MovInvestMes({ transacoes = [], hidden = false }) {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  const [mes, setMes] = useState(mesAtual);
  const passo = (d) => { const [y, m] = mes.split("-").map(Number); const nd = new Date(y, m - 1 + d, 1); setMes(`${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, "0")}`); };
  const oculto = (v) => (hidden ? "•••" : fmt(v));
  const mov = useMemo(() => movimentacoesInvestMes(transacoes, mes), [transacoes, mes]);
  const vazio = mov.compras.length === 0 && mov.vendas.length === 0 && mov.proventos.length === 0;
  const dia = (iso) => (iso || "").slice(8, 10) + "/" + (iso || "").slice(5, 7);

  const exportarPDF = () => {
    const brl = (v) => `R$ ${Math.round(Number(v) || 0).toLocaleString("pt-BR")}`;
    const tabela = (titulo, linhas) => linhas.length ? `<h2>${titulo}</h2><table>${linhas.join("")}</table>` : "";
    printHTML(`<!doctype html><html><head><meta charset="utf-8"><title>Movimentações · ${nomeMesLongo(mes)}</title>
<style>body{font-family:system-ui,sans-serif;color:#222;padding:24px}h1{font-size:20px;margin:0}h2{font-size:13px;margin:16px 0 5px;color:#555}table{width:100%;border-collapse:collapse;font-size:12px}td{padding:4px 6px;border-bottom:1px solid #eee}td.n{text-align:right;font-variant-numeric:tabular-nums}</style></head><body>
<h1>Movimentações de investimentos · ${nomeMesLongo(mes)}</h1>
${tabela("Compras (aportes)", mov.compras.map((c) => `<tr><td><b>${c.ticker}</b> · ${dia(c.data)}</td><td class="n">${brl(c.valor)}</td></tr>`))}
${tabela("Vendas", mov.vendas.map((v) => `<tr><td><b>${v.ticker}</b> · ${dia(v.data)}${v.resultado != null ? ` · result. ${brl(v.resultado)}` : ""}</td><td class="n">${brl(v.valor)}</td></tr>`))}
${tabela("Proventos", mov.proventos.map((p) => `<tr><td><b>${p.ticker}</b> · ${p.tipo} · ${dia(p.data)}</td><td class="n">${brl(p.valor)}</td></tr>`))}
<h2>Resumo</h2><table>
<tr><td>Comprado</td><td class="n">${brl(mov.totalComprado)}</td></tr>
<tr><td>Vendido</td><td class="n">${brl(mov.totalVendido)}</td></tr>
<tr><td>Proventos</td><td class="n">${brl(mov.totalProventos)}</td></tr>
<tr><td>Resultado das vendas</td><td class="n">${brl(mov.resultadoVendas)}</td></tr></table>
<p style="margin-top:14px;color:#888;font-size:11px">Gerado em ${new Date().toLocaleString("pt-BR")}.</p></body></html>`);
  };

  const box = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: "6px 16px 14px", marginBottom: 12 };
  const navB = { width: 24, height: 24, border: `1px solid ${T.border}`, borderRadius: 8, display: "grid", placeItems: "center", background: T.card, color: T.muted, cursor: "pointer", fontWeight: 700 };
  const pill = { display: "inline-flex", alignItems: "center", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "2px 8px", fontSize: 11.5, fontWeight: 800, letterSpacing: ".02em", flexShrink: 0 };
  const secH = (ic, cor, titulo, n, tot) => (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 0 8px", borderBottom: `1px solid ${T.border}`, marginBottom: 4 }}>
      <span style={{ width: 24, height: 24, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 13, background: `${cor}22` }}>{ic}</span>
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>{titulo}</span>
      <span style={{ marginLeft: "auto", fontSize: 11, color: T.faint, fontWeight: 600 }}>{n} · {oculto(tot)}</span>
    </div>
  );
  const linha = (children) => <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: `1px dashed ${T.border}`, fontSize: 13 }}>{children}</div>;

  const totalMov = mov.compras.length + mov.vendas.length + mov.proventos.length;

  return (
    <div style={{ marginTop: 14 }}>
    <SecaoColapsavel
      idKey="mov-invest-mes"
      defaultAberto={false}
      count={totalMov}
      titulo={<>Movimentações · <span style={{ textTransform: "capitalize", color: T.gold }}>{nomeMesLongo(mes)}</span>{totalMov > 0 ? <span style={{ color: T.faint, fontWeight: 500 }}> · comprado {oculto(mov.totalComprado)} · proventos {oculto(mov.totalProventos)}</span> : null}</>}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 11, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, fontWeight: 700, marginRight: 4 }}>Mês</span>
          <button onClick={() => passo(-1)} aria-label="Mês anterior" style={navB}>‹</button>
          <span style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600, textTransform: "capitalize", minWidth: 120, textAlign: "center" }}>{nomeMesLongo(mes)}</span>
          <button onClick={() => passo(1)} aria-label="Próximo mês" style={navB}>›</button>
          {mes !== mesAtual && <button onClick={() => setMes(mesAtual)} style={{ ...navB, width: "auto", padding: "0 8px", fontSize: 11 }}>hoje</button>}
        </div>
        <button onClick={exportarPDF} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 9, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.muted, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>⤓ PDF</button>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }} className="mi-kpis">
        {[{ k: "Comprado", v: oculto(mov.totalComprado), a: T.green, c: T.ink },
          { k: "Vendido", v: oculto(mov.totalVendido), a: T.red, c: T.ink },
          { k: "Proventos", v: oculto(mov.totalProventos), a: T.gold, c: T.gold },
          { k: "Result. vendas", v: mov.resultadoVendas >= 0 ? `+ ${oculto(mov.resultadoVendas)}` : `− ${oculto(Math.abs(mov.resultadoVendas))}`, a: mov.resultadoVendas >= 0 ? T.green : T.red, c: mov.resultadoVendas >= 0 ? T.green : T.red }].map((t, i) => (
          <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "12px 13px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: t.a }} />
            <div style={{ fontSize: 10, color: T.muted, textTransform: "uppercase", letterSpacing: ".06em", fontWeight: 600 }}>{t.k}</div>
            <div className="num" style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 700, marginTop: 2, color: t.c }}>{t.v}</div>
          </div>
        ))}
      </div>

      {vazio ? (
        <div style={{ ...box, textAlign: "center", color: T.muted, fontStyle: "italic", fontSize: 13, padding: 20 }}>
          Nenhuma movimentação em {nomeMesLongo(mes)}. (Compras/vendas aparecem quando o aporte/venda é feito com uma conta selecionada.)
        </div>
      ) : (
        <>
          {mov.compras.length > 0 && (
            <div style={box}>
              {secH("🟢", T.green, "Compras (aportes)", mov.compras.length, mov.totalComprado)}
              {mov.compras.map((c) => linha(<>
                <span style={pill}>{c.ticker}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: T.muted }} className="num">{c.qtd > 0 ? `${fmtN(c.qtd, c.qtd < 1 ? 8 : 0)} × ${oculto(c.preco)} · ` : ""}{dia(c.data)}</span>
                <span style={{ fontFamily: T.serif, fontWeight: 700 }}>{oculto(c.valor)}</span>
              </>))}
            </div>
          )}
          {mov.vendas.length > 0 && (
            <div style={box}>
              {secH("🔴", T.red, "Vendas", mov.vendas.length, mov.totalVendido)}
              {mov.vendas.map((v) => linha(<>
                <span style={pill}>{v.ticker}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: T.muted }} className="num">{v.qtd > 0 ? `${fmtN(v.qtd, v.qtd < 1 ? 8 : 0)} × ${oculto(v.preco)} · ` : ""}{dia(v.data)}</span>
                {v.resultado != null && <span className="num" style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 100, background: `${v.resultado >= 0 ? T.green : T.red}18`, color: v.resultado >= 0 ? T.green : T.red }}>{v.resultado >= 0 ? "+ " : "− "}{oculto(Math.abs(v.resultado))}</span>}
                <span style={{ fontFamily: T.serif, fontWeight: 700 }}>{oculto(v.valor)}</span>
              </>))}
            </div>
          )}
          {mov.proventos.length > 0 && (
            <div style={box}>
              {secH("💵", T.gold, "Proventos recebidos", mov.proventos.length, mov.totalProventos)}
              {mov.proventos.map((p) => linha(<>
                <span style={pill}>{p.ticker}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: T.muted }}>{p.tipo} · <span className="num">{dia(p.data)}</span></span>
                <span style={{ fontFamily: T.serif, fontWeight: 700, color: T.gold }}>{oculto(p.valor)}</span>
              </>))}
            </div>
          )}
        </>
      )}
      <style>{`@media (max-width:640px){ .mi-kpis{grid-template-columns:1fr 1fr !important} }`}</style>
    </SecaoColapsavel>
    </div>
  );
}
