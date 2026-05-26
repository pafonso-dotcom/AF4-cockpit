import React, { useMemo, useState } from "react";
import { Calculator, RefreshCw, Info } from "lucide-react";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
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
  taxaAnualPct: 13.25,
  irPct: 0,
  inflacaoPct: 4.5,
  cambio: 5.84,
};

const ATALHOS = [
  { id: "selic",   label: "Tesouro Selic",      taxa: 14.50, ir: 15 },
  { id: "cdb100",  label: "CDB 100% CDI",       taxa: 14.40, ir: 15 },
  { id: "cdb110",  label: "CDB 110% CDI",       taxa: 15.84, ir: 15 },
  { id: "lci92",   label: "LCI / LCA 92% CDI",  taxa: 13.25, ir: 0  },
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

  // ===== Evolução do patrimônio (30 anos) =====
  // Mostra o PODER DE COMPRA do patrimônio em cada cenário, em R$ de hoje.
  //   Saca tudo: principal nominal constante, mas valor real cai com inflação.
  //   Preserva:  retira só o juro real → valor real fica constante.
  //   Reinveste: não saca nada → valor real cresce na taxa real composta.
  const evolucao = useMemo(() => {
    const anos = 30;
    const inflacao = inflacaoPct / 100;
    const taxaReal = resultado.taxaRealAnual;
    const taxaRealMensal = taxaReal > 0 ? Math.pow(1 + taxaReal, 1 / 12) - 1 : 0;
    const data = [];

    // Reserva: dinheiro sacado mensalmente acumulado e reinvestido na mesma
    // taxa real. Em valor de hoje, cresce mês a mês até virar uma segunda
    // fonte de renda paralela ao principal.
    let reservaAcumulada = 0;
    for (let n = 0; n <= anos; n++) {
      data.push({
        ano: n,
        sacaTudo:  valor / Math.pow(1 + inflacao, n),                                  // valor REAL
        preserva:  valor,                                                              // mantém
        reinveste: taxaReal > 0 ? valor * Math.pow(1 + taxaReal, n) : valor,           // cresce real
        // Total = principal preservado + reserva acumulada (em R$ de hoje)
        comReserva: valor + reservaAcumulada,
        reservaAno: reservaAcumulada,
      });
      // Avança 12 meses (cada mês adiciona o saque ideal + rende a taxa real)
      if (n < anos) {
        for (let m = 0; m < 12; m++) {
          reservaAcumulada = reservaAcumulada * (1 + taxaRealMensal) + resultado.rendaRealMes;
        }
      }
    }
    return data;
  }, [valor, inflacaoPct, resultado.taxaRealAnual, resultado.rendaRealMes]);

  // Marca um exemplo notável (em 10 e 30 anos) pra mostrar no insight
  const insight = useMemo(() => {
    const inflacao = inflacaoPct / 100;
    const reduz10 = valor - valor / Math.pow(1 + inflacao, 10);
    const reduz30 = valor - valor / Math.pow(1 + inflacao, 30);
    return { reduz10, reduz30 };
  }, [valor, inflacaoPct]);

  // Projeção da reserva: se o usuário poupar TODO o saque ideal mês a mês,
  // o quanto vira (em R$ de hoje) em 10, 20 e 30 anos + renda extra
  // que essa reserva geraria sozinha (à mesma taxa real).
  const reserva = useMemo(() => {
    const taxaReal = resultado.taxaRealAnual;
    const taxaRealMensal = taxaReal > 0 ? Math.pow(1 + taxaReal, 1 / 12) - 1 : 0;
    const proj = {};
    let acumulado = 0;
    for (let n = 1; n <= 30; n++) {
      for (let m = 0; m < 12; m++) {
        acumulado = acumulado * (1 + taxaRealMensal) + resultado.rendaRealMes;
      }
      if (n === 10 || n === 20 || n === 30) {
        proj[n] = acumulado;
      }
    }
    // Renda extra que a reserva em 30 anos geraria (a taxa real mensal)
    const rendaExtra30 = (proj[30] || 0) * taxaRealMensal;
    return { ...proj, rendaExtra30 };
  }, [resultado.taxaRealAnual, resultado.rendaRealMes]);

  return (
    <div className="fade-up py-8 px-6 calc-root">
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
        <div className="calc-atalhos" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ATALHOS.map(a => {
            const ativo = Math.abs(taxaAnualPct - a.taxa) < 0.05 && Math.abs(irPct - a.ir) < 0.05;
            return (
              <button key={a.id} onClick={() => aplicarAtalho(a)}
                className="calc-atalho-btn"
                style={{
                  padding: "8px 14px", borderRadius: 6, cursor: "pointer",
                  fontSize: 12, fontWeight: 500,
                  background: ativo ? `${T.gold}22` : T.card,
                  color: ativo ? T.gold : T.ink,
                  border: `1px solid ${ativo ? T.gold : T.border}`,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                <span>{a.label}</span>
                <span className="calc-atalho-meta" style={{ color: T.muted, fontSize: 11 }}>
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
        <div className="calc-card" style={{
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
            min={5} max={20} step={0.01}
            onChange={setTaxa}
            display={`${taxaAnualPct.toFixed(2)} %`}
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

        {/* Coluna direita: cartão de destaque (valor ideal) + 3 cartões de saída */}
        <div style={{ display: "grid", gap: 10 }}>
          {/* DESTAQUE: valor ideal de saque (preserva o principal contra inflação) */}
          <ValorIdealCard
            valor={resultado.rendaRealMes}
            valorEur={toEur(resultado.rendaRealMes)}
            valorAnual={resultado.rendaRealMes * 12}
            valorAnualEur={toEur(resultado.rendaRealMes * 12)}
            liquidoMes={resultado.liquidoMes}
            taxaRealAnual={resultado.taxaRealAnual}
            viavel={resultado.rendaRealMes > 0}
          />

          {/* BÔNUS: se você poupar o saque ideal todo mês, ele acumula
              uma reserva paralela que também rende. */}
          {resultado.rendaRealMes > 0 && (
            <ReservaCard
              em10={reserva[10] || 0}
              em20={reserva[20] || 0}
              em30={reserva[30] || 0}
              rendaExtra30={reserva.rendaExtra30 || 0}
              em10Eur={toEur(reserva[10] || 0)}
              em30Eur={toEur(reserva[30] || 0)}
              rendaExtra30Eur={toEur(reserva.rendaExtra30 || 0)}
              valorIdeal={resultado.rendaRealMes}
            />
          )}

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

      {/* GRÁFICO: evolução do poder de compra (30 anos) */}
      <div style={{
        marginTop: 14, padding: 14,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="label-eyebrow">Evolução do patrimônio · 30 anos</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, fontStyle: "italic" }}>
              Valores em R$ de hoje (descontada a inflação).
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: T.muted, flexWrap: "wrap" }}>
            <LegendDot cor={T.red}   label="Saca tudo" />
            <LegendDot cor={T.gold}  label="Preserva" />
            <LegendDot cor={T.green} label="Reinveste tudo" />
            <LegendDot cor={T.blue || "#60a5fa"} label="Preserva + reserva" />
          </div>
        </div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <LineChart data={evolucao} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="ano"
                     tick={{ fill: T.muted, fontSize: 10 }}
                     stroke={T.border}
                     tickFormatter={v => v === 0 ? "Hoje" : `${v}a`}
                     interval={4} />
              <YAxis tick={{ fill: T.muted, fontSize: 10 }}
                     stroke={T.border}
                     tickFormatter={v => `${(v / 1_000_000).toFixed(1)}M`} />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11, color: T.ink }}
                labelStyle={{ color: T.muted, marginBottom: 4 }}
                labelFormatter={(v) => v === 0 ? "Hoje" : `Em ${v} ano${v > 1 ? "s" : ""}`}
                formatter={(v, k) => {
                  const labels = {
                    sacaTudo: "Saca tudo",
                    preserva: "Preserva",
                    reinveste: "Reinveste tudo",
                    comReserva: "Preserva + reserva",
                  };
                  return [fmtBRL.format(v), labels[k] || k];
                }}
              />
              <Line type="monotone" dataKey="sacaTudo"   stroke={T.red}   strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="preserva"   stroke={T.gold}  strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="comReserva" stroke={T.blue || "#60a5fa"} strokeWidth={2} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" dataKey="reinveste" stroke={T.green} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{
          marginTop: 8, padding: 10, background: `${T.red}11`,
          border: `1px solid ${T.red}33`, borderRadius: 6,
          fontSize: 12, color: T.muted, lineHeight: 1.5,
        }}>
          <strong style={{ color: T.red }}>⚠ Se você sacar tudo:</strong> em 10 anos o
          patrimônio vale <strong className="num" style={{ color: T.ink }}>
            {fmtBRL.format(insight.reduz10 > 0 ? valor - insight.reduz10 : valor)}
          </strong> em poder de compra (perdeu {fmtBRL.format(insight.reduz10)} pra inflação).
          Em 30 anos, vale só <strong className="num" style={{ color: T.ink }}>
            {fmtBRL.format(valor - insight.reduz30)}
          </strong> de hoje.
        </div>
      </div>

      {/* COMO INTERPRETAR — conselhos sobre os cenários */}
      <div style={{
        marginTop: 14, padding: 14,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
      }}>
        <div className="label-eyebrow" style={{ marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Info size={11} style={{ color: T.gold }} />
          Como interpretar os cenários
        </div>
        <div style={{ display: "grid", gap: 10, fontSize: 12.5, color: T.ink, lineHeight: 1.55 }}>
          <DicaItem cor={T.muted} titulo="Bruto / mês">
            O rendimento <em>antes do imposto</em>. Útil pra ver o tamanho do
            rendimento total que o investimento gera; é o teto.
          </DicaItem>
          <DicaItem cor={T.gold} titulo="Líquido / mês (saca tudo)">
            O que efetivamente <em>cai na sua conta</em> se você retirar todo o
            rendimento. <strong>Cuidado:</strong> nesse cenário o patrimônio nominal
            fica parado, mas em poder de compra ele <strong>encolhe</strong> ano após
            ano pela inflação.
          </DicaItem>
          <DicaItem cor={T.green} titulo="Renda real / mês (preserva)">
            Quanto você pode sacar <strong>mantendo o valor de compra</strong> do
            principal intacto ao longo do tempo. É o cenário sustentável — você nunca
            "consome" o patrimônio, só os juros reais (acima da inflação).
          </DicaItem>
          <div style={{
            marginTop: 4, padding: 10, background: T.bgSoft, borderRadius: 6,
            fontSize: 11.5, color: T.muted,
          }}>
            <strong style={{ color: T.ink }}>Exemplo</strong> com os defaults
            (R$ 3 mi, 14,4% a.a., IR 15%, inflação 4,5%): "saca tudo" gira ~R$ 28.700/mês
            e "preserva" fica perto de R$ 19–20 mil/mês. <strong>A diferença é exatamente
            o que a inflação está comendo do seu principal</strong> — ela parece pequena
            no mês, mas no gráfico acima dá pra ver o tamanho real do prejuízo em 10/30
            anos se você não reinvestir nada.
          </div>
        </div>
      </div>

      {/* Rodapé (disclaimer) */}
      <div style={{
        marginTop: 14, padding: 12,
        background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 6,
        fontSize: 11.5, color: T.muted, lineHeight: 1.55, fontStyle: "italic",
      }}>
        Cenários usam CDI a ~14,4% a.a. como base. "Saca tudo" retira todo o
        rendimento líquido; o patrimônio perde poder de compra com a inflação.
        "Preserva" retira só o juro real, mantendo o valor de compra. LCI/LCA têm
        limite de garantia FGC de R$ 250 mil por banco e carência. Estimativa
        educativa, não é recomendação de investimento.
      </div>

      <style>{`
        @media (max-width: 768px) {
          .calc-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          /* Reduz padding lateral da página inteira */
          .calc-root { padding-left: 14px !important; padding-right: 14px !important; padding-top: 18px !important; padding-bottom: 24px !important; }
          /* Atalhos: 2x2 grid em vez de 4 linhas */
          .calc-atalhos { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 6px !important; }
          .calc-atalho-btn { padding: 7px 8px !important; font-size: 11px !important; gap: 4px !important; justify-content: center !important; }
          .calc-atalho-meta { display: none !important; }
          /* Slider: número menor pra não cortar */
          .calc-slider-value { font-size: 13.5px !important; white-space: nowrap !important; }
          .calc-slider-label { font-size: 11.5px !important; }
          .calc-slider-range { font-size: 9px !important; }
          /* Card interno: padding menor */
          .calc-card { padding: 12px !important; gap: 14px !important; }
          /* Cartões de resultado mais compactos */
          .calc-result-card { padding: 12px !important; }
          .calc-result-value { font-size: 22px !important; }
          .calc-result-value-eur { font-size: 12px !important; }
          .calc-ideal-value { font-size: 30px !important; }
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
        <span className="calc-slider-label" style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>{label}</span>
        <span className="num calc-slider-value" style={{
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
      <div className="calc-slider-range" style={{
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

function ValorIdealCard({ valor, valorEur, valorAnual, valorAnualEur, liquidoMes, taxaRealAnual, viavel }) {
  // Diferença entre "saca tudo" e "valor ideal" = quanto a inflação consumiria
  const inflacaoConsome = Math.max(0, liquidoMes - valor);
  const pctIdeal = liquidoMes > 0 ? (valor / liquidoMes) * 100 : 0;

  return (
    <div style={{
      background: viavel
        ? `linear-gradient(135deg, ${T.green}22 0%, ${T.green}08 60%, ${T.card} 100%)`
        : `linear-gradient(135deg, ${T.red}22 0%, ${T.red}08 60%, ${T.card} 100%)`,
      border: `1px solid ${viavel ? T.green : T.red}`,
      borderLeft: `4px solid ${viavel ? T.green : T.red}`,
      borderRadius: 10, padding: 18,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 12, right: 14,
        fontSize: 9, padding: "3px 8px", borderRadius: 100,
        background: viavel ? T.green : T.red, color: T.bg,
        fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
      }}>
        💎 Ideal
      </div>

      <div className="label-eyebrow" style={{ color: viavel ? T.green : T.red, marginBottom: 6 }}>
        Valor ideal de saque mensal
      </div>

      <div className="num calc-ideal-value" style={{
        fontFamily: T.serif, fontSize: 38, fontWeight: 700, color: T.ink,
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>
        {fmtBRL.format(valor)}
      </div>
      <div className="num" style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>
        ≈ {fmtEUR.format(valorEur)}
      </div>

      {viavel ? (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
            marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${T.green}55`,
          }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, marginBottom: 2 }}>
                Por ano
              </div>
              <div className="num" style={{ fontSize: 15, color: T.ink, fontWeight: 600 }}>
                {fmtBRL.format(valorAnual)}
              </div>
              <div className="num" style={{ fontSize: 11, color: T.muted }}>
                ≈ {fmtEUR.format(valorAnualEur)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, marginBottom: 2 }}>
                Taxa real
              </div>
              <div className="num" style={{ fontSize: 15, color: T.green, fontWeight: 600 }}>
                {(taxaRealAnual * 100).toFixed(2)}% a.a.
              </div>
              <div style={{ fontSize: 11, color: T.muted }}>
                acima da inflação
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 12, padding: 10, background: `${T.green}11`,
            border: `1px solid ${T.green}33`, borderRadius: 6,
            fontSize: 12, color: T.ink, lineHeight: 1.5,
          }}>
            💡 <strong>Sacar até este valor todo mês mantém o poder de
            compra do seu patrimônio intacto</strong> ao longo do tempo.
            {inflacaoConsome > 1 && (
              <span style={{ color: T.muted, display: "block", marginTop: 4 }}>
                Sacar acima disso ({fmtBRL.format(liquidoMes)} no "saca tudo") faz a
                inflação corroer ~{fmtBRL.format(inflacaoConsome)}/mês do principal.
                Este valor ideal é {pctIdeal.toFixed(0)}% do líquido.
              </span>
            )}
          </div>
        </>
      ) : (
        <div style={{
          marginTop: 12, padding: 10, background: `${T.red}11`,
          border: `1px solid ${T.red}33`, borderRadius: 6,
          fontSize: 12, color: T.ink, lineHeight: 1.5,
        }}>
          ⚠ <strong>Cenário inviável pra preservar o patrimônio:</strong>{" "}
          a inflação ({(taxaRealAnual * -100).toFixed(2)}% acima da taxa real) consome
          todo o rendimento líquido. Qualquer saque vai reduzir o poder de compra do
          principal. Considere aumentar a taxa (com mais risco) ou aceitar que o
          patrimônio vai encolher em valor real.
        </div>
      )}
    </div>
  );
}

