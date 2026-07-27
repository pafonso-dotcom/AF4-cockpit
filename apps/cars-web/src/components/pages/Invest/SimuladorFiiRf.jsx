import React, { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";
import { simularFiiRf } from "../../../lib/simuladorFiiRf.js";

/**
 * Simulador FIIs × Renda Fixa — fase de ACUMULAÇÃO.
 *
 * Você aporta um valor todo mês por N meses. Compara dois caminhos (FII e
 * Renda Fixa) pela rentabilidade anual, mostra o patrimônio acumulado ao longo
 * do tempo, e — no fim do prazo — o patrimônio, a renda mensal que ele geraria
 * (vivendo do rendimento) e tudo corrigido pela inflação (poder de compra de
 * hoje). Complementa a "Calculadora de Renda", que parte de um capital pronto.
 */

const DEFAULTS = {
  aporteMensal: 1000,
  prazoMeses: 240,
  rentFiiAA: 10,
  rentRfAA: 13,
  inflacaoAA: 4.5,
};

const CORES = { fii: "#a78bfa", rf: T.gold };

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});

export default function SimuladorFiiRf({ embed = false } = {}) {
  const [aporteMensal, setAporte] = useState(DEFAULTS.aporteMensal);
  const [prazoMeses, setPrazo]    = useState(DEFAULTS.prazoMeses);
  const [rentFiiAA, setFii]       = useState(DEFAULTS.rentFiiAA);
  const [rentRfAA, setRf]         = useState(DEFAULTS.rentRfAA);
  const [inflacaoAA, setInflacao] = useState(DEFAULTS.inflacaoAA);

  const resetTudo = () => {
    setAporte(DEFAULTS.aporteMensal);
    setPrazo(DEFAULTS.prazoMeses);
    setFii(DEFAULTS.rentFiiAA);
    setRf(DEFAULTS.rentRfAA);
    setInflacao(DEFAULTS.inflacaoAA);
  };

  const r = useMemo(
    () => simularFiiRf({ aporteMensal, prazoMeses, rentFiiAA, rentRfAA, inflacaoAA, pontos: 8 }),
    [aporteMensal, prazoMeses, rentFiiAA, rentRfAA, inflacaoAA]
  );

  const anos = (prazoMeses / 12);
  const vencedorNome = r.vencedor === "fii" ? "FIIs" : r.vencedor === "rf" ? "Renda Fixa" : "Empate";
  const corVenc = r.vencedor === "fii" ? CORES.fii : r.vencedor === "rf" ? CORES.rf : T.muted;
  const diff = Math.abs(r.fii.patrimonio - r.rf.patrimonio);

  return (
    <div className={embed ? "sfr-root" : "fade-up py-6 px-6 sfr-root"}>
      {!embed && (
        <PageHeader
          eyebrow="Investimentos · Simulador"
          title="FIIs × Renda Fixa"
          sub="Você aporta todo mês. Veja quanto forma em FIIs vs Renda Fixa, a renda mensal no fim do prazo e o que a inflação preserva."
          action={
            <button onClick={resetTudo} className="btn-ghost" title="Restaurar defaults">
              <RefreshCw size={12} className="inline mr-1.5" /> Reset
            </button>
          }
        />
      )}

      {/* SLIDERS */}
      <div className="sfr-card" style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
        padding: 12, marginBottom: 10,
      }}>
        <div className="sfr-sliders-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16,
        }}>
          <CampoValor label="Aporte mensal" value={aporteMensal}
                      min={0} max={50_000} step={100} onChange={setAporte} />
          <Slider label="Prazo" value={prazoMeses} min={12} max={480} step={12}
                  onChange={setPrazo} display={`${prazoMeses} meses · ${anos.toFixed(0)} anos`} />
          <Slider label="Rentabilidade FIIs (a.a.)" value={rentFiiAA} min={0} max={25} step={0.1}
                  onChange={setFii} display={`${rentFiiAA.toFixed(1)} %`} cor={CORES.fii} />
          <Slider label="Rentabilidade Renda Fixa (a.a.)" value={rentRfAA} min={0} max={25} step={0.1}
                  onChange={setRf} display={`${rentRfAA.toFixed(1)} %`} cor={CORES.rf} />
          <Slider label="Inflação (a.a.)" value={inflacaoAA} min={0} max={12} step={0.1}
                  onChange={setInflacao} display={`${inflacaoAA.toFixed(1)} %`} />
        </div>

        <div style={{
          marginTop: 12, paddingTop: 12, borderTop: `1px dashed ${T.border}`,
          display: "flex", gap: 24, fontSize: 11, color: T.muted, flexWrap: "wrap",
        }}>
          <RowSmall label="Total aportado no período" value={fmtBRL.format(r.totalAportado)} />
          <RowSmall label="Prazo" value={`${anos.toFixed(1)} anos`} />
        </div>
      </div>

      {/* CARDS FII vs RF */}
      <div className="sfr-cards-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, marginBottom: 10,
        alignItems: "start",
      }}>
        <LadoCard nome="FIIs" cor={CORES.fii} icone="🏢" lado={r.fii}
                  rentAA={rentFiiAA} vencedor={r.vencedor === "fii"} />
        <LadoCard nome="Renda Fixa" cor={CORES.rf} icone="🏦" lado={r.rf}
                  rentAA={rentRfAA} vencedor={r.vencedor === "rf"} />
      </div>

      {/* GRÁFICO patrimônio acumulado */}
      <div style={{
        marginTop: 4, padding: 14,
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div className="label-eyebrow">Patrimônio acumulado · {anos.toFixed(0)} anos</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3, fontStyle: "italic" }}>
              Valores nominais (sem descontar inflação).
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: T.muted, flexWrap: "wrap" }}>
            <LegendDot cor={CORES.fii} label="FIIs" />
            <LegendDot cor={CORES.rf} label="Renda Fixa" />
          </div>
        </div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={r.serie} margin={{ top: 8, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid stroke={T.border} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="mes"
                     tick={{ fill: T.muted, fontSize: 10 }}
                     stroke={T.border}
                     tickFormatter={(v) => `${Math.round(v / 12)}a`} />
              <YAxis tick={{ fill: T.muted, fontSize: 10 }}
                     stroke={T.border}
                     tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}k`} />
              <Tooltip
                contentStyle={{ background: T.card, border: `1px solid ${T.border}`, fontSize: 11, color: T.ink }}
                labelStyle={{ color: T.muted, marginBottom: 4 }}
                labelFormatter={(v) => `Mês ${v} · ${(v / 12).toFixed(1)} anos`}
                formatter={(v, k) => [fmtBRL.format(v), k === "fii" ? "FIIs" : "Renda Fixa"]}
              />
              <Legend content={() => null} />
              <Line type="monotone" dataKey="fii" stroke={CORES.fii} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rf"  stroke={CORES.rf}  strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Veredito */}
        {r.vencedor !== "empate" && (
          <div style={{
            marginTop: 8, padding: 10, background: `${corVenc}11`,
            border: `1px solid ${corVenc}33`, borderRadius: 11,
            fontSize: 12, color: T.muted, lineHeight: 1.5,
          }}>
            <strong style={{ color: corVenc }}>🏁 {vencedorNome}</strong> acumula mais:{" "}
            <strong className="num" style={{ color: T.ink }}>{fmtBRL.format(diff)}</strong>{" "}
            a mais no fim de {anos.toFixed(0)} anos. Mas FIIs costumam pagar renda mensal
            (dividendos) mais alta ao longo do caminho — o simulador compara só o patrimônio
            formado por juros compostos na taxa que você escolheu.
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div style={{
        marginTop: 14, padding: 12,
        background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 11,
        fontSize: 11.5, color: T.muted, lineHeight: 1.55, fontStyle: "italic",
      }}>
        Cada aporte rende à taxa anual informada convertida em taxa mensal composta.
        A "renda mensal" no fim assume que você passa a viver do rendimento (taxa a.a. ÷ 12
        sobre o patrimônio). Os valores "em R$ de hoje" descontam a inflação do período.
        FIIs e Renda Fixa têm riscos, liquidez e tributação diferentes — estimativa
        educativa, não é recomendação de investimento.
      </div>

      <style>{`
        @media (max-width: 980px) {
          .sfr-sliders-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .sfr-cards-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .sfr-sliders-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .sfr-root { padding-left: 14px !important; padding-right: 14px !important; }
        }
      `}</style>
    </div>
  );
}

function LadoCard({ nome, cor, icone, lado, rentAA, vencedor }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${cor}22 0%, ${cor}08 60%, ${T.card} 100%)`,
      border: `1px solid ${cor}`, borderLeft: `3px solid ${cor}`,
      borderRadius: 14, padding: 12, position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 8, right: 10, fontSize: 8.5, padding: "2px 6px",
        borderRadius: 100, background: vencedor ? cor : T.bgSoft,
        color: vencedor ? T.bg : T.muted, fontWeight: 700,
        letterSpacing: ".12em", textTransform: "uppercase",
      }}>
        {vencedor ? "🏆 Vence" : `${rentAA}% a.a.`}
      </div>

      <div className="label-eyebrow" style={{ color: cor, marginBottom: 4 }}>
        {icone} {nome} · patrimônio no fim
      </div>

      <div className="num" style={{
        fontFamily: T.serif, fontSize: 28, fontWeight: 700, color: T.ink,
        letterSpacing: "-0.02em", lineHeight: 1,
      }}>
        {fmtBRL.format(lado.patrimonio)}
      </div>
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
        ≈ {fmtBRL.format(lado.patrimonioReal)} em poder de compra de hoje
      </div>

      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8,
        marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${cor}55`,
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 1 }}>
            Ganho (juros)
          </div>
          <div className="num" style={{ fontSize: 13, color: T.green, fontWeight: 600 }}>
            {fmtBRL.format(lado.ganho)}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, marginBottom: 1 }}>
            Renda mensal
          </div>
          <div className="num" style={{ fontSize: 13, color: cor, fontWeight: 600 }}>
            {fmtBRL.format(lado.rendaMensal)}
          </div>
          <div style={{ fontSize: 10, color: T.muted }}>
            ≈ {fmtBRL.format(lado.rendaMensalReal)} de hoje
          </div>
        </div>
      </div>
    </div>
  );
}

// Campo de valor DIGITÁVEL (com slider de ajuste fino embaixo).
function CampoValor({ label, value, min, max, step, onChange }) {
  const [texto, setTexto] = useState("");
  const [focado, setFocado] = useState(false);
  const commit = (raw) => {
    const limpo = String(raw).replace(/[^\d]/g, "");
    let n = limpo ? parseInt(limpo, 10) : 0;
    if (n < min) n = min;
    if (n > max) n = max;
    onChange(n);
  };
  return (
    <div>
      <div style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>{label}</span>
      </div>
      <input
        type="text" inputMode="numeric"
        value={focado ? texto : fmtBRL.format(value)}
        onFocus={() => { setFocado(true); setTexto(String(value)); }}
        onBlur={() => { setFocado(false); commit(texto); }}
        onChange={(e) => { setTexto(e.target.value); commit(e.target.value); }}
        style={{
          width: "100%", padding: "7px 10px", borderRadius: 11,
          background: T.bgSoft, border: `1px solid ${T.border}`,
          color: T.gold, fontFamily: T.serif, fontSize: 18, fontWeight: 600,
          outline: "none",
        }}
      />
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(Number(e.target.value))}
             style={{ width: "100%", accentColor: T.gold, cursor: "pointer", marginTop: 6 }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: T.faint, marginTop: 2 }}>
        <span>{fmtBRL.format(min)}</span>
        <span>{fmtBRL.format(max)}</span>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, display, cor }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6, gap: 10 }}>
        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>{label}</span>
        <span className="num" style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600, color: cor || T.gold, whiteSpace: "nowrap" }}>
          {display}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
             onChange={(e) => onChange(Number(e.target.value))}
             style={{ width: "100%", accentColor: cor || T.gold, cursor: "pointer" }} />
    </div>
  );
}

function RowSmall({ label, value, cor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
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
