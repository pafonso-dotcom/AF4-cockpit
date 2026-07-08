import React, { useMemo, useState } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CalendarX, Copy, PieChart } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtP, todayISO } from "../../lib/format.js";
import PageHeader from "../ui/PageHeader.jsx";
import { revisarGanhos } from "../../lib/revisorGanhos.js";

const CARD = {
  background: T.card,
  border: `1px solid ${T.border}`,
  borderRadius: 16,
  padding: 16,
};

const oculto = (v, hidden) => (hidden ? "••••" : v);

function nomeMes(mesISO) {
  const [a, m] = mesISO.split("-").map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Revisor de ganhos — auditoria das receitas do mês.
 * Mostra total vs mês anterior, composição da renda, recorrentes que não
 * entraram e receitas duplicadas. Só dados locais.
 */
export default function RevisorGanhos({ transacoes = [], hidden = false, embed = false }) {
  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const rev = useMemo(() => revisarGanhos(transacoes, mes), [transacoes, mes]);

  const maxSerie = Math.max(...rev.serie.map((s) => s.total), 1);
  const sobe = rev.variacaoPct != null && rev.variacaoPct >= 0;

  const seletorMes = (
    <input
      type="month"
      value={mes}
      onChange={(e) => setMes(e.target.value)}
      style={{
        background: T.bgSoft, color: T.ink, border: `1px solid ${T.border}`,
        borderRadius: 10, padding: "6px 10px", fontSize: 13, fontFamily: "inherit",
      }}
    />
  );
  return (
    <div className={embed ? "" : "fade-up py-8 px-6"}>
      {!embed ? (
        <PageHeader
          eyebrow="Finanças · Revisor de ganhos"
          title={<>Revisor de <em>ganhos.</em></>}
          sub="Auditoria das suas receitas: variação, fontes, recorrentes que faltaram e duplicadas."
          action={seletorMes}
        />
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>{seletorMes}</div>
      )}

      {/* KPI principal + série */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 8 }}>
        <div style={CARD}>
          <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600 }}>
            Ganhos · {nomeMes(mes)}
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, color: T.ink, marginTop: 6 }}>
            {oculto(fmt(rev.total), hidden)}
          </div>
          {rev.variacaoPct != null ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, color: sobe ? T.green : T.red, fontWeight: 700, fontSize: 13 }}>
              {sobe ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {fmtP(rev.variacaoPct)} vs mês anterior ({oculto(fmt(rev.totalAnterior), hidden)})
            </div>
          ) : (
            <div style={{ marginTop: 6, color: T.faint, fontSize: 12.5 }}>Sem receita no mês anterior pra comparar.</div>
          )}
        </div>

        {/* Série 6 meses */}
        <div style={CARD}>
          <div style={{ fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", color: T.muted, fontWeight: 600, marginBottom: 10 }}>
            Últimos 6 meses
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
            {rev.serie.map((s) => {
              const h = Math.max(4, (s.total / maxSerie) * 72);
              const atual = s.mes === mes;
              return (
                <div key={s.mes} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div title={oculto(fmt(s.total), hidden)} style={{ width: "100%", height: h, background: atual ? T.gold : T.borderHi, borderRadius: 6 }} />
                  <span style={{ fontSize: 9.5, color: atual ? T.ink : T.faint, fontWeight: atual ? 700 : 400 }}>
                    {s.mes.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Composição da renda */}
      <div style={{ ...CARD, marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <PieChart size={15} style={{ color: T.gold }} />
          <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Composição da renda</h3>
        </div>
        {rev.fontes.length === 0 ? (
          <div style={{ color: T.faint, fontSize: 13, fontStyle: "italic" }}>Nenhuma receita registrada neste mês.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rev.concentracao && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: `${T.yellow}1a`, border: `1px solid ${T.yellow}55`, borderRadius: 10, color: T.ink, fontSize: 12.5 }}>
                <AlertTriangle size={14} style={{ color: T.yellow, flexShrink: 0 }} />
                Renda concentrada: <b>{rev.concentracao.fonte}</b> representa {rev.concentracao.pct.toFixed(0)}% do total.
              </div>
            )}
            {rev.fontes.map((f) => (
              <div key={f.fonte}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: T.ink, fontWeight: 600 }}>{f.fonte}</span>
                  <span style={{ color: T.muted }}>{oculto(fmt(f.valor), hidden)} · {f.pct.toFixed(0)}%</span>
                </div>
                <div style={{ height: 8, background: T.bgSoft, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${f.pct}%`, height: "100%", background: T.gold, borderRadius: 5 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recorrentes que faltaram + duplicadas */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginTop: 12 }}>
        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <CalendarX size={15} style={{ color: T.red }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Esperadas que não entraram</h3>
          </div>
          {rev.faltando.length === 0 ? (
            <div style={{ color: T.faint, fontSize: 13, fontStyle: "italic" }}>Tudo certo — nenhuma receita recorrente faltando.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rev.faltando.map((f) => (
                <div key={f.descricao} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: `${T.red}12`, border: `1px solid ${T.red}40`, borderRadius: 10 }}>
                  <div>
                    <div style={{ color: T.ink, fontWeight: 600, fontSize: 13 }}>{f.descricao}</div>
                    <div style={{ color: T.faint, fontSize: 11 }}>visto em {f.mesesVistos} meses · última {f.ultimaData.split("-").reverse().join("/")}</div>
                  </div>
                  <span style={{ color: T.red, fontWeight: 700, fontSize: 13 }}>~{oculto(fmt(f.valorTipico), hidden)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={CARD}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Copy size={15} style={{ color: T.yellow }} />
            <h3 style={{ fontSize: 13, fontWeight: 700, color: T.ink, margin: 0 }}>Possíveis duplicadas</h3>
          </div>
          {rev.duplicadas.length === 0 ? (
            <div style={{ color: T.faint, fontSize: 13, fontStyle: "italic" }}>Nenhuma receita duplicada no mês.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rev.duplicadas.map((dp, i) => (
                <div key={`${dp.descricao}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: `${T.yellow}12`, border: `1px solid ${T.yellow}40`, borderRadius: 10 }}>
                  <div style={{ color: T.ink, fontWeight: 600, fontSize: 13 }}>
                    {dp.descricao}
                    <span style={{ color: T.faint, fontWeight: 400, fontSize: 11 }}> · {dp.ocorrencias}×</span>
                  </div>
                  <span style={{ color: T.ink, fontWeight: 700, fontSize: 13 }}>{oculto(fmt(dp.valor), hidden)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
