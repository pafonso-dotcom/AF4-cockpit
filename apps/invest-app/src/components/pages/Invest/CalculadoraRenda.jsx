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
 * Todos os valores recalculam ao vivo conforme o usuário move os sliders.
 */

const DEFAULTS = {
  valor: 0,
  taxaAnualPct: 13.25,
  irPct: 0,
  inflacaoPct: 4.5,
};

const ATALHOS = [
  // Renda fixa básica (CDI ≈ 14,40% a.a.)
  { id: "selic",      label: "Tesouro Selic",     taxa: 14.50, ir: 15, grupo: "rf" },
  { id: "cdb100",     label: "CDB 100% CDI",      taxa: 14.40, ir: 15, grupo: "rf" },
  { id: "cdb110",     label: "CDB 110% CDI",      taxa: 15.84, ir: 15, grupo: "rf" },
  { id: "cdb120",     label: "CDB 120% CDI",      taxa: 17.28, ir: 15, grupo: "rf" },
  // Isentos de IR
  { id: "lci92",      label: "LCI / LCA 92% CDI", taxa: 13.25, ir: 0,  grupo: "isento" },
  { id: "lci97",      label: "LCI / LCA 97% CDI", taxa: 13.97, ir: 0,  grupo: "isento" },
  { id: "lca100",     label: "LCA 100% CDI",      taxa: 14.40, ir: 0,  grupo: "isento" },
  { id: "cri-cra",    label: "CRI / CRA prefix.", taxa: 13.50, ir: 0,  grupo: "isento" },
  // Tesouro IPCA+ (taxa nominal projetada com IPCA 4,5%)
  { id: "ipca-curto", label: "Tesouro IPCA+ 2029", taxa: 11.20, ir: 15, grupo: "ipca" },
  { id: "ipca-longo", label: "Tesouro IPCA+ 2045", taxa: 11.80, ir: 15, grupo: "ipca" },
  // Cenários históricos / referência
  { id: "hist-selic-baixa",  label: "Hist · Selic 2% (2020)", taxa: 2.0,  ir: 15, grupo: "hist" },
  { id: "hist-selic-alta",   label: "Hist · Selic 14% (2024)", taxa: 14.0, ir: 15, grupo: "hist" },
  // Renda variável (estimativa simplificada — usa taxa nominal só pra simular)
  { id: "rv-conservador", label: "RV conservador (10%)", taxa: 10.0, ir: 15, grupo: "rv" },
  { id: "rv-moderado",    label: "RV moderado (15%)",    taxa: 15.0, ir: 15, grupo: "rv" },
  { id: "rv-agressivo",   label: "RV agressivo (20%)",   taxa: 20.0, ir: 15, grupo: "rv" },
];

const GRUPOS = [
  { id: "rf",     label: "Renda fixa",        cor: null }, // gold (default)
  { id: "isento", label: "Isentos de IR",     cor: "#22c55e" },
  { id: "ipca",   label: "Tesouro IPCA+",     cor: "#06b6d4" },
  { id: "hist",   label: "Histórico (ref.)",  cor: "#9ca3af" },
  { id: "rv",     label: "Renda variável",    cor: "#a78bfa" },
];

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});

