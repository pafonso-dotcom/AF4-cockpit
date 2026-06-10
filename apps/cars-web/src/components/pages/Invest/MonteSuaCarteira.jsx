import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { T } from "../../../lib/theme.js";
import PageHeader from "../../ui/PageHeader.jsx";
import AlocacaoPieChart from "../../ui/AlocacaoPieChart.jsx";
import { ASSET_CLASS_LABELS, ASSET_CLASS_COLORS, semCapitalSocial } from "../../../lib/invest-constants.js";
import { calcAlocacaoPorClasse } from "../../../lib/invest-utils.js";
import {
  ATALHOS_MIX,
  calcularAlocacaoPorMix,
  ajustarMix,
} from "../../../lib/monte-carteira-config.js";
import { calcularRendaMensalCarteira } from "../../../lib/yields-base.js";
import SugestaoAporte from "./SugestaoAporte.jsx";

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

export default function MonteSuaCarteira({ ativos: ativosProp = [], apiKey = null }) {
  const ativos = semCapitalSocial(ativosProp); // Capital Social fora do rebalanceamento
  const [valor, setValor] = useState(DEFAULT_VALOR);
  const [mix, setMix]     = useState(DEFAULT_MIX);
  const [modo, setModo]   = useState("manual"); // "manual" | "ia"

  const aplicarAtalho = (atalho) => setMix(atalho.mix);
  const onSliderMix   = (key, v) => setMix(prev => ajustarMix(prev, key, v));

  const alocacao = useMemo(() => calcularAlocacaoPorMix(mix), [mix]);

  // Carteira atual do usuário agregada por classe (Map { tipo: valor })
  const carteiraAtual = useMemo(() => {
    const r = {};
    for (const a of calcAlocacaoPorClasse(ativos)) r[a.tipo] = a.valor;
    return r;
  }, [ativos]);

  // Tickers ativos por classe — ordenado por valor desc (Map { tipo: [{ ticker, valor }] })
  const ticketsPorClasse = useMemo(() => {
    const r = {};
    for (const a of ativos || []) {
      const qtd = Number(a.qtd || 0);
      const preco = Number(a.preco || 0);
      const v = qtd * preco;
      if (v <= 0 || !a.ticker) continue;
      const k = a.tipo || "outro";
      if (!r[k]) r[k] = [];
      r[k].push({ ticker: a.ticker, valor: v });
    }
    for (const k of Object.keys(r)) {
      r[k].sort((x, y) => y.valor - x.valor);
    }
    return r;
  }, [ativos]);

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

  // Alocação-alvo formatada pra IA (apenas classes com >= 0.5%)
  const alocacaoAlvoIA = useMemo(() => {
    return alocacao
      .filter(a => a.pct >= 0.5)
      .map(a => ({ tipo: a.tipo, pct: a.pct, valor: valor * (a.pct / 100) }));
  }, [alocacao, valor]);

  // Renda mensal estimada (líquida) baseada em yields-base por classe
  const rendaEstimada = useMemo(() => {
    const carteira = alocacao
      .filter(a => a.pct >= 0.5)
      .map(a => ({ tipo: a.tipo, valor: valor * (a.pct / 100) }));
    return calcularRendaMensalCarteira(carteira);
  }, [alocacao, valor]);

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

      {/* ============ SEÇÃO 3 · Modo Manual / IA ============ */}
      <section className="mc-card" style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 8,
        padding: 12, marginBottom: 10,
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 10, gap: 10, flexWrap: "wrap",
        }}>
          <div className="label-eyebrow">3 · Como preencher</div>
          <div style={{ display: "inline-flex", gap: 4, background: T.bgSoft, padding: 3, borderRadius: 6, border: `1px solid ${T.border}` }}>
            {[
              { id: "manual", label: "Manual" },
              { id: "ia",     label: "Com IA" },
            ].map(opt => (
              <button key={opt.id} onClick={() => setModo(opt.id)}
                style={{
                  padding: "5px 12px", borderRadius: 4, cursor: "pointer",
                  fontSize: 11.5, fontWeight: 600,
                  background: modo === opt.id ? T.gold : "transparent",
                  color: modo === opt.id ? T.bg : T.muted,
                  border: "none",
                }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {modo === "manual" && (
          <ModoManual
            alocacao={alocacao}
            valor={valor}
            carteiraAtual={carteiraAtual}
            ticketsPorClasse={ticketsPorClasse}
          />
        )}

        {modo === "ia" && (
          <SugestaoAporte
            inline
            ativosCarteira={ativos}
            alocacaoAlvo={alocacaoAlvoIA}
            apiKey={apiKey}
          />
        )}
      </section>

      {/* ============ SEÇÃO 4 · Renda mensal estimada ============ */}
      <section className="mc-card" style={{
        background: T.card,
        border: `1px solid ${T.green}`,
        borderLeft: `4px solid ${T.green}`,
        borderRadius: 8, padding: 12, marginBottom: 10,
      }}>
        <div className="label-eyebrow" style={{ color: T.green, marginBottom: 6 }}>
          4 · Renda mensal estimada
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div className="num" style={{
            fontFamily: T.serif, fontSize: 28, fontWeight: 700, color: T.green, lineHeight: 1,
          }}>
            {fmtBRL.format(rendaEstimada.rendaMensal)}
          </div>
          <div style={{ fontSize: 11, color: T.muted }}>
            por mês (líquida estimada · {valor > 0 ? ((rendaEstimada.rendaMensal / valor) * 100).toFixed(2) : "0.00"}% a.m.)
          </div>
        </div>
        <div style={{ fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
          Estimativa baseada em yields médios históricos (FIIs ~0.80%, Tesouro ~0.85%, ações ~0.45% mensal).
          Yields reais variam — use como referência inicial, não promessa.
        </div>
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: 11, color: T.gold, cursor: "pointer", userSelect: "none" }}>
            Quebra por classe
          </summary>
          <div style={{ marginTop: 6, display: "grid", gap: 3 }}>
            {rendaEstimada.breakdown.filter(b => b.valor > 0).map(b => (
              <div key={b.tipo} style={{
                display: "flex", justifyContent: "space-between", fontSize: 11,
                padding: "3px 0",
              }}>
                <span style={{ color: T.ink }}>{ASSET_CLASS_LABELS[b.tipo] || b.tipo}</span>
                <span className="num" style={{ color: T.muted }}>
                  {fmtBRL.format(b.valor)} × {(b.yield * 100).toFixed(2)}% =
                  <strong style={{ color: T.green, marginLeft: 4 }}>{fmtBRL.format(b.renda)}</strong>
                </span>
              </div>
            ))}
          </div>
        </details>
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
  // Texto editável do valor — permite DIGITAR qualquer quantia (inclusive
  // acima do teto do slider). O slider continua sincronizado (clampado ao max).
  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState("");

  const commit = () => {
    const limpo = (draft || "").replace(/[^\d]/g, "");
    const n = parseInt(limpo, 10);
    if (Number.isFinite(n) && n > 0) onChange(Math.max(min, n));
    setEditando(false);
  };

  return (
    <div>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        marginBottom: 4, gap: 10,
      }}>
        <span style={{ fontSize: 12, color: T.ink, fontWeight: 500 }}>
          Valor a investir
        </span>
        {editando ? (
          <input
            autoFocus
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditando(false); }}
            placeholder="Ex.: 25000000"
            style={{
              fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.gold,
              textAlign: "right", width: 180, background: T.bgSoft,
              border: `1px solid ${T.gold}`, borderRadius: 6, padding: "2px 8px",
            }}
          />
        ) : (
          <button
            onClick={() => { setDraft(String(Math.round(value))); setEditando(true); }}
            title="Clique para digitar o valor"
            className="num"
            style={{
              fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.gold,
              background: "transparent", border: "none", cursor: "text", padding: 0,
            }}>
            {fmtBRL.format(value)}
          </button>
        )}
      </div>
      <input type="range"
             min={min} max={max} step={step}
             value={Math.min(value, max)}
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
        <span>{value > max ? `${fmtBRL.format(value)} (digitado)` : fmtBRL.format(max)}</span>
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

/**
 * Modo Manual: pra cada classe da alocação resultante (com pct > 0.5),
 * mostra target × atual + lista compacta de tickers atuais.
 */
function ModoManual({ alocacao, valor, carteiraAtual, ticketsPorClasse }) {
  const classes = alocacao.filter(a => a.pct >= 0.5);
  if (classes.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: "center", color: T.muted, fontSize: 12, fontStyle: "italic" }}>
        Configure o mix de objetivos pra ver a alocação por classe.
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {classes.map(a => (
        <ClasseBreakdown
          key={a.tipo}
          tipo={a.tipo}
          pct={a.pct}
          target={valor * (a.pct / 100)}
          atual={carteiraAtual[a.tipo] || 0}
          tickers={ticketsPorClasse[a.tipo] || []}
        />
      ))}
    </div>
  );
}

