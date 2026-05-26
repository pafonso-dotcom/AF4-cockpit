import React, { useMemo, useState } from "react";
import { Wrench, Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";
import AlocacaoPieChart from "../../ui/AlocacaoPieChart.jsx";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS } from "../../../lib/invest-constants.js";
import {
  ATALHOS_MIX,
  calcularAlocacaoPorMix,
  ajustarMix,
} from "../../../lib/monte-carteira-config.js";

/**
 * Monte sua Carteira — PR 1 (esqueleto).
 *
 * Tela unificada que substituirá Carteira Modelo (PR 2), Objetivos (PR 3) e
 * Calculadora de Renda (PR 3). Esta primeira versão entrega:
 *  1. Slider de valor a investir (R$ 100k → 10M)
 *  2. Mix de 3 objetivos (renda / crescimento / reserva) com sliders que
 *     mantêm soma = 100, plus 3 atalhos rápidos
 *  3. Alocação resultante por classe de ativo (tabela + pie chart)
 *  4. Placeholders pras seções 3 (Manual/IA) e 4 (renda estimada)
 */

const DEFAULT_VALOR = 1_000_000;
const DEFAULT_MIX   = { renda: 50, crescimento: 30, reserva: 20 };

const fmtBRL = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});

// Cores dos 3 objetivos (label + barra de slider)
const COR_OBJETIVO = {
  renda:       null, // T.green — preenchido em runtime (T pode mudar com tema)
  crescimento: null, // T.gold
  reserva:     null, // T.blue
};
const corObjetivo = (key) => ({
  renda:       T.green,
  crescimento: T.gold,
  reserva:     T.blue || "#60a5fa",
}[key]);

const LABEL_OBJETIVO = {
  renda:       "Renda mensal",
  crescimento: "Crescimento",
  reserva:     "Reserva",
};

const HINT_OBJETIVO = {
  renda:       "FIIs · ações pagadoras · REITs",
  crescimento: "Ações BR · stocks US · ETFs",
  reserva:     "Tesouro · CDB · liquidez",
};

