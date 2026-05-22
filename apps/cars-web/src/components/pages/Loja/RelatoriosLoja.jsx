import React, { useMemo, useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { BarChart, HorizontalBarList, ReportCard, ReportGrid } from "../../ui/Charts.jsx";
import { diasEmEstoque } from "../../../lib/lojaCarros.js";
import { RelatorioCheques, RelatorioBancoLoja, RelatorioFunil } from "./RelatoriosPrint.jsx";

/**
 * Relatórios da Loja AF4.
 */
export default function RelatoriosLoja({
  veiculos = [], vendas = [], leads = [], clientes = [],
  cheques = [], transacoes = [], contas = [],
  hidden, onAbrirPDV,
}) {
  const [printAberto, setPrintAberto] = useState(null); // "cheques" | "banco" | "funil" | null
  // Vendas por mês (12 meses)
  const vendasMensais = useMemo(() => {
    const hoje = new Date();
    const meses = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const nome = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][d.getMonth()];
      const qtd = vendas.filter(v => (v.data || "").startsWith(key) && v.status !== "cancelada").length;
      meses.push({ label: nome, value: qtd });
    }
    return meses;
  }, [vendas]);

  const totalVendas12m = vendasMensais.reduce((s, m) => s + m.value, 0);
  const fatTotal = vendas.reduce((s, v) => s + Number(v.valorVenda || 0), 0);

  // Margem por categoria
  const margemCategoria = useMemo(() => {
    const cats = {};
    vendas.forEach(v => {
      const veiculo = veiculos.find(vc => vc.id === v.veiculoId);
      const cat = veiculo?.categoria || "outro";
      const margem = Number(v.margem?.percentual || v.lucroPercentual || 0);
      if (!cats[cat]) cats[cat] = { soma: 0, count: 0 };
      cats[cat].soma += margem;
      cats[cat].count += 1;
    });
    const nomesCat = { premium: "Premium", suv: "SUV", sedan: "Sedan", hatch: "Hatch", picape: "Picape", outro: "Outros" };
    return Object.entries(cats)
      .map(([cat, d]) => ({
        label: nomesCat[cat] || cat,
        value: d.count > 0 ? d.soma / d.count : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [vendas, veiculos]);

  // Giro de estoque (dias em estoque para os disponíveis)
  const giro = useMemo(() => {
    return veiculos
      .filter(v => v.status === "estoque" || v.status === "DISPONIVEL")
      .map(v => ({
        label: `${v.marca || ""} ${v.modelo || ""}`.trim().slice(0, 18) || "Veículo",
        value: diasEmEstoque(v),
        color: diasEmEstoque(v) < 30 ? T.green : diasEmEstoque(v) < 45 ? T.gold : diasEmEstoque(v) < 60 ? T.yellow : T.red,
      }))
      .sort((a, b) => a.value - b.value)
      .slice(0, 8);
  }, [veiculos]);

  const tempoMedio = giro.length > 0
    ? Math.round(giro.reduce((s, g) => s + g.value, 0) / giro.length)
    : 0;

  // ROI por canal (a partir de leads)
  const roiCanal = useMemo(() => {
    if (!leads || leads.length === 0) {
      return [
        { label: "Indicação", value: 52, color: T.green },
        { label: "Webmotors", value: 34, color: T.gold },
        { label: "WhatsApp", value: 31, color: T.gold },
        { label: "Instagram", value: 25, color: T.gold },
        { label: "OLX",       value: 17, color: T.muted },
      ];
    }
    const canais = {};
    leads.forEach(l => {
      const c = l.origem || "Outros";
      if (!canais[c]) canais[c] = { total: 0, fechados: 0 };
      canais[c].total++;
      if (l.estagio === "fechado") canais[c].fechados++;
    });
    return Object.entries(canais)
      .map(([nome, d]) => ({
        label: nome,
        value: d.total > 0 ? (d.fechados / d.total) * 100 : 0,
        color: d.total > 0 && (d.fechados / d.total) > 0.4 ? T.green : T.gold,
      }))
      .sort((a, b) => b.value - a.value);
  }, [leads]);

  return (
    <div className="fade-up" style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      <div className="eb">Loja AF4 · Relatórios</div>
      <h1 className="h1">Análises <em>comerciais.</em></h1>
      <p className="hs">Vendas mensais · margem por categoria · giro · ROI por canal.</p>

      {/* Documentos */}
      <div style={{
        display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap",
        padding: 14, background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>Documentos</div>
          <div style={{ fontSize: 13, color: T.ink, fontWeight: 500 }}>Gerar Proposta de Negociação (PDV)</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
            Modelo idêntico ao da AF4 Motors · imprime direto · com usados, trocos, observações e assinaturas.
          </div>
        </div>
        <button onClick={() => onAbrirPDV && onAbrirPDV()} className="btn-gold" style={{ alignSelf: "center" }}>
          📄 Gerar PDV
        </button>
      </div>

      <ReportGrid>
        <ReportCard
          title="Vendas (12 meses)"
          footer={
            <>🚗 Total: <strong style={{ color: T.green }}>{totalVendas12m} veículos</strong> · Faturamento: {hidden ? "•••" : fmt(fatTotal)}</>
          }
        >
          <BarChart
            data={vendasMensais}
            color={T.gold}
            formatValue={v => v.toFixed(0)}
          />
        </ReportCard>

        <ReportCard title="Margem por Categoria">
          {margemCategoria.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Ainda sem vendas para calcular margem.
            </div>
          ) : (
            <HorizontalBarList
              data={margemCategoria.map(c => ({ ...c, color: T.gold }))}
              formatValue={v => `${v.toFixed(1)}%`}
            />
          )}
        </ReportCard>

        <ReportCard
          title="Giro de Estoque (dias)"
          footer={
            <>⏱️ Meta: 45 dias · Média atual: <strong style={{ color: tempoMedio <= 45 ? T.green : T.red }}>{tempoMedio}d</strong></>
          }
        >
          {giro.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12.5 }}>
              Sem veículos no estoque.
            </div>
          ) : (
            <HorizontalBarList
              data={giro}
              formatValue={v => `${v}d ${v <= 45 ? "✓" : v <= 60 ? "" : "⚠"}`}
            />
          )}
        </ReportCard>

        <ReportCard
          title="ROI por Canal de Lead"
          footer={<>🎯 Conversão = leads fechados ÷ leads totais</>}
        >
          <HorizontalBarList
            data={roiCanal}
            formatValue={v => `${v.toFixed(0)}% conv.`}
          />
        </ReportCard>
      </ReportGrid>

      {/* ===== Relatórios print-friendly ===== */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{
          fontSize: 13, letterSpacing: ".15em", textTransform: "uppercase",
          color: T.gold, marginBottom: 12,
        }}>
          🖨️ Relatórios para impressão
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <PrintCard
            icone="📋"
            titulo="Cheques recebidos"
            sub="Tabela agrupada por mês · totais por status · período configurável."
            onClick={() => setPrintAberto("cheques")}
          />
          <PrintCard
            icone="🏦"
            titulo="Banco da Loja (extrato)"
            sub="Movimentação completa com saldo acumulado · totalizadores no rodapé."
            onClick={() => setPrintAberto("banco")}
          />
          <PrintCard
            icone="🎯"
            titulo="Funil de leads"
            sub="Por estágio · qtd · valor · taxa de conversão · tempo médio."
            onClick={() => setPrintAberto("funil")}
          />
        </div>
      </div>

      {printAberto === "cheques" && (
        <RelatorioCheques cheques={cheques} onClose={() => setPrintAberto(null)} />
      )}
      {printAberto === "banco" && (
        <RelatorioBancoLoja transacoes={transacoes} contas={contas} onClose={() => setPrintAberto(null)} />
      )}
      {printAberto === "funil" && (
        <RelatorioFunil leads={leads} onClose={() => setPrintAberto(null)} />
      )}
    </div>
  );
}

function PrintCard({ icone, titulo, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      textAlign: "left", background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 10, padding: 16, cursor: "pointer",
      transition: "all .15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{icone}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, marginBottom: 4 }}>{titulo}</div>
      <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.45 }}>{sub}</div>
      <div style={{ fontSize: 10, color: T.gold, marginTop: 10, letterSpacing: ".08em", textTransform: "uppercase" }}>
        Abrir →
      </div>
    </button>
  );
}
