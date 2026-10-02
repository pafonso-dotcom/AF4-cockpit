import React, { useMemo, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { T } from "../../lib/theme.js";
import { fmtN } from "../../lib/format.js";
import { semanas, progressaoExercicio, exerciciosComCarga, seriesPorGrupo, analisarEvolucao } from "../../lib/evolucaoTreino.js";

/**
 * Evolução do treino com gráficos + análise (pedido 2026-10-02).
 */
const VERDE = "#4DD9C0";
const tituloSt = { fontSize: 13, fontWeight: 700, color: T.ink, marginBottom: 8 };
const caixa = { background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14, minWidth: 0 };
const tt = { contentStyle: { background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, fontSize: 12 }, labelStyle: { color: T.muted } };
const kg = (v) => v >= 1000 ? `${fmtN(v / 1000, 1)} t` : `${fmtN(v, 0)} kg`;

export default function TreinoEvolucao({ treinos = [], exerciciosDB = [] }) {
  const sem = useMemo(() => semanas(treinos, 12), [treinos]);
  const exs = useMemo(() => exerciciosComCarga(treinos, exerciciosDB), [treinos, exerciciosDB]);
  const [exSel, setExSel] = useState(null);
  const exId = exSel || exs[0]?.id;
  const prog = useMemo(() => exId ? progressaoExercicio(treinos, exId) : [], [treinos, exId]);
  const grupos = useMemo(() => seriesPorGrupo(treinos, exerciciosDB, 30), [treinos, exerciciosDB]);
  const a = useMemo(() => analisarEvolucao(treinos, exerciciosDB), [treinos, exerciciosDB]);
  const maxG = Math.max(1, ...grupos.map(g => g.series));
  const ganho = prog.length >= 2 ? prog[prog.length - 1].e1rm - prog[0].e1rm : 0;

  const kpi = (icone, rot, val, sub, cor = T.ink) => (
    <div style={{ ...caixa, padding: "12px 14px" }}>
      <div style={{ fontSize: 11.5, color: T.muted, fontWeight: 600 }}>{icone} {rot}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 800, color: cor, marginTop: 4 }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: T.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  if (!treinos.length) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>📈 Evolução</div>

      <div className="tela-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 12 }}>
        {kpi("🏋️", "Treinos (30 dias)", a.treinos30, `${fmtN(a.mediaSemana, 1)} por semana`)}
        {kpi("📦", "Volume (30 dias)", kg(a.volume30),
          a.varVolume == null ? "sem base de comparação" : `${a.varVolume >= 0 ? "+" : ""}${fmtN(a.varVolume, 0)}% vs 30 dias antes`,
          a.varVolume == null ? T.ink : a.varVolume >= 0 ? VERDE : T.red)}
        {kpi("🔥", "Sequência", `${a.sequencia} sem.`, "semanas seguidas treinando", a.sequencia >= 3 ? VERDE : T.ink)}
        {kpi("⏱️", "Último treino", a.diasSemTreino == null ? "—" : a.diasSemTreino === 0 ? "hoje" : `há ${a.diasSemTreino}d`, null, a.diasSemTreino >= 5 ? T.red : T.ink)}
      </div>

      {/* Análise */}
      {a.frases.length > 0 && (
        <div style={{ ...caixa, marginBottom: 12 }}>
          <div style={tituloSt}>🧠 Análise</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {a.frases.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: T.ink, lineHeight: 1.45 }}>
                <span>{f.tipo === "bom" ? "✅" : f.tipo === "alerta" ? "⚠️" : "💡"}</span><span>{f.txt}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@media (max-width: 760px) { .tev-duo { grid-template-columns: minmax(0,1fr) !important; } }`}</style>
      <div className="tev-duo" style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 12 }}>
        {/* Volume por semana */}
        <div style={caixa}>
          <div style={tituloSt}>Volume por semana <span style={{ color: T.faint, fontWeight: 500, fontSize: 11 }}>· kg levantados (carga × reps)</span></div>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sem} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={T.border} vertical={false} />
                <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: T.faint }} interval={1} />
                <YAxis tick={{ fontSize: 10, fill: T.faint }} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}t` : v} />
                <Tooltip {...tt} formatter={(v, n) => n === "volume" ? [kg(v), "Volume"] : [v, n]} labelFormatter={(l) => `Semana de ${l}`} />
                <Bar dataKey="volume" fill={VERDE} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {sem.map((w, i) => (
              <span key={i} title={`${w.rotulo}: ${w.treinos} treino(s)`} style={{ flex: 1, height: 6, borderRadius: 3, background: w.treinos ? VERDE : T.bgSoft, opacity: w.treinos ? Math.min(1, 0.35 + w.treinos * 0.2) : 1 }} />
            ))}
          </div>
          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 4 }}>frequência das últimas 12 semanas</div>
        </div>

        {/* Progressão por exercício */}
        <div style={caixa}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{ ...tituloSt, marginBottom: 0, flex: 1 }}>Progressão de carga</span>
            {exs.length > 0 && (
              <select value={exId || ""} onChange={e => setExSel(e.target.value)}
                      style={{ fontSize: 12, padding: "5px 8px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, width: "auto", maxWidth: 200 }}>
                {exs.map(x => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </select>
            )}
          </div>
          {prog.length >= 2 ? (<>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={prog} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={T.border} vertical={false} />
                  <XAxis dataKey="rotulo" tick={{ fontSize: 10, fill: T.faint }} />
                  <YAxis tick={{ fontSize: 10, fill: T.faint }} domain={["dataMin - 5", "dataMax + 5"]} />
                  <Tooltip {...tt} formatter={(v, n) => [`${v} kg`, n === "e1rm" ? "1RM estimado" : "Maior carga"]} />
                  <Line type="monotone" dataKey="e1rm" stroke={T.gold} strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="carga" stroke={VERDE} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11.5, color: T.muted, marginTop: 6, flexWrap: "wrap" }}>
              <span><span style={{ color: VERDE }}>●</span> maior carga</span>
              <span><span style={{ color: T.gold }}>●</span> 1RM estimado</span>
              <span style={{ marginLeft: "auto", fontWeight: 700, color: ganho > 0 ? VERDE : ganho < 0 ? T.red : T.muted }}>
                {ganho > 0 ? "+" : ""}{ganho} kg desde o início
              </span>
            </div>
          </>) : (
            <div style={{ fontSize: 12.5, color: T.muted, padding: "30px 0", textAlign: "center" }}>
              {exs.length ? "Faça pelo menos 2 treinos com carga neste exercício pra ver a linha." : "Registre a carga nas séries pra ver a progressão."}
            </div>
          )}
        </div>
      </div>

      {/* Séries por grupo muscular */}
      {grupos.length > 0 && (
        <div style={{ ...caixa, marginTop: 12 }}>
          <div style={tituloSt}>Séries por grupo muscular <span style={{ color: T.faint, fontWeight: 500, fontSize: 11 }}>· últimos 30 dias</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {grupos.map(g => (
              <div key={g.grupo} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
                <span style={{ width: 120, flexShrink: 0, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.grupo}</span>
                <div style={{ flex: 1, height: 8, borderRadius: 99, background: T.bgSoft, overflow: "hidden" }}>
                  <div style={{ width: `${(g.series / maxG) * 100}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${VERDE}, ${T.gold})` }} />
                </div>
                <span className="num" style={{ width: 32, textAlign: "right", color: T.muted }}>{g.series}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