export default function MonteSuaCarteira() {
  const [valor, setValor] = useState(DEFAULT_VALOR);
  const [mix, setMix]     = useState(DEFAULT_MIX);

  const aplicarAtalho = (atalho) => setMix(atalho.mix);
  const onSliderMix   = (key, v) => setMix(prev => ajustarMix(prev, key, v));

  const alocacao = useMemo(() => calcularAlocacaoPorMix(mix), [mix]);

  // Dados pro pie chart — filtra fatias minúsculas pra não poluir
  const pieData = useMemo(() => {
    return alocacao
      .filter(a => a.pct >= 0.5)
      .map(a => ({
        nome:  ASSET_CLASS_LABELS[a.tipo] || a.tipo,
        valor: valor * (a.pct / 100),
        pct:   a.pct,
        cor:   ASSET_CLASS_COLORS[a.tipo] || T.muted,
      }));
  }, [alocacao, valor]);

  // Detecta se o mix atual corresponde a algum atalho (pra destacar botão)
  const atalhoAtivo = useMemo(() => {
    return ATALHOS_MIX.find(a =>
      a.mix.renda       === mix.renda &&
      a.mix.crescimento === mix.crescimento &&
      a.mix.reserva     === mix.reserva
    )?.id;
  }, [mix]);

  return (
    <div className="fade-up py-6 px-6 mc-root">
      <PageHeader
        eyebrow="Investimentos · Montagem"
        title="Monte sua Carteira"
        sub="Defina quanto investir, distribua entre seus objetivos e veja a alocação resultante por classe de ativo."
      />

      {/* ============ SEÇÃO 1 · QUANTO INVESTIR ============ */}
      <section className="mc-card" style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 12, marginBottom: 10,
      }}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>
          1 · Quanto investir
        </div>
        <ValorSlider
          value={valor}
          min={100_000}
          max={10_000_000}
          step={50_000}
          onChange={setValor}
        />
      </section>

      {/* ============ SEÇÃO 2 · MIX DE OBJETIVOS ============ */}
      <section className="mc-card" style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 12, marginBottom: 10,
      }}>
        <div className="label-eyebrow" style={{ marginBottom: 8 }}>
          2 · Mix de objetivos
        </div>

        {/* Atalhos rápidos */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {ATALHOS_MIX.map(a => {
            const ativo = atalhoAtivo === a.id;
            return (
              <button key={a.id} onClick={() => aplicarAtalho(a)}
                style={{
                  padding: "5px 11px", borderRadius: 6, cursor: "pointer",
                  fontSize: 11.5, fontWeight: 500,
                  background: ativo ? `${T.gold}22` : T.bgSoft,
                  color: ativo ? T.gold : T.ink,
                  border: `1px solid ${ativo ? T.gold : T.border}`,
                  display: "inline-flex", alignItems: "center", gap: 8,
                }}>
                <span>{a.label}</span>
              </button>
            );
          })}
        </div>

        {/* Grid: sliders (esquerda) · alocação resultante (direita) */}
        <div className="mc-mix-grid" style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
          gap: 12,
          alignItems: "start",
        }}>
          {/* Sliders dos 3 objetivos */}
          <div style={{ display: "grid", gap: 10 }}>
            {["renda", "crescimento", "reserva"].map(key => (
              <ObjetivoSlider
                key={key}
                label={LABEL_OBJETIVO[key]}
                hint={HINT_OBJETIVO[key]}
                value={mix[key]}
                cor={corObjetivo(key)}
                onChange={(v) => onSliderMix(key, v)}
              />
            ))}
          </div>

          {/* Alocação resultante: pie + tabela */}
          <div style={{
            background: T.bgSoft, border: `1px solid ${T.border}`,
            borderRadius: 8, padding: 10,
          }}>
            <div className="label-eyebrow" style={{ marginBottom: 6 }}>
              Alocação resultante
            </div>

            <AlocacaoPieChart data={pieData} hidden={false} height={120} />

            <div style={{ display: "grid", gap: 3, marginTop: 8 }}>
              {alocacao
                .filter(a => a.pct >= 0.5)
                .map(a => (
                  <LinhaAloc
                    key={a.tipo}
                    label={ASSET_CLASS_LABELS[a.tipo] || a.tipo}
                    cor={ASSET_CLASS_COLORS[a.tipo] || T.muted}
                    pct={a.pct}
                    valor={valor * (a.pct / 100)}
                  />
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ SEÇÃO 3 · placeholder Manual/IA (PR 2) ============ */}
      <section className="mc-placeholder" style={{
        marginBottom: 10,
        padding: 10,
        background: T.bgSoft,
        border: `2px dashed ${T.border}`,
        borderRadius: 8,
        minHeight: 56,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        color: T.muted,
      }}>
        <Wrench size={16} style={{ color: T.gold, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 1 }}>
            3 · Modo Manual / IA
          </div>
          <div style={{ fontSize: 11, fontStyle: "italic" }}>
            Escolha de ativos individuais (manual ou sugerido por IA) — vem no PR 2.
          </div>
        </div>
      </section>

      {/* ============ SEÇÃO 4 · placeholder renda estimada (PR 3) ============ */}
      <section className="mc-placeholder" style={{
        marginBottom: 10,
        padding: 10,
        background: T.bgSoft,
        border: `2px dashed ${T.border}`,
        borderRadius: 8,
        minHeight: 56,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        color: T.muted,
      }}>
        <Sparkles size={16} style={{ color: T.gold, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.ink, marginBottom: 1 }}>
            4 · Renda mensal estimada
          </div>
          <div style={{ fontSize: 11, fontStyle: "italic" }}>
            Projeção de renda mensal (dividendos + juros + saque ideal) — vem no PR 3.
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .mc-mix-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .mc-root { padding-left: 10px !important; padding-right: 10px !important; padding-top: 16px !important; }
          .mc-card { padding: 10px !important; margin-bottom: 8px !important; }
          .mc-placeholder { padding: 8px !important; min-height: 48px !important; }
        }
      `}</style>
    </div>
  );
}

/**
 * Slider do valor a investir — replica o estilo do Slider de
 * CalculadoraRenda (valor serif gold em cima, faixa min/max embaixo).
 */
function ValorSlider({ value, min, max, step, onChange }) {
  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 4, gap: 10,
      }}>
        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>
          Valor a investir
        </span>
        <span className="num" style={{
          fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.gold,
        }}>
          {fmtBRL.format(value)}
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
        fontSize: 9.5, color: T.faint, marginTop: 1,
      }}>
        <span>{fmtBRL.format(min)}</span>
        <span>{fmtBRL.format(max)}</span>
      </div>
    </div>
  );
}

/**
 * Slider de um objetivo individual (0-100), com label colorido + barra
 * colorida + valor em destaque. Usado pros 3 sliders de mix.
 */
function ObjetivoSlider({ label, hint, value, cor, onChange }) {
  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 2, gap: 10,
      }}>
        <span style={{ fontSize: 11.5, color: cor, fontWeight: 600 }}>
          {label}
        </span>
        <span className="num" style={{
          fontFamily: T.serif, fontSize: 14, fontWeight: 600, color: cor,
        }}>
          {value}%
        </span>
      </div>
      <input type="range"
             min={0} max={100} step={1}
             value={value}
             onChange={e => onChange(Number(e.target.value))}
             style={{
               width: "100%",
               accentColor: cor,
               cursor: "pointer",
             }} />
      <div style={{ fontSize: 10, color: T.faint, marginTop: 1, fontStyle: "italic" }}>
        {hint}
      </div>
    </div>
  );
}

/**
 * Uma linha da tabela de alocação resultante: bolinha colorida + label +
 * % + valor em R$.
 */
function LinhaAloc({ label, cor, pct, valor }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 8, fontSize: 11.5,
    }}>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
        <span style={{
          width: 8, height: 8, borderRadius: 2,
          background: cor, flexShrink: 0,
        }} />
        <span style={{ color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
      </div>
      <div style={{ display: "inline-flex", gap: 8, alignItems: "baseline", flexShrink: 0 }}>
        <span className="num" style={{ color: cor, fontWeight: 600, fontSize: 11.5 }}>
          {pct.toFixed(1)}%
        </span>
        <span className="num" style={{ color: T.muted, fontSize: 10.5 }}>
          {fmtBRL.format(valor)}
        </span>
      </div>
    </div>
  );
}
