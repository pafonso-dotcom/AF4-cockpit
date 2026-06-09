import React, { useMemo, useState, useEffect } from "react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { BarChartDouble, BarChart, HorizontalBarList, ReportCard, ReportGrid } from "../ui/Charts.jsx";
import { toPDF, toCSV, toPNG, hasPNGSupport } from "../../lib/exportRelatorio.js";
import { toast } from "../../lib/toast.js";
import { getKPIsMes, getDespesasDoMes } from "../../lib/agregador.js";
import { filtrarPorEscopo } from "../../lib/escopo.js";
import EvolucaoPatrimonio from "./Invest/EvolucaoPatrimonio.jsx";

/**
 * Relatórios de Finanças · análises do período.
 */
export default function RelatoriosFinancas({
  transacoes: transacoesRaw = [], contas: contasRaw = [], categorias = [],
  fixas = [], fixaOcorrencias = [], parcelamentos = [], dividas = [], devedores = [],
  patrimonioHistorico = [],
  escopoAtivo = "tudo",
  hidden,
}) {
  // Aplica filtro de escopo (Pessoal / Negócio / Tudo) — contas de negócio
  // não entram nos relatórios quando o escopo é "pessoal", e vice-versa.
  const contas = useMemo(() => filtrarPorEscopo(contasRaw || [], escopoAtivo), [contasRaw, escopoAtivo]);
  const transacoes = useMemo(() => {
    if (escopoAtivo === "tudo") return transacoesRaw || [];
    const setContas = new Set(contas.map(c => c.nome));
    return (transacoesRaw || []).filter(t => t.conta && setContas.has(t.conta));
  }, [transacoesRaw, contas, escopoAtivo]);

  const [pngOk, setPngOk] = useState(false);
  useEffect(() => { hasPNGSupport().then(setPngOk); }, []);
  const mesAtualKey = new Date().toISOString().slice(0, 7);
  // ===== Receita vs Despesa últimos 6 meses =====
  const seisMeses = useMemo(() => {
    const hoje = new Date();
    const meses = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const nome = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()];
      const tx = transacoes.filter(t => (t.data || "").startsWith(key));
      const rec = tx.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
      const desp = tx.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
      meses.push({ label: nome, value1: rec, value2: desp });
    }
    return meses;
  }, [transacoes]);

  // ===== Top categorias do mês =====
  // Usa o agregador (getDespesasDoMes) — MESMA base do donut do painel, pra
  // os números baterem entre as telas.
  const topCategorias = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    const state = { transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores };
    let desp = [];
    try { desp = getDespesasDoMes(mes, state, escopoAtivo); } catch {}
    const mapa = {};
    desp.forEach(d => {
      const cat = d.categoria || "Sem categoria";
      mapa[cat] = (mapa[cat] || 0) + (Number(d.valor) || 0);
    });
    return Object.entries(mapa)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, escopoAtivo]);

  // ===== Tendência por categoria (6 meses) =====
  // Pra cada categoria de despesa: total por mês + variação do mês atual vs média
  // dos meses anteriores. Mostra o que está subindo/caindo de verdade.
  const tendenciaCategorias = useMemo(() => {
    const hoje = new Date();
    const keys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      keys.push(d.toISOString().slice(0, 7));
    }
    const mesAtual = keys[keys.length - 1];
    const porCat = {}; // cat -> { [mes]: total }
    transacoes.filter(t => t.tipo === "despesa").forEach(t => {
      const mes = (t.data || "").slice(0, 7);
      if (!keys.includes(mes)) return;
      const cat = t.categoria || "Sem categoria";
      (porCat[cat] = porCat[cat] || {});
      porCat[cat][mes] = (porCat[cat][mes] || 0) + Number(t.valor || 0);
    });
    const linhas = Object.entries(porCat).map(([cat, meses]) => {
      const serie = keys.map(k => meses[k] || 0);
      const atual = meses[mesAtual] || 0;
      const anteriores = keys.slice(0, -1).map(k => meses[k] || 0);
      const mediaAnt = anteriores.length ? anteriores.reduce((s, v) => s + v, 0) / anteriores.length : 0;
      const variacao = mediaAnt > 0 ? ((atual - mediaAnt) / mediaAnt) * 100 : (atual > 0 ? 100 : 0);
      const total6m = serie.reduce((s, v) => s + v, 0);
      return { cat, serie, atual, mediaAnt, variacao, total6m };
    });
    return linhas.sort((a, b) => b.total6m - a.total6m).slice(0, 8);
  }, [transacoes]);

  // ===== Maiores gastos do mês (transações individuais) =====
  const maioresGastos = useMemo(() => {
    const mes = new Date().toISOString().slice(0, 7);
    return transacoes
      .filter(t => t.tipo === "despesa" && (t.data || "").startsWith(mes))
      .slice()
      .sort((a, b) => Number(b.valor || 0) - Number(a.valor || 0))
      .slice(0, 8)
      .map(t => ({
        descricao: t.descricao || t.categoria || "—",
        categoria: t.categoria || "Sem categoria",
        data: t.data,
        valor: Number(t.valor || 0),
        conta: t.conta || "",
      }));
  }, [transacoes]);

  // ===== Sobra mensal REAL (últimos 6 meses) = receita − despesa por mês =====
  const sobraMensal = useMemo(
    () => seisMeses.map(m => ({ label: m.label, value: m.value1 - m.value2 })),
    [seisMeses]
  );
  const sobraMediaReal = sobraMensal.length
    ? sobraMensal.reduce((s, m) => s + m.value, 0) / sobraMensal.length : 0;
  const sobraTotalReal = sobraMensal.reduce((s, m) => s + m.value, 0);

  // ===== Sobra acumulada no ano (REAL) — mês a mês do ano corrente =====
  const acumuladoAno = useMemo(() => {
    const ano = new Date().getFullYear();
    const mesAtualIdx = new Date().getMonth(); // 0..11
    const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
    const out = [];
    let acc = 0;
    for (let m = 0; m <= mesAtualIdx; m++) {
      const key = `${ano}-${String(m + 1).padStart(2, "0")}`;
      const tx = transacoes.filter(t => (t.data || "").startsWith(key));
      const rec = tx.filter(t => t.tipo === "receita").reduce((s, t) => s + Number(t.valor || 0), 0);
      const desp = tx.filter(t => t.tipo === "despesa").reduce((s, t) => s + Number(t.valor || 0), 0);
      acc += rec - desp;
      out.push({ label: nomes[m], value: acc });
    }
    return out;
  }, [transacoes]);
  const sobraAnoTotal = acumuladoAno.length ? acumuladoAno[acumuladoAno.length - 1].value : 0;

  // ===== Projeção REAL · meses a vencer (compromissos já agendados) =====
  const projecaoReal = useMemo(() => {
    const hoje = new Date();
    const state = { transacoes, fixas, fixaOcorrencias, parcelamentos, dividas, devedores };
    const meses = [];
    for (let i = 1; i <= 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const mesISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const nome = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()];
      const kpis = getKPIsMes(mesISO, state);
      meses.push({
        label: `${nome}/${String(d.getFullYear()).slice(2)}`,
        despesas: kpis.totalPrevisto,
        ganhos: kpis.totalGanhos,
        saldo: kpis.balancoPrevisto,
      });
    }
    return meses;
  }, [transacoes, fixas, fixaOcorrencias, parcelamentos, dividas, devedores]);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Finanças · Relatórios</div>
      <h1 className="h1">Análises <em>do período.</em></h1>
      <p className="hs">Evolução · categorias · sobra mensal · tendências · maiores gastos.</p>

      {/* Evolução do patrimônio (snapshot diário) — visão de longo prazo */}
      <div style={{ marginTop: 16 }}>
        <EvolucaoPatrimonio historico={patrimonioHistorico} hidden={hidden} />
      </div>

      <ReportGrid>
        <ExportableCard
          id="rep-receita-despesa"
          title="Receita vs Despesa (6 meses)"
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Receitas", "Despesas"],
            rows: seisMeses.map(m => [m.label, m.value1, m.value2]),
          }}
          csvName={`af4-receita-vs-despesa-${mesAtualKey}.csv`}
        >
          <BarChartDouble
            data={seisMeses}
            colors={[T.gold, T.red]}
            labels={["Receitas", "Despesas"]}
            formatValue={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
          />
        </ExportableCard>

        <ExportableCard
          id="rep-top-categorias"
          title="Top categorias do mês"
          pngOk={pngOk}
          csvData={{
            headers: ["Categoria", "Total"],
            rows: topCategorias.map(c => [c.label, c.value]),
          }}
          csvName={`af4-top-categorias-${mesAtualKey}.csv`}
        >
          {topCategorias.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem despesas categorizadas este mês.
            </div>
          ) : (
            <HorizontalBarList
              data={topCategorias.map(c => ({ ...c, color: T.gold }))}
              formatValue={v => hidden ? "•••" : fmt(v)}
            />
          )}
        </ExportableCard>

        <ExportableCard
          id="rep-sobra-mensal"
          title="Sobra mensal (6 meses)"
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Sobra (receita − despesa)"],
            rows: sobraMensal.map(m => [m.label, m.value.toFixed(2)]),
          }}
          csvName={`af4-sobra-mensal-${mesAtualKey}.csv`}
          footer={
            <>💰 Sobra média real: <strong style={{ color: sobraMediaReal >= 0 ? T.green : T.red }}>{hidden ? "•••" : fmt(sobraMediaReal)}</strong>/mês ·
              acumulado 6m: {hidden ? "•••" : fmt(sobraTotalReal)}
            </>
          }
        >
          <BarChart
            data={sobraMensal}
            color={T.gold}
            formatValue={v => Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}
          />
        </ExportableCard>

        <ExportableCard
          id="rep-acumulado-ano"
          title={`Sobra acumulada no ano (${new Date().getFullYear()})`}
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Acumulado no ano"],
            rows: acumuladoAno.map(c => [c.label, c.value.toFixed(2)]),
          }}
          csvName={`af4-acumulado-ano-${mesAtualKey}.csv`}
          footer={
            <>📊 Resultado acumulado do ano até agora:&nbsp;
              <strong style={{ color: sobraAnoTotal >= 0 ? T.green : T.red }}>{hidden ? "•••" : fmt(sobraAnoTotal)}</strong>
            </>
          }
        >
          <BarChart
            data={acumuladoAno}
            color={T.gold}
            formatValue={v => hidden ? "•••" : (Math.abs(v) >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0))}
          />
        </ExportableCard>

        <ExportableCard
          id="rep-projecao-real"
          title="Projeção · meses a vencer"
          pngOk={pngOk}
          csvData={{
            headers: ["Mês", "Despesas previstas", "Ganhos previstos", "Saldo"],
            rows: projecaoReal.map(m => [m.label, m.despesas.toFixed(2), m.ganhos.toFixed(2), m.saldo.toFixed(2)]),
          }}
          csvName={`af4-projecao-meses-${mesAtualKey}.csv`}
          footer={
            <>📅 Baseado em compromissos já agendados (fixas, parcelas, dívidas, devedores) nos próximos 6 meses.</>
          }
        >
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: 6, padding: "6px 0",
          }}>
            {projecaoReal.map(m => (
              <div key={m.label} style={{
                background: T.bgSoft, padding: 9, borderRadius: 6,
                borderTop: `3px solid ${m.saldo >= 0 ? T.green : T.red}`,
              }}>
                <div style={{
                  fontSize: 9.5, letterSpacing: ".1em", color: T.muted,
                  textTransform: "uppercase", fontWeight: 700,
                }}>{m.label}</div>
                <div className="num" style={{ fontSize: 11, color: T.green, marginTop: 4 }}>
                  + {hidden ? "•••" : fmt(m.ganhos)}
                </div>
                <div className="num" style={{ fontSize: 11, color: T.red }}>
                  − {hidden ? "•••" : fmt(m.despesas)}
                </div>
                <div className="num" style={{
                  fontSize: 12.5, fontWeight: 700, marginTop: 4,
                  color: m.saldo >= 0 ? T.green : T.red,
                  borderTop: `1px solid ${T.border}`, paddingTop: 3,
                }}>
                  = {m.saldo >= 0 ? "+ " : "− "}{hidden ? "•••" : fmt(Math.abs(m.saldo))}
                </div>
              </div>
            ))}
          </div>
        </ExportableCard>

        {/* Tendência por categoria (6 meses) */}
        <ExportableCard
          id="rep-tendencia-categorias"
          title="Tendência por categoria (6m)"
          pngOk={pngOk}
          csvData={{
            headers: ["Categoria", "Mês atual", "Média 5m ant.", "Variação %", "Total 6m"],
            rows: tendenciaCategorias.map(l => [l.cat, l.atual.toFixed(2), l.mediaAnt.toFixed(2), l.variacao.toFixed(1), l.total6m.toFixed(2)]),
          }}
          csvName={`af4-tendencia-categorias-${mesAtualKey}.csv`}
          footer={<>↑ subindo · ↓ caindo — variação do mês atual vs média dos 5 meses anteriores.</>}
        >
          {tendenciaCategorias.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem despesas nos últimos 6 meses.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {tendenciaCategorias.map(l => {
                const sobe = l.variacao > 5, cai = l.variacao < -5;
                const cor = sobe ? T.red : cai ? T.green : T.muted;
                const max = Math.max(...l.serie, 1);
                return (
                  <div key={l.cat} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center", padding: "6px 8px", background: T.bgSoft, borderRadius: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.cat}</div>
                      {/* Sparkline simples (6 barrinhas) */}
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 16, marginTop: 3 }}>
                        {l.serie.map((v, i) => (
                          <div key={i} title={hidden ? "" : fmt(v)} style={{ width: 6, height: `${Math.max(8, (v / max) * 100)}%`, background: i === l.serie.length - 1 ? cor : T.border, borderRadius: 1 }} />
                        ))}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="num" style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{hidden ? "•••" : fmt(l.atual)}</div>
                      <div className="num" style={{ fontSize: 10.5, color: cor, fontWeight: 600 }}>
                        {sobe ? "↑" : cai ? "↓" : "→"} {l.variacao >= 0 ? "+" : ""}{l.variacao.toFixed(0)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ExportableCard>

        {/* Maiores gastos do mês */}
        <ExportableCard
          id="rep-maiores-gastos"
          title="Maiores gastos do mês"
          pngOk={pngOk}
          csvData={{
            headers: ["Descrição", "Categoria", "Data", "Conta", "Valor"],
            rows: maioresGastos.map(g => [g.descricao, g.categoria, g.data, g.conta, g.valor.toFixed(2)]),
          }}
          csvName={`af4-maiores-gastos-${mesAtualKey}.csv`}
          footer={<>🔎 As 8 maiores despesas individuais do mês atual.</>}
        >
          {maioresGastos.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem despesas este mês.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 4 }}>
              {maioresGastos.map((g, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 8, alignItems: "center", padding: "6px 8px", background: T.bgSoft, borderRadius: 6 }}>
                  <span style={{ fontSize: 10, color: T.faint, fontFamily: T.mono, width: 16, textAlign: "center" }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: T.ink, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.descricao}</div>
                    <div style={{ fontSize: 10, color: T.muted }}>{g.categoria} · {(g.data || "").split("-").reverse().slice(0, 2).join("/")}</div>
                  </div>
                  <span className="num" style={{ fontSize: 12.5, color: T.red, fontWeight: 600 }}>{hidden ? "•••" : fmt(g.valor)}</span>
                </div>
              ))}
            </div>
          )}
        </ExportableCard>
      </ReportGrid>
    </div>
  );
}

