/**
 * ReservaEmergenciaView — calculadora de reserva inspirada no IdV (Investidor de Verdade).
 *
 * Dois modos de input:
 *   - Valor Total: usuário informa o custo de vida mensal direto
 *   - Gastos Detalhados: campo por categoria (Moradia, Alimentação, etc.)
 *
 * Auto-fill: botão pra puxar média de despesas dos últimos 3 meses do app.
 *
 * Slider 3-24 meses + 3 presets (Conservador 3, Padrão 6, Tranquilo 12).
 *
 * Resultado:
 *   - Valor da reserva ideal
 *   - Saldo líquido já disponível (contas) + % do progresso
 *   - Plano de construção: quanto tempo com X de aporte mensal
 *   - Botão pra virar meta automática no módulo Metas
 */
import React, { useMemo, useState, useEffect } from "react";
import {
  Shield, Calculator, DollarSign, Wallet, Target, Sparkles,
  TrendingUp, Plus, AlertCircle, Check, ChevronDown,
} from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, fmtN, uid, todayISO } from "../../../lib/format.js";
import { parseValorBR } from "../../../lib/importExport.js";
import { toast } from "../../../lib/toast.js";
import PageHeader from "../../ui/PageHeader.jsx";
import Field from "../../ui/Field.jsx";

const CATEGORIAS_PADRAO = [
  { id: "moradia",     label: "Moradia (aluguel/financiamento)" },
  { id: "alimentacao", label: "Alimentação" },
  { id: "transporte",  label: "Transporte" },
  { id: "energia",     label: "Energia elétrica" },
  { id: "agua",        label: "Água" },
  { id: "internet",    label: "Internet" },
  { id: "telefone",    label: "Telefone" },
  { id: "saude",       label: "Saúde / Plano" },
  { id: "educacao",    label: "Educação" },
  { id: "outros",      label: "Outros essenciais" },
];

const PRESETS = [
  { meses: 3,  label: "Conservador", desc: "Renda estável + sem dependentes", cor: "#60a5fa" },
  { meses: 6,  label: "Padrão",      desc: "CLT com família",                  cor: "#fbbf24" },
  { meses: 12, label: "Tranquilo",   desc: "Autônomo / renda variável",        cor: "#34d399" },
];

const mesISO = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toISOString().slice(0, 7);
};

