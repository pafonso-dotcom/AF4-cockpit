import React, { useMemo, useState, useEffect } from "react";
import { Wallet, Home, TrendingUp, AlertTriangle, Target, Sparkles, Plus, Trash2, Settings2 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import PageHeader from "../../ui/PageHeader.jsx";
import { montarPlano } from "../../../lib/planejador.js";

const KEY = "af4:planejador:v1";
const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };
const oculto = (v, h) => (h ? "•••" : v);

const ler = () => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } };
const grava = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

// Média mensal de receitas/despesas dos últimos N meses (regime de caixa).
function mediasMensais(transacoes = [], nMeses = 3) {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth() - (nMeses - 1), 1).toISOString().slice(0, 7);
  let rec = 0, desp = 0;
  for (const t of transacoes) {
    const m = String(t?.data || "").slice(0, 7);
    if (!m || m < ini) continue;
    if (t.tipo === "receita") rec += Number(t.valor) || 0;
    else if (t.tipo === "despesa") desp += Number(t.valor) || 0;
  }
  return { receita: rec / nMeses, despesa: desp / nMeses };
}

const ONDE = {
  reserva: "CDB de liquidez diária ou Tesouro Selic",
  duravel: "Tesouro IPCA+ (NTN-B), no prazo da meta",
  riqueza: "Carteira multiativos de longo prazo",
};

const Campo = ({ label, value, onChange, sufixo, w = 120 }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: T.muted }}>
    {label}
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input value={value} inputMode="decimal" onChange={(e) => onChange(e.target.value)}
        style={{ width: w, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "7px 9px", color: T.ink, fontSize: 13.5, fontFamily: "inherit" }} />
      {sufixo && <span style={{ color: T.faint, fontSize: 11 }}>{sufixo}</span>}
    </span>
  </label>
);

/**
 * Planejador "Paz Financeira" — método dos 3 baldes. Pega a sobra do mês e diz
 * o que fazer com ela (reserva / bens duráveis / riqueza), com PMT por meta e
 * projeção de riqueza. Educacional — não é recomendação de investimento.
 */