function ReservaCard({ em10, em20, em30, rendaExtra30, em10Eur, em30Eur, rendaExtra30Eur, valorIdeal }) {
  const cor = T.blue || "#60a5fa";
  return (
    <div style={{
      background: `linear-gradient(135deg, ${cor}22 0%, ${cor}08 60%, ${T.card} 100%)`,
      border: `1px solid ${cor}`,
      borderLeft: `4px solid ${cor}`,
      borderRadius: 10, padding: 16,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 12, right: 14,
        fontSize: 9, padding: "3px 8px", borderRadius: 100,
        background: cor, color: T.bg,
        fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
      }}>
        🪙 Bônus
      </div>

      <div className="label-eyebrow" style={{ color: cor, marginBottom: 6 }}>
        Reserva acumulada — se você poupar o saque ideal
      </div>

      <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 10, lineHeight: 1.45, fontStyle: "italic" }}>
        Sacando {fmtBRL.format(valorIdeal)}/mês mas reinvestindo cada saque (mesma taxa real),
        você acumula uma segunda fonte de patrimônio em valor de hoje.
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10,
        marginBottom: 12,
      }}>
        <ReservaCol anos="10 anos" valor={em10} cor={cor} />
        <ReservaCol anos="20 anos" valor={em20} cor={cor} />
        <ReservaCol anos="30 anos" valor={em30} cor={cor} destaque />
      </div>

      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>
        ≈ {fmtEUR.format(em30Eur)} em 30 anos · começa em {fmtEUR.format(em10Eur)} em 10 anos
      </div>

      {rendaExtra30 > 0 && (
        <div style={{
          marginTop: 12, padding: 10, background: `${cor}15`,
          border: `1px solid ${cor}33`, borderRadius: 6,
          fontSize: 12, color: T.ink, lineHeight: 1.5,
        }}>
          💡 <strong>Em 30 anos</strong>, essa reserva sozinha geraria mais{" "}
          <strong className="num" style={{ color: cor }}>{fmtBRL.format(rendaExtra30)}/mês</strong>{" "}
          de renda (~{fmtEUR.format(rendaExtra30Eur)}/mês) — somando ao saque original,
          sua renda mensal total no fim do período seria{" "}
          <strong className="num" style={{ color: cor }}>
            {fmtBRL.format(valorIdeal + rendaExtra30)}/mês
          </strong>.
        </div>
      )}
    </div>
  );
}

