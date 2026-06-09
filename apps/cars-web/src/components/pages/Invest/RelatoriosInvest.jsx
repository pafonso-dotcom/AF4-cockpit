import React, { useMemo, useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { BarChart, HorizontalBarList, ReportCard, ReportGrid } from "../../ui/Charts.jsx";
import { calendarioProventos } from "../../../lib/invest-metrics.js";
import PdfCarteira from "./PdfCarteira.jsx";

// Ativos US (Stocks/REITs) têm preço em DÓLAR — somados/exibidos em US$ à parte.
const US_TIPOS = new Set(["stock", "reit"]);
const ehUS = (a) => US_TIPOS.has(a?.tipo);
const fmtUSD = (v) => "US$ " + (Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoedaAtivo = (a, v) => ehUS(a) ? fmtUSD(v) : fmt(v);

/**
 * Relatórios de Investimentos.
 */
export default function RelatoriosInvest({ ativos = [], proventos: proventosProp = [], operacoes = [], hidden }) {
  const [pdfAberto, setPdfAberto] = useState(false);
  // Patrimônio atual — separado por moeda (Brasil R$ vs EUA US$).
  const valorBR = ativos.filter(a => !ehUS(a)).reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  const valorUSA = ativos.filter(a => ehUS(a)).reduce((s, a) => s + Number(a.qtd || 0) * Number(a.preco || 0), 0);
  const valorAtual = valorBR + valorUSA; // só pra base da evolução simulada
  const custo = ativos.reduce((s, a) => s + Number(a.qtd || 0) * Number(a.pm ?? a.precoMedio ?? a.preco ?? 0), 0);

  // Evolução simulada do patrimônio (12 meses)
  const evolucao = useMemo(() => {
    const meses = ["Jun","Jul","Ago","Set","Out","Nov","Dez","Jan","Fev","Mar","Abr","Mai"];
    const base = custo > 0 ? custo : valorAtual * 0.85;
    return meses.map((m, i) => {
      // Crescimento gradual + ruído
      const fator = 1 + (i * 0.014) + (Math.sin(i * 0.7) * 0.02);
      return { label: m, value: base * fator };
    });
  }, [valorAtual, custo]);

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

  // Proventos 12 meses (simulados a partir do calendário)
  const proventosCalc = useMemo(() => calendarioProventos(ativos), [ativos]);
  const proventosMensais = useMemo(() => {
    const meses = ["Jun","Jul","Ago","Set","Out","Nov","Dez","Jan","Fev","Mar","Abr","Mai"];
    const totalProj = proventosCalc.reduce((s, p) => s + (p.total || 0), 0);
    const mediaMes = totalProj / 3 || 1000;
    return meses.map(m => ({
      label: m,
      value: mediaMes * (0.7 + Math.random() * 0.6),
    }));
  }, [proventosCalc]);

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
      <p className="hs">Evolução patrimônio · top posições · proventos · IR.</p>

      <div style={{
        display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        padding: 14, marginTop: 12, marginBottom: 6,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
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
          <BarChart
            data={evolucao}
            color={T.gold}
            formatValue={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}
          />
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
