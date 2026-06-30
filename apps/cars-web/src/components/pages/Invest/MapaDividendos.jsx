import React, { useMemo, useState, useEffect } from "react";
import { CalendarDays, Plus, Trash2, Info, TrendingUp, AlertTriangle } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import PageHeader from "../../ui/PageHeader.jsx";
import { carregarFundamentos } from "../../../lib/fundamentosLocal.js";
import { montarMapaDividendos, MESES_PT } from "../../../lib/mapaDividendos.js";

const KEY_OV = "af4:mapa-div:overrides:v1";
const KEY_CAND = "af4:mapa-div:candidatos:v1";
const CARD = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16 };
const TIPOS = [{ v: "acao", l: "Ação" }, { v: "fii", l: "FII" }, { v: "stock", l: "Stock (US)" }, { v: "reit", l: "REIT (US)" }];

const ler = (k, fb) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : fb; } catch { return fb; } };
const grava = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const oculto = (v, h) => (h ? "•••" : v);

/**
 * Mapa de Dividendos — grade Ativo × Mês com renda estimada, pra montar uma
 * carteira que paga o ano todo. Híbrido: FII mensal, ação trimestral, meses
 * inferidos do histórico de proventos e ajustáveis no clique. Inclui candidatos
 * (planejados) pra preencher as lacunas antes de comprar.
 */