function ClasseBreakdown({ tipo, pct, target, atual, tickers }) {
  const diff = target - atual;
  const corClasse = ASSET_CLASS_COLORS[tipo] || T.muted;
  const label = ASSET_CLASS_LABELS[tipo] || tipo;
  const corDiff = Math.abs(diff) < target * 0.02
    ? T.gold
    : (diff > 0 ? T.green : T.red);
  const labelDiff = Math.abs(diff) < target * 0.02
    ? "no alvo"
    : (diff > 0 ? `aportar ${fmtBRL.format(diff)}` : `excesso ${fmtBRL.format(-diff)}`);
  const top = tickers.slice(0, 5);
  const restante = tickers.length - top.length;

  return (
    <div style={{
      background: T.bgSoft, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${corClasse}`, borderRadius: 6, padding: 10,
    }}>
      {/* Cabeçalho: classe + target + diff */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{label}</span>
          <span className="num" style={{ fontSize: 11, color: corClasse, fontWeight: 600 }}>
            {pct.toFixed(1)}%
          </span>
          <span className="num" style={{ fontSize: 11, color: T.muted }}>
            · alvo {fmtBRL.format(target)}
          </span>
        </div>
        <span className="num" style={{
          fontSize: 11, fontWeight: 600, color: corDiff,
          padding: "2px 8px", borderRadius: 100,
          background: `${corDiff}11`, border: `1px solid ${corDiff}55`,
        }}>
          {labelDiff}
        </span>
      </div>

      {/* Linha atual */}
      <div style={{ fontSize: 11, color: T.muted, marginTop: 3 }}>
        Você tem hoje: <span className="num" style={{ color: T.ink }}>{fmtBRL.format(atual)}</span>
        {tickers.length > 0 && (
          <span style={{ color: T.faint }}>
            {" "}· {tickers.length} {tickers.length === 1 ? "ativo" : "ativos"}
          </span>
        )}
      </div>

      {/* Lista de tickers (top 5) ou aviso de classe vazia */}
      {tickers.length === 0 ? (
        <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", marginTop: 4 }}>
          Você ainda não tem ativos nesta classe.
        </div>
      ) : (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6,
          fontSize: 11,
        }}>
          {top.map(t => (
            <span key={t.ticker} style={{
              background: T.card, border: `1px solid ${T.border}`,
              padding: "2px 7px", borderRadius: 4, fontFamily: T.serif,
              display: "inline-flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontWeight: 600 }}>{t.ticker}</span>
              <span style={{ color: T.muted, fontSize: 10 }}>{fmtBRL.format(t.valor)}</span>
            </span>
          ))}
          {restante > 0 && (
            <span style={{ color: T.muted, fontSize: 10.5, alignSelf: "center", fontStyle: "italic" }}>
              +{restante} mais
            </span>
          )}
        </div>
      )}
    </div>
  );
}