export default function ReservaEmergenciaView({
  transacoes = [], contas = [], metas = [], setMetas, hidden,
}) {
  const [modo, setModo] = useState("total"); // "total" | "detalhado"
  const [valorTotal, setValorTotal] = useState("");
  const [gastos, setGastos] = useState(
    Object.fromEntries(CATEGORIAS_PADRAO.map(c => [c.id, ""]))
  );
  const [meses, setMeses] = useState(6);
  const [aporteMensal, setAporteMensal] = useState("");
  const [taxaCdb, setTaxaCdb] = useState("0.85"); // % a.m.

  /* ===== Cálculo do custo mensal ===== */
  const custoMensal = useMemo(() => {
    if (modo === "total") return parseValorBR(valorTotal) || 0;
    return Object.values(gastos).reduce((s, v) => s + (parseValorBR(v) || 0), 0);
  }, [modo, valorTotal, gastos]);

  /* ===== Reserva alvo ===== */
  const reservaAlvo = custoMensal * meses;

  /* ===== Saldo líquido disponível (contas que NÃO são cartão de crédito) ===== */
  const saldoDisponivel = useMemo(() => {
    return (contas || [])
      .filter(c => c.tipo !== "credito")
      .reduce((s, c) => s + (parseFloat(c.saldo) || 0), 0);
  }, [contas]);

  const faltaAcumular = Math.max(0, reservaAlvo - saldoDisponivel);
  const pctProgresso = reservaAlvo > 0 ? Math.min(100, (saldoDisponivel / reservaAlvo) * 100) : 0;
  const reservaCompleta = saldoDisponivel >= reservaAlvo && reservaAlvo > 0;

  /* ===== Auto-fill: média dos últimos 3 meses ===== */
  const puxarMedia = () => {
    const mesesRef = [mesISO(-1), mesISO(-2), mesISO(-3)];
    const despesas = (transacoes || [])
      .filter(t => t.tipo === "despesa" && t.compensado !== false)
      .filter(t => mesesRef.some(m => (t.data || "").startsWith(m)));

    if (despesas.length === 0) {
      toast.info("Sem despesas nos últimos 3 meses — preencha manualmente.");
      return;
    }

    const total = despesas.reduce((s, t) => s + (parseFloat(t.valor) || 0), 0);
    const media = total / 3;

    setModo("total");
    setValorTotal(media.toFixed(2).replace(".", ","));
    toast.success(`Custo médio mensal: ${fmt(media)} (média de ${despesas.length} despesas em 3 meses).`);
  };

  /* ===== Plano de construção: tempo pra atingir com aporte mensal + juros ===== */
  const planoConstrucao = useMemo(() => {
    const aporte = parseValorBR(aporteMensal) || 0;
    const r = (parseValorBR(taxaCdb) || 0) / 100;
    if (aporte <= 0 || faltaAcumular <= 0) return null;

    let saldo = saldoDisponivel;
    let mesesNecessarios = 0;
    const maxMeses = 600; // 50 anos limite
    while (saldo < reservaAlvo && mesesNecessarios < maxMeses) {
      saldo = saldo * (1 + r) + aporte;
      mesesNecessarios++;
    }
    if (mesesNecessarios >= maxMeses) return { excede: true };

    const aporteTotal = aporte * mesesNecessarios;
    const ganhosJuros = saldo - saldoDisponivel - aporteTotal;
    const anos = mesesNecessarios / 12;

    return { mesesNecessarios, anos, aporteTotal, ganhosJuros, saldoFinal: saldo };
  }, [aporteMensal, taxaCdb, faltaAcumular, saldoDisponivel, reservaAlvo]);

  /* ===== Sugestão de aporte pra completar em 12 meses ===== */
  const aporteSugerido12m = useMemo(() => {
    if (faltaAcumular <= 0) return 0;
    const r = (parseValorBR(taxaCdb) || 0) / 100;
    const n = 12;
    // FV = aporte * ((1+r)^n - 1)/r + PV * (1+r)^n
    // resolvendo pra aporte:
    const fvPV = saldoDisponivel * Math.pow(1 + r, n);
    const fator = r > 0 ? ((Math.pow(1 + r, n) - 1) / r) : n;
    return Math.max(0, (reservaAlvo - fvPV) / fator);
  }, [faltaAcumular, taxaCdb, saldoDisponivel, reservaAlvo]);

  /* ===== Criar meta automática ===== */
  const criarMeta = () => {
    if (reservaAlvo <= 0) {
      toast.error("Defina o custo mensal antes.");
      return;
    }
    const jaExiste = (metas || []).find(m =>
      (m.nome || "").toLowerCase().includes("reserva de emergência")
    );
    if (jaExiste) {
      toast.info(`Meta "Reserva de Emergência" já existe — abra em Metas pra editar.`);
      return;
    }
    const novaMeta = {
      id: uid(),
      nome: "Reserva de Emergência",
      alvo: Number(reservaAlvo.toFixed(2)),
      atual: Number(saldoDisponivel.toFixed(2)),
      prazo: 12,
      aporte: Math.round(aporteSugerido12m),
      taxa: parseValorBR(taxaCdb) || 0.85,
    };
    setMetas?.([...(metas || []), novaMeta]);
    toast.success(`Meta criada: ${fmt(reservaAlvo)} em 12 meses. Acompanhe na aba Metas.`);
  };

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Planejamento"
        title="Reserva de Emergência"
        sub="Calcule quanto você precisa pra dormir tranquilo. Inspirado no Método IdV."
      />

      {/* ===== Input do custo mensal ===== */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 18,
        padding: 16, marginBottom: 14,
      }}>
        {/* Toggle modo */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, background: T.bgSoft, padding: 3, borderRadius: 14 }}>
          {[
            { id: "total",     label: "💰 Valor Total" },
            { id: "detalhado", label: "📋 Gastos Detalhados" },
          ].map(t => {
            const ativo = modo === t.id;
            return (
              <button key={t.id} onClick={() => setModo(t.id)}
                      style={{
                        flex: 1, padding: "8px 12px",
                        background: ativo ? T.card : "transparent",
                        border: ativo ? `1px solid ${T.border}` : "1px solid transparent",
                        color: ativo ? T.ink : T.muted,
                        fontSize: 12, fontWeight: ativo ? 700 : 500,
                        borderRadius: 11, cursor: "pointer",
                      }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Auto-fill */}
        <button onClick={puxarMedia}
                className="btn-ghost"
                style={{
                  marginBottom: 12, fontSize: 11, padding: "6px 12px",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
          <Sparkles size={12} /> Puxar média dos últimos 3 meses
        </button>

        {modo === "total" ? (
          <Field label="Qual seu custo de vida mensal?" hint="Quanto você gasta normalmente todo mês (essenciais)">
            <input type="text" inputMode="decimal"
                   value={valorTotal}
                   onChange={e => setValorTotal(e.target.value)}
                   placeholder="Ex.: 5.500,00"
                   style={{ fontSize: 16 }} />
          </Field>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CATEGORIAS_PADRAO.map(c => (
                <Field key={c.id} label={c.label}>
                  <input type="text" inputMode="decimal"
                         value={gastos[c.id]}
                         onChange={e => setGastos({ ...gastos, [c.id]: e.target.value })}
                         placeholder="R$ 0,00" />
                </Field>
              ))}
            </div>
            {custoMensal > 0 && (
              <div style={{
                marginTop: 10, padding: 10, background: `${T.gold}11`,
                border: `1px solid ${T.gold}44`, borderRadius: 12,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontSize: 13,
              }}>
                <span style={{ color: T.muted }}>Total mensal:</span>
                <span className="num" style={{ color: T.gold, fontWeight: 700, fontSize: 16 }}>
                  {fmt(custoMensal)}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== Multiplicador de meses ===== */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 18,
        padding: 16, marginBottom: 14,
      }}>
        <div className="label-eyebrow" style={{ marginBottom: 10 }}>
          Por quantos meses você quer ter cobertura?
        </div>

        {/* Presets */}
        <div className="grid grid-cols-3 gap-2" style={{ marginBottom: 14 }}>
          {PRESETS.map(p => {
            const ativo = meses === p.meses;
            return (
              <button key={p.meses} onClick={() => setMeses(p.meses)}
                      style={{
                        padding: "10px 8px",
                        background: ativo ? `${p.cor}22` : T.bgSoft,
                        border: `1px solid ${ativo ? p.cor : T.border}`,
                        color: ativo ? p.cor : T.muted,
                        borderRadius: 14, cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      }}>
                <span className="num" style={{ fontSize: 18, fontWeight: 700 }}>
                  {p.meses}m
                </span>
                <span style={{ fontSize: 10.5, fontWeight: 600 }}>{p.label}</span>
                <span style={{ fontSize: 9, opacity: .7, textAlign: "center" }}>{p.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Slider */}
        <input type="range" min="3" max="24" step="1" value={meses}
               onChange={e => setMeses(parseInt(e.target.value, 10))}
               style={{ width: "100%", accentColor: T.gold }} />
        <div style={{
          display: "flex", justifyContent: "space-between", fontSize: 10.5,
          color: T.muted, marginTop: 4,
        }}>
          <span>3 meses</span>
          <span style={{ color: T.gold, fontWeight: 600 }}>{meses} {meses === 1 ? "mês" : "meses"}</span>
          <span>24 meses</span>
        </div>
      </div>

      {/* ===== Resultado principal ===== */}
      {custoMensal > 0 && (
        <div style={{
          background: `linear-gradient(135deg, ${T.gold}11, ${T.card})`,
          border: `1px solid ${T.gold}66`,
          borderRadius: 18,
          padding: 18, marginBottom: 14,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: ".2em", textTransform: "uppercase",
            color: T.gold, fontWeight: 600, marginBottom: 6,
          }}>
            🛡️ Sua reserva ideal
          </div>
          <div className="num" style={{
            fontFamily: T.serif, fontSize: "clamp(28px, 6vw, 48px)",
            color: T.ink, fontWeight: 600, letterSpacing: "-.02em", lineHeight: 1,
          }}>
            {hidden ? "•••" : fmt(reservaAlvo)}
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6 }}>
            {fmt(custoMensal)}/mês × {meses} {meses === 1 ? "mês" : "meses"}
          </div>

          {/* Progresso */}
          <div style={{ marginTop: 18 }}>
            <div style={{
              display: "flex", justifyContent: "space-between", marginBottom: 6,
              fontSize: 11, color: T.muted,
            }}>
              <span>Você já tem (saldo líquido)</span>
              <span className="num" style={{ color: reservaCompleta ? T.green : T.ink, fontWeight: 600 }}>
                {hidden ? "•••" : fmt(saldoDisponivel)} · {fmtN(pctProgresso, 1)}%
              </span>
            </div>
            <div style={{
              height: 10, background: T.border, borderRadius: 999, overflow: "hidden",
            }}>
              <div style={{
                width: `${pctProgresso}%`, height: "100%",
                background: reservaCompleta ? T.green : T.gold,
                transition: "width .4s",
              }} />
            </div>
            <div style={{ fontSize: 11.5, marginTop: 8, color: reservaCompleta ? T.green : T.muted }}>
              {reservaCompleta ? (
                <><Check size={11} className="inline mr-1" /> Reserva completa! Você pode dormir tranquilo.</>
              ) : (
                <>Falta acumular: <strong style={{ color: T.red }}>{hidden ? "•••" : fmt(faltaAcumular)}</strong></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Plano de construção ===== */}
      {custoMensal > 0 && !reservaCompleta && (
        <div style={{
          background: T.card, border: `1px solid ${T.border}`, borderRadius: 18,
          padding: 16, marginBottom: 14,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Target size={16} style={{ color: T.gold }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>
              Plano de construção
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginBottom: 10 }}>
            <Field label="Quanto você consegue poupar por mês?"
                   hint={aporteSugerido12m > 0 ? `Sugestão pra alcançar em 12m: ${fmt(aporteSugerido12m)}` : undefined}>
              <input type="text" inputMode="decimal"
                     value={aporteMensal}
                     onChange={e => setAporteMensal(e.target.value)}
                     placeholder={aporteSugerido12m > 0 ? `Ex.: ${Math.round(aporteSugerido12m)}` : "Ex.: 500"} />
              {aporteSugerido12m > 0 && (
                <button type="button"
                        onClick={() => setAporteMensal(aporteSugerido12m.toFixed(2).replace(".", ","))}
                        style={{
                          marginTop: 4, background: "transparent", border: "none",
                          color: T.gold, fontSize: 10.5, fontWeight: 600, cursor: "pointer",
                          padding: 0,
                        }}>
                  Usar valor sugerido
                </button>
              )}
            </Field>
            <Field label="Rendimento do CDB (% a.m.)" hint="Padrão: 0.85% (~100% CDI)">
              <input type="text" inputMode="decimal"
                     value={taxaCdb}
                     onChange={e => setTaxaCdb(e.target.value)} />
            </Field>
          </div>

          {planoConstrucao && !planoConstrucao.excede && (
            <div style={{
              padding: 12, background: `${T.green}11`,
              border: `1px solid ${T.green}44`,
              borderLeft: `3px solid ${T.green}`,
              borderRadius: 14,
            }}>
              <div style={{ fontSize: 13, color: T.ink, marginBottom: 6 }}>
                Em <strong className="num" style={{ color: T.green, fontSize: 17 }}>
                  {planoConstrucao.mesesNecessarios} {planoConstrucao.mesesNecessarios === 1 ? "mês" : "meses"}
                </strong>
                {planoConstrucao.anos >= 1 && (
                  <span style={{ color: T.muted, fontSize: 11.5 }}>
                    {" "}({fmtN(planoConstrucao.anos, 1)} {planoConstrucao.anos === 1 ? "ano" : "anos"})
                  </span>
                )} você atinge a reserva.
              </div>
              <div style={{ fontSize: 11, color: T.muted, display: "flex", flexWrap: "wrap", gap: 14 }}>
                <span>Total aportado: <strong className="num" style={{ color: T.ink }}>
                  {fmt(planoConstrucao.aporteTotal)}
                </strong></span>
                <span>Juros: <strong className="num" style={{ color: T.green }}>
                  {fmt(planoConstrucao.ganhosJuros)}
                </strong></span>
              </div>
            </div>
          )}

          {planoConstrucao?.excede && (
            <div style={{
              padding: 12, background: `${T.red}11`,
              border: `1px solid ${T.red}44`, borderRadius: 14,
              fontSize: 12.5, color: T.red,
            }}>
              <AlertCircle size={13} className="inline mr-1" />
              Esse aporte não cobre a reserva nem em 50 anos. Aumente o valor.
            </div>
          )}

          {/* Botão: criar meta */}
          <button className="btn-gold" onClick={criarMeta}
                  style={{ marginTop: 12, width: "100%" }}>
            <Plus size={13} className="inline mr-2" />
            Criar meta automática "Reserva de Emergência"
          </button>
        </div>
      )}

      {/* ===== Quando custo zero ===== */}
      {custoMensal === 0 && (
        <div style={{
          textAlign: "center", padding: "40px 24px",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 18,
        }}>
          <Shield size={36} style={{ color: T.gold, marginBottom: 12 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 18, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
            Comece preenchendo seu custo mensal
          </h3>
          <p style={{ color: T.muted, fontSize: 13, margin: 0, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
            Use "Valor Total" se já sabe, ou "Detalhado" pra somar categoria por categoria.
            Ou clica em "Puxar média dos últimos 3 meses" se já lança despesas no app.
          </p>
        </div>
      )}
    </div>
  );
}