function ExportableCard({ id, title, children, footer, csvData, csvName, pngOk }) {
  return (
    <div id={id}>
      <ReportCard
        title={
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span>{title}</span>
            <div className="no-print" style={{ display: "inline-flex", gap: 4 }}>
              <ExportBtn label="📄 PDF" onClick={() => { try { toPDF(id); toast.info("Abrindo impressão — escolha “Salvar como PDF”."); } catch { toast.error("Não foi possível gerar o PDF."); } }} />
              <ExportBtn label="📊 CSV" onClick={() => { try { toCSV(csvData, csvName); toast.success("CSV baixado."); } catch { toast.error("Não foi possível gerar o CSV."); } }} />
              {pngOk && <ExportBtn label="🖼️ PNG" onClick={async () => { try { await toPNG(id, csvName.replace(".csv", ".png")); toast.success("Imagem (PNG) baixada."); } catch { toast.error("Não foi possível gerar a imagem."); } }} />}
            </div>
          </div>
        }
        footer={footer}
      >
        {children}
      </ReportCard>
    </div>
  );
}

function ExportBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        background: "transparent", color: T.muted,
        border: `1px solid ${T.border}`, borderRadius: 5,
        padding: "5px 10px", fontSize: 9.5, fontWeight: 600,
        letterSpacing: ".05em", cursor: "pointer", whiteSpace: "nowrap",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; e.currentTarget.style.color = T.gold; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.muted; }}>
      {label}
    </button>
  );
}