export default function CalculadoraRenda() {
  const [valor, setValor]             = useState(DEFAULTS.valor);
  const [taxaAnualPct, setTaxa]       = useState(DEFAULTS.taxaAnualPct);
  const [irPct, setIr]                = useState(DEFAULTS.irPct);
  const [inflacaoPct, setInflacao]    = useState(DEFAULTS.inflacaoPct);
  const [horizonteAnos, setHorizonte] = useState(30);
  const [cenariosAberto, setCenariosAberto] = useState(false);

  // Pontos de snapshot (terços): pra horizonte=30 → 10/20/30; 20 → 7/14/20; etc.
  const snap1 = Math.max(1, Math.round(horizonteAnos / 3));
  const snap2 = Math.max(snap1 + 1, Math.round((2 * horizonteAnos) / 3));
  const snap3 = horizonteAnos;

  const resetTudo = () => {
    setValor(DEFAULTS.valor);
    setTaxa(DEFAULTS.taxaAnualPct);
    setIr(DEFAULTS.irPct);
    setInflacao(DEFAULTS.inflacaoPct);
    setHorizonte(30);
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

  // ===== Evolução do patrimônio (horizonteAnos) =====
  // Mostra o PODER DE COMPRA do patrimônio em cada cenário, em R$ de hoje.
  //   Saca tudo: principal nominal constante, mas valor real cai com inflação.
  //   Preserva:  retira só o juro real → valor real fica constante.
  //   Reinveste: não saca nada → valor real cresce na taxa real composta.
  const evolucao = useMemo(() => {
    const anos = horizonteAnos;
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
  }, [valor, inflacaoPct, resultado.taxaRealAnual, resultado.rendaRealMes, horizonteAnos]);

  // Marca um exemplo notável (no meio do horizonte e no fim) pra insight
  const insight = useMemo(() => {
    const inflacao = inflacaoPct / 100;
    const meio = Math.max(1, Math.round(horizonteAnos / 3));
    const reduzMeio = valor - valor / Math.pow(1 + inflacao, meio);
    const reduzFim = valor - valor / Math.pow(1 + inflacao, horizonteAnos);
    return { reduzMeio, reduzFim, anoMeio: meio, anoFim: horizonteAnos };
  }, [valor, inflacaoPct, horizonteAnos]);

  // Reinvestir tudo (não sacar nada): patrimônio cresce por juros compostos na
  // taxa líquida (após IR). Nominal + real (poder de compra) em snap1/2/3.
  const reinvestir = useMemo(() => {
    const tLiq = resultado.taxaLiquidaAnual;
    const inflacao = inflacaoPct / 100;
    const proj = {};
    [snap1, snap2, snap3].forEach(n => {
      const nominal = valor * Math.pow(1 + tLiq, n);
      const real = nominal / Math.pow(1 + inflacao, n);
      proj[n] = { nominal, real };
    });
    return proj;
  }, [valor, resultado.taxaLiquidaAnual, inflacaoPct, snap1, snap2, snap3]);



  return (
    <div className="fade-up py-6 px-6 calc-root">
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

      {/* Botão único de cenários — abre popover com os 5 grupos colapsados */}
      <div style={{ marginBottom: 10, position: "relative" }}>
        {(() => {
          const cenarioAtivo = ATALHOS.find(a =>
            Math.abs(taxaAnualPct - a.taxa) < 0.05 && Math.abs(irPct - a.ir) < 0.05
          );
          const corAtivo = cenarioAtivo
            ? (GRUPOS.find(g => g.id === cenarioAtivo.grupo)?.cor || T.gold)
            : T.gold;
          return (
            <button
              onClick={() => setCenariosAberto(v => !v)}
              style={{
                padding: "6px 12px", borderRadius: 6, cursor: "pointer",
                fontSize: 11.5, fontWeight: 600,
                background: cenarioAtivo ? `${corAtivo}22` : T.bgSoft,
                color: cenarioAtivo ? corAtivo : T.ink,
                border: `1px solid ${cenarioAtivo ? corAtivo : T.border}`,
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
              <Calculator size={12} />
              <span>{cenarioAtivo ? cenarioAtivo.label : "Cenários rápidos"}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>
                {cenariosAberto ? "▴" : "▾"}
              </span>
            </button>
          );
        })()}

        {cenariosAberto && (
          <>
            {/* Overlay invisível pra fechar ao clicar fora */}
            <div
              onClick={() => setCenariosAberto(false)}
              style={{
                position: "fixed", inset: 0, zIndex: 5,
              }}
            />
            <div style={{
              position: "absolute", top: "100%", left: 0, marginTop: 6, zIndex: 10,
              background: T.card, border: `1px solid ${T.border}`,
              borderRadius: 8, padding: 10,
              boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
              maxWidth: 540, width: "max-content",
              maxHeight: "70vh", overflowY: "auto",
            }}>
              {GRUPOS.map(g => {
                const itensDoGrupo = ATALHOS.filter(a => a.grupo === g.id);
                if (itensDoGrupo.length === 0) return null;
                const corGrupo = g.cor || T.gold;
                return (
                  <div key={g.id} style={{ marginBottom: 8 }}>
                    <div style={{
                      fontSize: 9, color: corGrupo, fontWeight: 700,
                      letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 4,
                    }}>
                      {g.label}
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {itensDoGrupo.map(a => {
                        const ativo = Math.abs(taxaAnualPct - a.taxa) < 0.05 && Math.abs(irPct - a.ir) < 0.05;
                        return (
                          <button key={a.id} onClick={() => { aplicarAtalho(a); setCenariosAberto(false); }}
                            style={{
                              padding: "4px 8px", borderRadius: 5, cursor: "pointer",
                              fontSize: 11, fontWeight: 500,
                              background: ativo ? `${corGrupo}22` : T.bgSoft,
                              color: ativo ? corGrupo : T.ink,
                              border: `1px solid ${ativo ? corGrupo : T.border}`,
                              display: "inline-flex", alignItems: "center", gap: 4,
                              whiteSpace: "nowrap",
                            }}>
                            <span>{a.label}</span>
                            <span style={{ color: T.muted, fontSize: 10 }}>
                              · {a.taxa}% · IR {a.ir}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* SLIDERS em linha (grid responsivo) */}
      <div className="calc-card" style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 12, marginBottom: 10,
      }}>
        <div className="calc-sliders-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16,
        }}>
          <ValorInvestidoInput valor={valor} onChange={setValor} />
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
            label="Horizonte (anos)"
            value={horizonteAnos}
            min={5} max={50} step={1}
            onChange={setHorizonte}
            display={`${horizonteAnos} anos`}
          />
        </div>

        {/* Mini-resumo das taxas derivadas */}
        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}`,
          display: "flex", gap: 24, fontSize: 11, color: T.muted, flexWrap: "wrap",
        }}>
          <RowSmall label="Taxa líquida ao ano" value={`${(resultado.taxaLiquidaAnual * 100).toFixed(2)} %`} />
          <RowSmall label="Taxa real ao ano (após inflação)"
                    value={`${(resultado.taxaRealAnual * 100).toFixed(2)} %`}
                    cor={resultado.taxaRealAnual >= 0 ? T.green : T.red} />
        </div>
      </div>

      {/* CARDS de destaque em linha */}
      <div className="calc-cards-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 10,
        alignItems: "start",
      }}>
        {/* DESTAQUE: valor ideal de saque (preserva o principal contra inflação) */}
        <ValorIdealCard
          valor={resultado.rendaRealMes}
          valorAnual={resultado.rendaRealMes * 12}
          liquidoMes={resultado.liquidoMes}
          taxaRealAnual={resultado.taxaRealAnual}
          viavel={resultado.rendaRealMes > 0}
        />

        {/* Se NÃO sacar nada e deixar tudo rendendo (juros compostos). */}
        <ReinvestirCard
          principal={valor}
          snap1Anos={snap1}
          snap2Anos={snap2}
          snap3Anos={snap3}
          reinveste={reinvestir}
          taxaLiquidaAnual={resultado.taxaLiquidaAnual}
        />
      </div>

      {/* CARTÕES de saída (bruto / líquido / renda real) em linha */}
      <div className="calc-cards-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, marginBottom: 10,
      }}>
        <ResultCard
          titulo="Bruto / mês"
          valor={resultado.brutoMes}
          descricao="Rendimento mensal sem desconto de IR."
          cor={T.muted}
        />
        <ResultCard
          titulo="Líquido / mês (saca tudo)"
          valor={resultado.liquidoMes}
          descricao="Quanto você pode retirar todo mês, descontado o IR."
          cor={T.gold}
          destaque
        />
        <ResultCard
          titulo="Renda real / mês (preserva)"
          valor={resultado.rendaRealMes}
          descricao={resultado.rendaRealMes > 0
            ? "Quanto retirar mantendo o poder de compra do principal."
            : "A inflação consome todo o rendimento líquido — preservação inviável neste cenário."}
          cor={resultado.rendaRealMes > 0 ? T.green : T.red}
        />
      </div>

      {/* GRÁFICO: evolução do poder de compra (30 anos) */}
      <div style={{
        marginTop: 14, padding: 14,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="label-eyebrow">Evolução do patrimônio · {horizonteAnos} anos</div>
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
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <LineChart data={evolucao} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="ano"
                     tick={{ fill: T.muted, fontSize: 10 }}
                     stroke={T.border}
                     tickFormatter={v => v === 0 ? "Hoje" : `${v}a`}
                     interval={Math.max(1, Math.floor(horizonteAnos / 7))} />
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
          <strong style={{ color: T.red }}>⚠ Se você sacar tudo:</strong> em {insight.anoMeio} anos o
          patrimônio vale <strong className="num" style={{ color: T.ink }}>
            {fmtBRL.format(insight.reduzMeio > 0 ? valor - insight.reduzMeio : valor)}
          </strong> em poder de compra (perdeu {fmtBRL.format(insight.reduzMeio)} pra inflação).
          Em {insight.anoFim} anos, vale só <strong className="num" style={{ color: T.ink }}>
            {fmtBRL.format(valor - insight.reduzFim)}
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
        @media (max-width: 980px) {
          .calc-sliders-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .calc-cards-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          .calc-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .calc-sliders-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
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

// Campo digitável para o valor investido (substitui a régua/slider).
function ValorInvestidoInput({ valor, onChange }) {
  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 6, gap: 10,
      }}>
        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>Valor investido</span>
        <span className="num" style={{ fontFamily: T.serif, fontSize: 16, fontWeight: 600, color: T.gold }}>
          {fmtBRL.format(valor || 0)}
        </span>
      </div>
      <input
        type="number" inputMode="numeric" min={0} step={1000}
        value={valor || ""}
        onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
        placeholder="Digite o valor (ex.: 50000)"
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 8,
          border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink,
          fontSize: 15, fontFamily: T.serif,
        }}
      />
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
  if (label === "Horizonte (anos)") return `${v} anos`;
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
      borderLeft: `3px solid ${viavel ? T.green : T.red}`,
      borderRadius: 8, padding: 12,
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 8, right: 10,
        fontSize: 8.5, padding: "2px 6px", borderRadius: 100,
        background: viavel ? T.green : T.red, color: T.bg,
        fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase",
      }}>
        💎 Ideal
      </div>

      <div className="label-eyebrow" style={{ color: viavel ? T.green : T.red, marginBottom: 4 }}>
        Valor ideal de saque mensal
      </div>

      <div className="num calc-ideal-value" style={{
        fontFamily: T.serif, fontSize: 28, fontWeight: 700, color: T.ink,
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>
        {fmtBRL.format(valor)}
      </div>

      {viavel ? (
        <>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
            marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${T.green}55`,
          }}>
            <div>
              <div style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, marginBottom: 1 }}>
                Por ano
              </div>
              <div className="num" style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>
                {fmtBRL.format(valorAnual)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, letterSpacing: ".15em", textTransform: "uppercase", color: T.muted, marginBottom: 1 }}>
                Taxa real
              </div>
              <div className="num" style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>
                {(taxaRealAnual * 100).toFixed(2)}% a.a.
              </div>
              <div style={{ fontSize: 10, color: T.muted }}>
                acima da inflação
              </div>
            </div>
          </div>
          <div style={{
            marginTop: 8, padding: 8, background: `${T.green}11`,
            border: `1px solid ${T.green}33`, borderRadius: 6,
            fontSize: 11, color: T.ink, lineHeight: 1.4,
          }}>
            💡 <strong>Sacar até este valor todo mês mantém o poder de
            compra do seu patrimônio intacto</strong> ao longo do tempo.
            {inflacaoConsome > 1 && (
              <span style={{ color: T.muted, display: "block", marginTop: 3 }}>
                Sacar acima disso ({fmtBRL.format(liquidoMes)} no "saca tudo") faz a
                inflação corroer ~{fmtBRL.format(inflacaoConsome)}/mês do principal.
                Este valor ideal é {pctIdeal.toFixed(0)}% do líquido.
              </span>
            )}
          </div>
        </>
      ) : (
        <div style={{
          marginTop: 8, padding: 8, background: `${T.red}11`,
          border: `1px solid ${T.red}33`, borderRadius: 6,
          fontSize: 11, color: T.ink, lineHeight: 1.4,
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

function ReinvestirCard({ principal, snap1Anos, snap2Anos, snap3Anos, reinveste, taxaLiquidaAnual }) {
  const cor = "#22c55e";
  const p1 = reinveste[snap1Anos] || { nominal: principal, real: principal };
  const p2 = reinveste[snap2Anos] || { nominal: principal, real: principal };
  const p3 = reinveste[snap3Anos] || { nominal: principal, real: principal };
  const multiplicador = principal > 0 ? p3.real / principal : 1;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${cor}22 0%, ${cor}08 60%, ${T.card} 100%)`,
      border: `1px solid ${cor}`, borderLeft: `3px solid ${cor}`,
      borderRadius: 8, padding: 12, position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 8, right: 10, fontSize: 8.5, padding: "2px 6px",
        borderRadius: 100, background: cor, color: T.bg, fontWeight: 700,
        letterSpacing: ".12em", textTransform: "uppercase",
      }}>
        🚀 Reinveste
      </div>

      <div className="label-eyebrow" style={{ color: cor, marginBottom: 4 }}>
        Se você NÃO sacar (reinveste tudo)
      </div>

      <div style={{ fontSize: 11, color: T.muted, marginBottom: 10, lineHeight: 1.4, fontStyle: "italic" }}>
        Deixando o valor investido e os rendimentos rendendo juntos (juros compostos),
        seu patrimônio cresce assim — em poder de compra (R$ de hoje):
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
        <ReinvestCol anos={`${snap1Anos} anos`} valor={p1.real} cor={cor} />
        <ReinvestCol anos={`${snap2Anos} anos`} valor={p2.real} cor={cor} />
        <ReinvestCol anos={`${snap3Anos} anos`} valor={p3.real} cor={cor} destaque />
      </div>

      <div style={{
        fontSize: 11.5, color: T.ink, lineHeight: 1.5, marginTop: 8,
        background: `${cor}14`, border: `1px solid ${cor}44`, borderRadius: 6, padding: "8px 10px",
      }}>
        💡 Em <strong>{snap3Anos} anos</strong>, os {fmtBRL.format(principal)} investidos viram{" "}
        <strong className="num" style={{ color: cor }}>{fmtBRL.format(p3.real)}</strong>{" "}
        em poder de compra (≈ <strong>{multiplicador.toFixed(1)}×</strong> o valor inicial),
        sem você precisar aportar mais nada.
      </div>
    </div>
  );
}

function ReinvestCol({ anos, valor, cor, destaque }) {
  return (
    <div style={{
      padding: "6px 8px", borderRadius: 6, textAlign: "center",
      background: destaque ? `${cor}1c` : "transparent",
      border: destaque ? `1px solid ${cor}55` : `1px solid ${T.border}`,
    }}>
      <div style={{ fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: T.muted, marginBottom: 2 }}>
        {anos}
      </div>
      <div className="num" style={{ fontSize: 13, fontWeight: 600, color: destaque ? cor : T.ink }}>
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
      borderRadius: 8, padding: 10,
    }}>
      <div className="label-eyebrow" style={{ color: cor, marginBottom: 3 }}>
        {titulo}
      </div>
      <div className="num calc-result-value" style={{
        fontFamily: T.serif, fontSize: 20, fontWeight: 600, color: T.ink,
        letterSpacing: "-0.01em", lineHeight: 1,
      }}>
        {fmtBRL.format(valor)}
      </div>
      <div style={{
        fontSize: 10.5, color: T.faint, marginTop: 5, lineHeight: 1.4,
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