export default function MapaDividendos({ ativos = [], proventosManuais = [], hidden = false }) {
  const [overrides, setOverrides] = useState(() => ler(KEY_OV, {}));
  const [candidatos, setCandidatos] = useState(() => ler(KEY_CAND, []));
  const [form, setForm] = useState({ ticker: "", tipo: "fii", valorPlanejado: "", dy: "" });
  const [verDicas, setVerDicas] = useState(false);

  useEffect(() => grava(KEY_OV, overrides), [overrides]);
  useEffect(() => grava(KEY_CAND, candidatos), [candidatos]);

  const fundamentos = useMemo(() => carregarFundamentos(), []);
  const mapa = useMemo(
    () => montarMapaDividendos({ ativos, candidatos, overrides, proventosManuais, fundamentos }),
    [ativos, candidatos, overrides, proventosManuais, fundamentos]
  );

  const maxTotal = Math.max(...mapa.totaisPorMes, 1);

  function toggleMes(row, m) {
    const atuais = new Set(row.meses);
    if (atuais.has(m)) atuais.delete(m); else atuais.add(m);
    setOverrides((prev) => ({ ...prev, [row.ticker]: { meses: [...atuais].sort((a, b) => a - b) } }));
  }

  function addCandidato(e) {
    e?.preventDefault();
    const tk = form.ticker.trim().toUpperCase();
    if (!tk) return;
    if (candidatos.some((c) => c.ticker.toUpperCase() === tk)) { setForm({ ...form, ticker: "" }); return; }
    setCandidatos((prev) => [...prev, {
      ticker: tk, tipo: form.tipo,
      valorPlanejado: Number(form.valorPlanejado) || 0,
      dy: form.dy ? Number(form.dy) : undefined,
    }]);
    setForm({ ticker: "", tipo: form.tipo, valorPlanejado: "", dy: "" });
  }
  const removerCandidato = (tk) => {
    setCandidatos((prev) => prev.filter((c) => c.ticker.toUpperCase() !== tk.toUpperCase()));
    setOverrides((prev) => { const n = { ...prev }; delete n[tk]; return n; });
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="Investimentos · Mapa de Dividendos"
        title={<>Mapa de <em>Dividendos.</em></>}
        sub="Combine ativos com calendários complementares e monte uma renda que paga o ano todo."
        action={
          <button onClick={() => setVerDicas((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `1px solid ${T.border}`, color: T.muted, borderRadius: 10, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}>
            <Info size={13} /> Como usar
          </button>
        }
      />

      {verDicas && (
        <div style={{ ...CARD, marginTop: 8, fontSize: 12.5, color: T.muted, lineHeight: 1.6 }}>
          <b style={{ color: T.ink }}>A lógica do mapa:</b> ao combinar empresas/FIIs que pagam em meses diferentes, você cria uma renda recorrente o ano todo. Pra usar bem:
          <div style={{ marginTop: 8 }}>1. <b style={{ color: T.ink }}>Consistência vs. data:</b> não escolha só pelo mês — veja histórico de lucros e política de dividendos sustentável.</div>
          <div>2. <b style={{ color: T.ink }}>Indicadores:</b> confira o <b>DY</b> (dividendos ÷ preço) e o <b>Payout</b> (% do lucro distribuído).</div>
          <div>3. <b style={{ color: T.ink }}>Data "Com" e "Ex":</b> pra receber, você precisa ter a ação até a Data Com. Comprou na Data Ex, não recebe aquele ciclo.</div>
        </div>
      )}

      {/* Resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 12 }}>
        <div style={CARD}>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Renda mensal média</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.green, marginTop: 4 }}>{oculto(fmt(mapa.rendaMensalMedia), hidden)}</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Renda anual estimada</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, marginTop: 4 }}>{oculto(fmt(mapa.rendaAnualTotal), hidden)}</div>
        </div>
        <div style={CARD}>
          <div style={{ fontSize: 10.5, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>Meses sem renda</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: mapa.lacunas.length ? T.yellow : T.green, marginTop: 4 }}>
            {mapa.lacunas.length} {mapa.lacunas.length === 1 ? "mês" : "meses"}
          </div>
          {mapa.lacunas.length > 0 && (
            <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>{mapa.lacunas.map((m) => MESES_PT[m]).join(", ")}</div>
          )}
        </div>
      </div>

      {/* Grade Ativo × Mês */}
      <div style={{ ...CARD, marginTop: 12, padding: 0, overflowX: "auto" }}>
        {mapa.rows.length === 0 ? (
          <div style={{ padding: 28, textAlign: "center", color: T.faint, fontSize: 13, fontStyle: "italic" }}>
            Nenhum ativo pagador de dividendos. Adicione candidatos abaixo ou inclua ações/FIIs na sua carteira.
          </div>
        ) : (
          <table style={{ width: "100%", minWidth: 720, borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                <th style={{ textAlign: "left", padding: "10px 12px", color: T.muted, fontWeight: 600, position: "sticky", left: 0, background: T.card }}>Ativo</th>
                <th style={{ textAlign: "right", padding: "10px 6px", color: T.muted, fontWeight: 600 }}>DY</th>
                {MESES_PT.map((m, i) => (
                  <th key={i} style={{ textAlign: "center", padding: "10px 2px", color: T.faint, fontWeight: 600, minWidth: 26 }}>{m[0]}</th>
                ))}
                <th style={{ textAlign: "right", padding: "10px 12px", color: T.muted, fontWeight: 600 }}>Ano</th>
              </tr>
            </thead>
            <tbody>
              {mapa.rows.map((r) => (
                <tr key={r.ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
                  <td style={{ padding: "8px 12px", position: "sticky", left: 0, background: T.card }}>
                    <div style={{ fontWeight: 700, color: T.ink, display: "flex", alignItems: "center", gap: 6 }}>
                      {r.ticker}
                      {r.candidato && <span style={{ fontSize: 8.5, padding: "1px 5px", borderRadius: 4, background: `${T.gold}22`, color: T.gold, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase" }}>plano</span>}
                    </div>
                    <div style={{ fontSize: 9.5, color: T.faint, textTransform: "uppercase", letterSpacing: ".05em" }}>{r.tipo}</div>
                  </td>
                  <td style={{ textAlign: "right", padding: "8px 6px", color: T.muted, whiteSpace: "nowrap" }}>{r.dy.toFixed(1)}%</td>
                  {MESES_PT.map((_, m) => {
                    const paga = r.meses.includes(m);
                    return (
                      <td key={m} style={{ textAlign: "center", padding: "6px 2px" }}>
                        <button
                          onClick={() => toggleMes(r, m)}
                          title={paga ? `${oculto(fmt(r.rendaPorMes[m]), hidden)} — clique pra tirar` : "clique pra marcar pagamento"}
                          style={{
                            width: 18, height: 18, borderRadius: 5, cursor: "pointer",
                            border: paga ? "none" : `1px dashed ${T.border}`,
                            background: paga ? T.green : "transparent",
                            display: "inline-block",
                          }}
                        />
                      </td>
                    );
                  })}
                  <td style={{ textAlign: "right", padding: "8px 12px", color: T.ink, fontWeight: 600, whiteSpace: "nowrap" }}>{oculto(fmt(r.rendaAnual), hidden)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${T.border}` }}>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: T.ink, position: "sticky", left: 0, background: T.card }}>Renda / mês</td>
                <td />
                {mapa.totaisPorMes.map((v, m) => {
                  const lac = v <= 0.005;
                  return (
                    <td key={m} style={{ textAlign: "center", padding: "8px 2px", verticalAlign: "bottom" }}>
                      <div title={lac ? "lacuna — sem renda" : oculto(fmt(v), hidden)} style={{
                        width: 10, height: Math.max(3, (v / maxTotal) * 34), margin: "0 auto",
                        borderRadius: 2, background: lac ? T.red : T.green, opacity: lac ? 0.5 : 1,
                      }} />
                      <div style={{ fontSize: 8, color: lac ? T.red : T.faint, marginTop: 2 }}>{lac ? "—" : ""}</div>
                    </td>
                  );
                })}
                <td style={{ textAlign: "right", padding: "10px 12px", fontWeight: 800, color: T.green, whiteSpace: "nowrap" }}>{oculto(fmt(mapa.rendaAnualTotal), hidden)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
      <div style={{ fontSize: 11, color: T.faint, marginTop: 6 }}>
        ● mês com pagamento (clique numa célula pra marcar/tirar). Renda estimada por DY médio da classe — ajuste fino vem do seu histórico de proventos.
      </div>

      {/* Candidatos / planejamento */}
      <div style={{ ...CARD, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <CalendarDays size={15} style={{ color: T.gold }} />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Planejar candidatos</h3>
          <span style={{ fontSize: 11, color: T.faint }}>papéis que você ainda não tem, pra preencher as lacunas</span>
        </div>
        <form onSubmit={addCandidato} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="Ticker (ex.: MXRF11)"
                 style={{ flex: "1 1 130px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, textTransform: "uppercase", fontFamily: "inherit" }} />
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, fontFamily: "inherit" }}>
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
          </select>
          <input value={form.valorPlanejado} onChange={(e) => setForm({ ...form, valorPlanejado: e.target.value })} placeholder="R$ planejado" inputMode="numeric"
                 style={{ width: 120, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
          <input value={form.dy} onChange={(e) => setForm({ ...form, dy: e.target.value })} placeholder="DY% (opc.)" inputMode="decimal"
                 style={{ width: 90, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 9, padding: "8px 10px", color: T.ink, fontSize: 13, fontFamily: "inherit" }} />
          <button type="submit" style={{ display: "flex", alignItems: "center", gap: 6, background: T.gold, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            <Plus size={14} /> Adicionar
          </button>
        </form>
        {candidatos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
            {candidatos.map((c) => (
              <span key={c.ticker} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 999, padding: "5px 6px 5px 12px", fontSize: 12, color: T.ink }}>
                <b>{c.ticker}</b>
                <span style={{ color: T.faint }}>{oculto(fmt(Number(c.valorPlanejado) || 0), hidden)}</span>
                <button onClick={() => removerCandidato(c.ticker)} title="Remover" style={{ background: "transparent", border: "none", color: T.faint, cursor: "pointer", display: "flex" }}>
                  <Trash2 size={13} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
