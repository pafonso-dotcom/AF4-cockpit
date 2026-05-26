import React, { useMemo, useState } from "react";
import { Calculator, RefreshCw } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";

/**
 * Calculadora de Renda Mensal de Investimento.
 *
 * Simula quanto um valor investido em renda fixa rende por mês, em 3
 * cenários (bruto / saca tudo / preserva o patrimônio contra a inflação),
 * com equivalente em EUR pelo câmbio configurável.
 *
 * Todos os valores recalculam ao vivo conforme o usuário move os sliders.
 */

const DEFAULTS = {
  valor: 3_000_000,
  taxaAnualPct: 14.4,
  irPct: 15,
  inflacaoPct: 4.5,
  cambio: 5.84,
};

const ATALHOS = [
  { id: "selic", label: "Tesouro Selic / CDB", taxa: 14.4, ir: 15 },
  { id: "lci",   label: "LCI / LCA (isento)", taxa: 13.2, ir: 0 },
  { id: "fii",   label: "Fundos Imobiliários", taxa: 10.5, ir: 0 },
];

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});
const fmtEUR = new Intl.NumberFormat("pt-PT", {
  style: "currency", currency: "EUR", maximumFractionDigits: 0,
});

export default function CalculadoraRenda() {
  const [valor, setValor]             = useState(DEFAULTS.valor);
  const [taxaAnualPct, setTaxa]       = useState(DEFAULTS.taxaAnualPct);
  const [irPct, setIr]                = useState(DEFAULTS.irPct);
  const [inflacaoPct, setInflacao]    = useState(DEFAULTS.inflacaoPct);
  const [cambio, setCambio]           = useState(DEFAULTS.cambio);

  const resetTudo = () => {
    setValor(DEFAULTS.valor);
    setTaxa(DEFAULTS.taxaAnualPct);
    setIr(DEFAULTS.irPct);
    setInflacao(DEFAULTS.inflacaoPct);
    setCambio(DEFAULTS.cambio);
  };

  const aplicarAtalho = (a) => {
    setTaxa(a.taxa);
    setIr(a.ir);
  };

  // ===== Cálculo =====
  const resultado = useMemo(() => {
    const taxa = taxaAnualPct / 100;
    const ir = irPct / 100;
    const inflacao = inflacaoPct / 100;

    const taxaMensal = Math.pow(1 + taxa, 1 / 12) - 1;
    const brutoMes = valor * taxaMensal;
    const liquidoMes = brutoMes * (1 - ir);

    const taxaLiquidaAnual = taxa * (1 - ir);
    const taxaRealAnual = (1 + taxaLiquidaAnual) / (1 + inflacao) - 1;
    const rendaRealMes = taxaRealAnual > 0
      ? valor * (Math.pow(1 + taxaRealAnual, 1 / 12) - 1)
      : 0;

    return { brutoMes, liquidoMes, rendaRealMes, taxaLiquidaAnual, taxaRealAnual };
  }, [valor, taxaAnualPct, irPct, inflacaoPct]);

  const toEur = (v) => (cambio > 0 ? v / cambio : 0);

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Investimentos · Simulador"
        title="Calculadora de Renda Mensal"
        sub="Simule quanto seu investimento em renda fixa pode gerar por mês — bruto, líquido e o que preserva o patrimônio contra a inflação."
        action={
          <button onClick={resetTudo} className="btn-ghost" title="Restaurar defaults">
            <RefreshCw size={12} className="inline mr-1.5" /> Reset
          </button>
        }
      />

      {/* Atalhos rápidos */}
      <div style={{ marginBottom: 14 }}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>Cenários rápidos</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ATALHOS.map(a => {
            const ativo = Math.abs(taxaAnualPct - a.taxa) < 0.05 && Math.abs(irPct - a.ir) < 0.05;
            return (
              <button key={a.id} onClick={() => aplicarAtalho(a)}
                style={{
                  padding: "8px 14px", borderRadius: 6, cursor: "pointer",
                  fontSize: 12, fontWeight: 500,
                  background: ativo ? `${T.gold}22` : T.card,
                  color: ativo ? T.gold : T.ink,
                  border: `1px solid ${ativo ? T.gold : T.border}`,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                <span>{a.label}</span>
                <span style={{ color: T.muted, fontSize: 11 }}>
                  · {a.taxa}% · IR {a.ir}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
        gap: 14,
      }} className="calc-grid">
        {/* Coluna esquerda: sliders */}
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
          padding: 16, display: "grid", gap: 18,
        }}>
          <Slider
            label="Valor investido"
            value={valor}
            min={100_000} max={10_000_000} step={100_000}
            onChange={setValor}
            display={fmtBRL.format(valor)}
          />
          <Slider
            label="Taxa de juros ao ano"
            value={taxaAnualPct}
            min={5} max={20} step={0.1}
            onChange={setTaxa}
            display={`${taxaAnualPct.toFixed(1)} %`}
          />
          <Slider
            label="IR sobre o rendimento"
            value={irPct}
            min={0} max={22.5} step={0.5}
            onChange={setIr}
            display={`${irPct.toFixed(1)} %`}
          />
          <Slider
            label="Inflação ao ano"
            value={inflacaoPct}
            min={0} max={12} step={0.1}
            onChange={setInflacao}
            display={`${inflacaoPct.toFixed(1)} %`}
          />
          <Slider
            label="Câmbio (R$ por €)"
            value={cambio}
            min={4} max={8} step={0.01}
            onChange={setCambio}
            display={`R$ ${cambio.toFixed(2)} / €`}
          />

          {/* Mini-resumo das taxas derivadas */}
          <div style={{
            paddingTop: 12, borderTop: `1px dashed ${T.border}`,
            display: "grid", gap: 4, fontSize: 11, color: T.muted,
          }}>
            <RowSmall label="Taxa líquida ao ano" value={`${(resultado.taxaLiquidaAnual * 100).toFixed(2)} %`} />
            <RowSmall label="Taxa real ao ano (após inflação)"
                      value={`${(resultado.taxaRealAnual * 100).toFixed(2)} %`}
                      cor={resultado.taxaRealAnual >= 0 ? T.green : T.red} />
          </div>
        </div>

        {/* Coluna direita: 3 cartões de saída */}
        <div style={{ display: "grid", gap: 10 }}>
          <ResultCard
            titulo="Bruto / mês"
            valor={resultado.brutoMes}
            valorEur={toEur(resultado.brutoMes)}
            descricao="Rendimento mensal sem desconto de IR."
            cor={T.muted}
          />
          <ResultCard
            titulo="Líquido / mês (saca tudo)"
            valor={resultado.liquidoMes}
            valorEur={toEur(resultado.liquidoMes)}
            descricao="Quanto você pode retirar todo mês, descontado o IR."
            cor={T.gold}
            destaque
          />
          <ResultCard
            titulo="Renda real / mês (preserva)"
            valor={resultado.rendaRealMes}
            valorEur={toEur(resultado.rendaRealMes)}
            descricao={resultado.rendaRealMes > 0
              ? "Quanto retirar mantendo o poder de compra do principal."
              : "A inflação consome todo o rendimento líquido — preservação inviável neste cenário."}
            cor={resultado.rendaRealMes > 0 ? T.green : T.red}
          />
        </div>
      </div>

      {/* Rodapé */}
      <div style={{
        marginTop: 16, padding: 12,
        background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6,
        fontSize: 11.5, color: T.muted, lineHeight: 1.55, fontStyle: "italic",
      }}>
        "Saca tudo" retira todo o rendimento líquido; o patrimônio perde poder de
        compra com a inflação. "Preserva" retira só o juro real, mantendo o valor
        de compra. Estimativa educativa, não é recomendação de investimento.
      </div>

      <style>{`
        @media (max-width: 768px) {
          .calc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display }) {
  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 6, gap: 10,
      }}>
        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>{label}</span>
        <span className="num" style={{
          fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.gold,
        }}>
          {display}
        </span>
      </div>
      <input type="range"
             min={min} max={max} step={step}
             value={value}
             onChange={e => onChange(Number(e.target.value))}
             style={{
               width: "100%",
               accentColor: T.gold,
               cursor: "pointer",
             }} />
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 9.5, color: T.faint, marginTop: 2,
      }}>
        <span>{formatRange(min, label)}</span>
        <span>{formatRange(max, label)}</span>
      </div>
    </div>
  );
}

function formatRange(v, label) {
  if (label === "Valor investido") return fmtBRL.format(v);
  if (label === "Câmbio (R$ por €)") return `R$ ${v.toFixed(2)}`;
  return `${v}%`;
}

function ResultCard({ titulo, valor, valorEur, descricao, cor, destaque }) {
  return (
    <div style={{
      background: T.card,
      border: `1px solid ${destaque ? cor : T.border}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 8, padding: 16,
    }}>
      <div className="label-eyebrow" style={{ color: cor, marginBottom: 6 }}>
        {titulo}
      </div>
      <div className="num" style={{
        fontFamily: T.serif, fontSize: 28, fontWeight: 600, color: T.ink,
        letterSpacing: "-0.01em", lineHeight: 1,
      }}>
        {fmtBRL.format(valor)}
      </div>
      <div className="num" style={{
        fontSize: 13, color: T.muted, marginTop: 4,
      }}>
        ≈ {fmtEUR.format(valorEur)}
      </div>
      <div style={{
        fontSize: 11.5, color: T.faint, marginTop: 8, lineHeight: 1.45,
      }}>
        {descricao}
      </div>
    </div>
  );
}

function RowSmall({ label, value, cor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span>{label}:</span>
      <span className="num" style={{ color: cor || "var(--tx)", fontWeight: 500 }}>{value}</span>
    </div>
  );
}