export default function Planejador({ transacoes = [], hidden = false }) {
  const medias = useMemo(() => mediasMensais(transacoes), [transacoes]);
  const [cfg, setCfg] = useState(() => ler() || {
    sobra: Math.max(0, Math.round(medias.receita - medias.despesa)),
    despesaEssencial: Math.round(medias.despesa) || 0,
    mesesReserva: 6, saldoReserva: 0, saldoRiqueza: 0, dividaCara: 0,
    idadeAtual: 35, idadeAposentadoria: 60,
    bensDuraveis: [],
    premissas: { retReserva: 0.11, retDuravel: 0.11, retRiqueza: 0.12, inflacao: 0.0426, pisoRiqueza: 0.05, prazoReserva: 12 },
  });
  const [verAvancado, setVerAvancado] = useState(false);
  useEffect(() => grava(cfg), [cfg]);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v === "" ? "" : (isNaN(Number(v)) ? v : Number(v)) }));
  const setP = (k, v) => setCfg((c) => ({ ...c, premissas: { ...c.premissas, [k]: Number(v) || 0 } }));
  const addBem = () => setCfg((c) => ({ ...c, bensDuraveis: [...(c.bensDuraveis || []), { nome: "", valor: "", meses: 36, jaTenho: "" }] }));
  const setBem = (i, k, v) => setCfg((c) => ({ ...c, bensDuraveis: c.bensDuraveis.map((b, j) => j === i ? { ...b, [k]: k === "nome" ? v : (v === "" ? "" : Number(v)) } : b) }));
  const delBem = (i) => setCfg((c) => ({ ...c, bensDuraveis: c.bensDuraveis.filter((_, j) => j !== i) }));

  const plano = useMemo(() => montarPlano(cfg), [cfg]);
  const balde = [
    { id: "reserva", label: "Reserva de emergência", icon: Wallet, cor: T.green, valor: plano.baldes.reserva },
    { id: "duravel", label: "Bens duráveis", icon: Home, cor: T.blue || "#60a5fa", valor: plano.baldes.duravel },
    { id: "riqueza", label: "Riqueza de longo prazo", icon: TrendingUp, cor: T.gold, valor: plano.baldes.riqueza },
  ];

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Investimentos · Planejador"
        title={<>Planejador de <em>Paz Financeira.</em></>}
        sub="Sua sobra do mês dividida em 3 baldes — reserva, bens duráveis e riqueza — com projeção e metas."
        action={
          <button onClick={() => setVerAvancado((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}>
            <Settings2 size={13} /> Editar dados
          </button>
        }
      />

      {/* Entradas */}
      {verAvancado && (
        <div style={{ ...CARD, marginTop: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
            <Campo label="Sobra do mês p/ investir" value={cfg.sobra} onChange={(v) => set("sobra", v)} sufixo="R$" w={130} />
            <Campo label="Custo de vida essencial/mês" value={cfg.despesaEssencial} onChange={(v) => set("despesaEssencial", v)} sufixo="R$" w={130} />
            <Campo label="Reserva: meses de despesa" value={cfg.mesesReserva} onChange={(v) => set("mesesReserva", v)} w={70} />
            <Campo label="Já tenho de reserva" value={cfg.saldoReserva} onChange={(v) => set("saldoReserva", v)} sufixo="R$" />
            <Campo label="Já tenho de riqueza" value={cfg.saldoRiqueza} onChange={(v) => set("saldoRiqueza", v)} sufixo="R$" />
            <Campo label="Dívida cara hoje (cartão/cheque esp.)" value={cfg.dividaCara} onChange={(v) => set("dividaCara", v)} sufixo="R$" w={130} />
            <Campo label="Idade atual" value={cfg.idadeAtual} onChange={(v) => set("idadeAtual", v)} w={64} />
            <Campo label="Idade de aposentadoria" value={cfg.idadeAposentadoria} onChange={(v) => set("idadeAposentadoria", v)} w={64} />
          </div>

          {/* Bens duráveis */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: T.muted, marginBottom: 6, letterSpacing: ".05em", textTransform: "uppercase", fontWeight: 600 }}>Bens duráveis que quer comprar</div>
            {(cfg.bensDuraveis || []).map((b, i) => (
              <div key={i} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <input value={b.nome} onChange={(e) => setBem(i, "nome", e.target.value)} placeholder="Ex.: Entrada do apê"
                  style={{ flex: "1 1 150px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 9px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
                <input value={b.valor} inputMode="numeric" onChange={(e) => setBem(i, "valor", e.target.value)} placeholder="Valor R$"
                  style={{ width: 110, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 9px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
                <input value={b.meses} inputMode="numeric" onChange={(e) => setBem(i, "meses", e.target.value)} placeholder="meses"
                  style={{ width: 72, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 9px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
                <input value={b.jaTenho} inputMode="numeric" onChange={(e) => setBem(i, "jaTenho", e.target.value)} placeholder="já tenho"
                  style={{ width: 100, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 8, padding: "6px 9px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
                <button onClick={() => delBem(i)} style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", display: "flex" }}><Trash2 size={15} /></button>
              </div>
            ))}
            <button onClick={addBem} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px dashed ${T.border}`, color: T.muted, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer", marginTop: 4 }}>
              <Plus size={13} /> Adicionar bem
            </button>
          </div>

          {/* Premissas */}
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 14, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
            <Campo label="Retorno riqueza (a.a.)" value={cfg.premissas.retRiqueza} onChange={(v) => setP("retRiqueza", v)} sufixo="ex: 0.12" w={80} />
            <Campo label="Retorno reserva/duráveis" value={cfg.premissas.retReserva} onChange={(v) => { setP("retReserva", v); setP("retDuravel", v); }} sufixo="a.a." w={80} />
            <Campo label="Inflação (a.a.)" value={cfg.premissas.inflacao} onChange={(v) => setP("inflacao", v)} w={80} />
          </div>
        </div>
      )}

      {/* Alerta de dívida cara */}
      {plano.quitarDividaPrimeiro && (
        <div style={{ ...CARD, marginTop: 12, background: `${T.red}12`, border: `1px solid ${T.red}44`, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertTriangle size={18} style={{ color: T.red, flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: T.ink }}>
            <b>Primeiro: quite a dívida cara</b> ({oculto(fmt(plano.dividaCara), hidden)}). Cartão/cheque especial custam mais de 100% ao ano — nada que você invista rende mais. Volte a investir quando quitar.
          </div>
        </div>
      )}

      {/* O que fazer este mês — 3 baldes */}
      <div style={{ ...CARD, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Sparkles size={15} style={{ color: T.gold }} />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>O que fazer este mês</h3>
        </div>
        <div style={{ fontSize: 12, color: T.muted, marginBottom: 12 }}>Sua sobra de <b style={{ color: T.ink }}>{oculto(fmt(plano.sobra), hidden)}</b> dividida assim:</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
          {balde.map((b) => (
            <div key={b.id} style={{ border: `1px solid ${b.cor}44`, borderRadius: 12, padding: 12, background: `${b.cor}0c` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <b.icon size={15} style={{ color: b.cor }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink }}>{b.label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: b.cor, marginTop: 6 }}>{oculto(fmt(b.valor), hidden)}<span style={{ fontSize: 12, color: T.faint, fontWeight: 500 }}>/mês</span></div>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>{ONDE[b.id]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Projeção de riqueza */}
      {plano.projecao.meses > 0 && (
        <div style={{ ...CARD, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <TrendingUp size={15} style={{ color: T.gold }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Sua riqueza projetada</h3>
          </div>
          <div style={{ fontSize: 13, color: T.ink }}>
            Aportando <b>{oculto(fmt(plano.baldes.riqueza), hidden)}/mês</b> na riqueza, ela pode chegar a <b style={{ color: T.green }}>{oculto(fmt(plano.projecao.fv), hidden)}</b> em {plano.projecao.anos} anos (aos {cfg.idadeAposentadoria}).
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>
            Em valor de hoje (descontada a inflação): <b style={{ color: T.ink }}>{oculto(fmt(plano.projecao.vp), hidden)}</b>. Quando você quita dívidas e completa a reserva, sobra mais pra riqueza — e esse número cresce.
          </div>
        </div>
      )}

      {/* Metas com PMT */}
      {plano.metas.length > 0 && (
        <div style={{ ...CARD, marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Target size={15} style={{ color: T.gold }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Aporte por meta (pra cumprir no prazo)</h3>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 460, borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}`, color: T.muted, textAlign: "right" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px" }}>Meta</th>
                  <th style={{ padding: "6px 8px" }}>Alvo</th>
                  <th style={{ padding: "6px 8px" }}>Já tenho</th>
                  <th style={{ padding: "6px 8px" }}>Prazo</th>
                  <th style={{ padding: "6px 8px" }}>Aporte/mês</th>
                </tr>
              </thead>
              <tbody>
                {plano.metas.map((m, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                    <td style={{ textAlign: "left", padding: "8px", color: T.ink, fontWeight: 600 }}>{m.nome}</td>
                    <td style={{ textAlign: "right", padding: "8px", color: T.muted }}>{oculto(fmt(m.alvo), hidden)}</td>
                    <td style={{ textAlign: "right", padding: "8px", color: T.muted }}>{oculto(fmt(m.saldo), hidden)}</td>
                    <td style={{ textAlign: "right", padding: "8px", color: T.muted }}>{m.meses}m</td>
                    <td style={{ textAlign: "right", padding: "8px", color: T.gold, fontWeight: 700 }}>{oculto(fmt(m.pmt), hidden)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ fontSize: 10.5, color: T.faint, marginTop: 10, fontStyle: "italic" }}>
        Ferramenta educacional — não constitui recomendação de investimento. Rentabilidade passada não garante o futuro.
      </div>
    </div>
  );
}
