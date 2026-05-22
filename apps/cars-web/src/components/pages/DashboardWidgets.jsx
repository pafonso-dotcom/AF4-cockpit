import React, { useMemo } from "react";
import { CreditCard, AlertCircle, Users, Zap, Bell, AlarmClock } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";

export default function DashboardWidgets({ transacoes, categorias, devedores, dividas, parcelamentos, hidden }) {
  // Próximos vencimentos: pendentes ordenados por data, próximos 7 dias e atrasados
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const in7Days = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const proxVenc = useMemo(() => {
    const out = [];
    transacoes.forEach(t => {
      if (t.compensado) return;
      // For fixed monthly bills, compute the next due date
      if (t.fixa && t.vencimento) {
        const m = today.getMonth();
        const y = today.getFullYear();
        const d = t.vencimento;
        const cur = new Date(y, m, d);
        if (cur < today) cur.setMonth(cur.getMonth() + 1);
        const iso = cur.toISOString().slice(0, 10);
        out.push({ ...t, _date: iso, _atrasada: false });
      } else if (t.data) {
        out.push({ ...t, _date: t.data, _atrasada: t.data < todayStr });
      }
    });
    return out
      .filter(t => t._atrasada || (t._date >= todayStr && t._date <= in7Days))
      .sort((a, b) => a._date.localeCompare(b._date))
      .slice(0, 6);
  }, [transacoes, todayStr, in7Days]);

  // Alertas de orçamento
  const alertasOrc = useMemo(() => {
    const gastoPorCat = {};
    transacoes.filter(t => t.tipo === "despesa").forEach(t => {
      gastoPorCat[t.categoria] = (gastoPorCat[t.categoria] || 0) + Number(t.valor || 0);
    });
    return categorias
      .filter(c => c.tipo === "despesa" && c.limite > 0)
      .map(c => {
        const gasto = gastoPorCat[c.nome] || 0;
        const pct = (gasto / c.limite) * 100;
        return { ...c, gasto, pct, estado: pct >= 100 ? "estourado" : pct >= 80 ? "alerta" : "ok" };
      })
      .filter(c => c.estado !== "ok")
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4);
  }, [categorias, transacoes]);

  // Devedores resumo
  const devAReceber = devedores.filter(d => !d.recebido);
  const totalAReceber = devAReceber.reduce((s, d) => s + Number(d.valor || 0), 0);

  // Parcelamentos próximos
  const parcAtivos = parcelamentos.filter(p => (p.parcelasPagas?.length || 0) < p.totalParcelas).length;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
      {/* Próximos vencimentos */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
        <div className="flex items-center gap-2 mb-4">
          <AlarmClock size={18} style={{ color: T.gold }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>Próximos vencimentos</h3>
        </div>
        {proxVenc.length === 0 ? (
          <div style={{ color: T.muted, fontStyle: "italic", padding: "8px 0" }}>
            Tudo em dia para os próximos 7 dias. ✨
          </div>
        ) : (
          <div className="space-y-2">
            {proxVenc.map((t, i) => {
              const cat = categorias.find(c => c.nome === t.categoria);
              return (
                <div key={i} className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid ${T.border}` }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: t._atrasada ? `${T.red}22` : `${T.gold}22`,
                    color: t._atrasada ? T.red : T.gold,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    {t._atrasada ? <Bell size={14} /> : <AlarmClock size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ color: T.ink, fontSize: 14, fontWeight: 500 }} className="truncate">{t.descricao}</div>
                    <div className="flex gap-2 text-xs items-center" style={{ color: T.muted }}>
                      {cat && <span style={{ color: cat.cor }}>● {cat.nome}</span>}
                      <span className="num">{t._date}</span>
                      {t._atrasada && (
                        <span style={{ color: T.red, fontWeight: 500, letterSpacing: "0.1em", textTransform: "uppercase", fontSize: 9 }}>Atrasada</span>
                      )}
                      {t.fixa && <span style={{ color: T.blue }}>Fixa</span>}
                    </div>
                  </div>
                  <div className="num text-right" style={{ color: t.tipo === "receita" ? T.green : T.red, fontWeight: 600 }}>
                    {t.tipo === "receita" ? "+" : "−"} {hidden ? "•••" : fmt(t.valor)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Alertas de orçamento */}
      <div style={{ background: T.card, border: `1px solid ${T.border}`, padding: 24 }}>
        <div className="flex items-center gap-2 mb-4">
          <Zap size={18} style={{ color: alertasOrc.length > 0 ? T.red : T.green }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 600 }}>Alertas de orçamento</h3>
        </div>
        {alertasOrc.length === 0 ? (
          <div style={{ color: T.muted, fontStyle: "italic", padding: "8px 0" }}>
            Todas as categorias dentro do limite. 👌
          </div>
        ) : (
          <div className="space-y-3">
            {alertasOrc.map(c => {
              const cor = c.estado === "estourado" ? T.red : T.gold;
              return (
                <div key={c.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2">
                      <span style={{ width: 10, height: 10, background: c.cor, borderRadius: 2 }} />
                      <span style={{ color: T.ink, fontSize: 14, fontWeight: 500 }}>{c.nome}</span>
                      {c.estado === "estourado" && (
                        <span style={{ background: `${T.red}22`, color: T.red, padding: "1px 6px", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>
                          Estourado
                        </span>
                      )}
                    </div>
                    <div className="num text-sm" style={{ color: cor, fontWeight: 600 }}>
                      {fmtN(c.pct, 0)}%
                    </div>
                  </div>
                  <div className="flex justify-between text-xs num mb-1" style={{ color: T.muted }}>
                    <span>{hidden ? "•••" : fmt(c.gasto)}</span>
                    <span>{hidden ? "•••" : fmt(c.limite)}</span>
                  </div>
                  <div style={{ background: T.border, height: 5 }}>
                    <div style={{ width: `${Math.min(100, c.pct)}%`, background: cor, height: "100%", transition: "width 0.6s",
                                   boxShadow: c.estado === "estourado" ? `0 0 8px ${T.red}` : "none" }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom row: snapshots */}
      <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-px" style={{ background: T.border }}>
        <div style={{ background: T.card, padding: 18 }} className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.blue}22`, color: T.blue,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Users size={18} />
          </div>
          <div>
            <div className="label-eyebrow">A receber de devedores</div>
            <div className="num" style={{ color: T.ink, fontSize: 18, fontWeight: 600 }}>{hidden ? "•••" : fmt(totalAReceber)}</div>
            <div style={{ color: T.muted, fontSize: 11 }}>{devAReceber.length} pessoas</div>
          </div>
        </div>
        <div style={{ background: T.card, padding: 18 }} className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.red}22`, color: T.red,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={18} />
          </div>
          <div>
            <div className="label-eyebrow">Dívidas em aberto</div>
            <div className="num" style={{ color: T.ink, fontSize: 18, fontWeight: 600 }}>
              {hidden ? "•••" : fmt(dividas.reduce((s, d) => s + Number(d.valor || 0) * Number(d.parcelasRestantes || 1), 0))}
            </div>
            <div style={{ color: T.muted, fontSize: 11 }}>{dividas.length} compromissos</div>
          </div>
        </div>
        <div style={{ background: T.card, padding: 18 }} className="flex items-center gap-3">
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${T.gold}22`, color: T.gold,
                        display: "flex", alignItems: "center", justifyContent: "center" }}>
            <CreditCard size={18} />
          </div>
          <div>
            <div className="label-eyebrow">Parcelamentos ativos</div>
            <div className="num" style={{ color: T.ink, fontSize: 18, fontWeight: 600 }}>{parcAtivos}</div>
            <div style={{ color: T.muted, fontSize: 11 }}>compras em curso</div>
          </div>
        </div>
      </div>
    </section>
  );
}