function ReservaCol({ anos, valor, cor, destaque }) {
  return (
    <div style={{
      padding: 8, borderRadius: 6,
      background: destaque ? `${cor}15` : "transparent",
      border: destaque ? `1px solid ${cor}33` : "1px solid transparent",
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, marginBottom: 3 }}>
        {anos}
      </div>
      <div className="num" style={{
        fontFamily: T.serif,
        fontSize: destaque ? 18 : 15,
        fontWeight: 600, color: destaque ? cor : T.ink,
      }}>
        {fmtBRL.format(valor)}
      </div>
    </div>
  );
}

function ResultCard({ titulo, valor, valorEur, descricao, cor, destaque }) {
  return (
    <div className="calc-result-card" style={{
      background: T.card,
      border: `1px solid ${destaque ? cor : T.border}`,
      borderLeft: `3px solid ${cor}`,
      borderRadius: 8, padding: 16,
    }}>
      <div className="label-eyebrow" style={{ color: cor, marginBottom: 6 }}>
        {titulo}
      </div>
      <div className="num calc-result-value" style={{
        fontFamily: T.serif, fontSize: 28, fontWeight: 600, color: T.ink,
        letterSpacing: "-0.01em", lineHeight: 1,
      }}>
        {fmtBRL.format(valor)}
      </div>
      <div className="num calc-result-value-eur" style={{
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

function LegendDot({ cor, label }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 8, height: 8, borderRadius: 2, background: cor, display: "inline-block" }} />
      {label}
    </span>
  );
}

function DicaItem({ cor, titulo, children }) {
  return (
    <div style={{
      paddingLeft: 12, borderLeft: `3px solid ${cor}`,
    }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: cor, marginBottom: 3 }}>
        {titulo}
      </div>
      <div>{children}</div>
    </div>
  );
}
