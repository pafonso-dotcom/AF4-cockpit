import React, { useMemo } from "react";
import { AlertTriangle, Check, MessageCircle, Calendar } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt, todayISO } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";

/**
 * Lista unificada de itens críticos:
 *  - Fixas atrasadas
 *  - Fixas que vencem em ≤ 3 dias
 *  - Dívidas (A Pagar) vencidas ou que vencem em ≤ 3 dias
 *  - Devedores (A Receber) vencidos
 *
 * Cada item tem botão de ação direta.
 */
export default function AtencaoView({
  devedores = [], setDevedores,
  dividas = [], setDividas,
  fixaOcorrencias = [], setFixaOcorrencias,
  hidden,
  onAbrirCard,
}) {
  const hoje = todayISO();
  const em3 = new Date(); em3.setDate(em3.getDate() + 3);
  const em3dias = em3.toISOString().slice(0, 10);

  const itens = useMemo(() => {
    const out = [];

    // Fixas atrasadas e próximas
    fixaOcorrencias.forEach(o => {
      if (o.status === "paga" || !o.dataVencimento) return;
      if (o.dataVencimento > em3dias) return;
      const dias = Math.round((new Date(o.dataVencimento) - new Date(hoje)) / 86400000);
      out.push({
        tipo: "fixa",
        id: o.id,
        nome: `Fixa · ${o.id.replace(/^occ-fixa-/, "").replace(/-\d{4}-\d{2}$/, "")}`,
        valor: o.valor,
        venc: o.dataVencimento,
        dias,
        atrasado: o.dataVencimento < hoje,
        ref: o,
      });
    });

    // Dívidas (A Pagar) vencidas ou próximas
    dividas.forEach(d => {
      if (d.pago || !d.vencimento) return;
      if (d.vencimento > em3dias) return;
      const dias = Math.round((new Date(d.vencimento) - new Date(hoje)) / 86400000);
      out.push({
        tipo: "divida",
        id: d.id,
        nome: d.nome + (d.credor ? ` · ${d.credor}` : ""),
        valor: d.valor,
        venc: d.vencimento,
        dias,
        atrasado: d.vencimento < hoje,
        ref: d,
      });
    });

    // Devedores (A Receber) vencidos
    devedores.forEach(dev => {
      if (dev.recebido || !dev.vencimento) return;
      if (dev.vencimento > em3dias) return;
      const dias = Math.round((new Date(dev.vencimento) - new Date(hoje)) / 86400000);
      out.push({
        tipo: "devedor",
        id: dev.id,
        nome: dev.nome,
        valor: dev.valor,
        venc: dev.vencimento,
        dias,
        atrasado: dev.vencimento < hoje,
        ref: dev,
      });
    });

    return out.sort((a, b) => (a.venc || "").localeCompare(b.venc || ""));
  }, [devedores, dividas, fixaOcorrencias, hoje, em3dias]);

  const totalAtrasado = itens.filter(i => i.atrasado).reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
  const totalProximo = itens.filter(i => !i.atrasado).reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);

  const corPorTipo = {
    fixa: T.gold,
    divida: T.red,
    devedor: T.green,
  };
  const labelPorTipo = {
    fixa: "Fixa",
    divida: "A Pagar",
    devedor: "A Receber",
  };

  const irPara = (tipo) => {
    if (!onAbrirCard) return;
    if (tipo === "fixa") onAbrirCard("despesas");
    else if (tipo === "divida" || tipo === "devedor") onAbrirCard("recebiveis");
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 10, letterSpacing: ".2em", color: T.faint,
          textTransform: "uppercase", fontWeight: 600,
        }}>
          Planejamento · Atenção
        </div>
        <h1 style={{
          fontFamily: T.serif, fontSize: 30, fontWeight: 300,
          letterSpacing: "-.02em", marginTop: 6,
        }}>
          Itens que precisam de <em style={{ color: T.red, fontStyle: "italic" }}>ação.</em>
        </h1>
        <p style={{ fontSize: 12, color: T.muted, marginTop: 6 }}>
          Vencidos ou que vencem nos próximos 3 dias. Toque pra abrir a área correspondente.
        </p>
      </div>

      {/* Mini-resumo */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div style={{
          background: T.card, borderLeft: `3px solid ${T.red}`,
          border: `1px solid ${T.red}33`, borderRadius: 8, padding: 14,
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: ".15em", color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>
            🔴 Vencidos
          </div>
          <div className="num" style={{ color: T.red, fontFamily: T.serif, fontSize: 20, fontWeight: 600, marginTop: 5 }}>
            {hidden ? "•••" : fmt(totalAtrasado)}
          </div>
          <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>
            {itens.filter(i => i.atrasado).length} {itens.filter(i => i.atrasado).length === 1 ? "item" : "itens"}
          </div>
        </div>
        <div style={{
          background: T.card, borderLeft: `3px solid ${T.gold}`,
          border: `1px solid ${T.gold}33`, borderRadius: 8, padding: 14,
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: ".15em", color: T.muted, textTransform: "uppercase", fontWeight: 700 }}>
            🟡 Próximos 3 dias
          </div>
          <div className="num" style={{ color: T.gold, fontFamily: T.serif, fontSize: 20, fontWeight: 600, marginTop: 5 }}>
            {hidden ? "•••" : fmt(totalProximo)}
          </div>
          <div style={{ fontSize: 11, color: T.faint, marginTop: 3 }}>
            {itens.filter(i => !i.atrasado).length} {itens.filter(i => !i.atrasado).length === 1 ? "item" : "itens"}
          </div>
        </div>
      </div>

      {/* Lista */}
      {itens.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
        }}>
          🎉 Nenhum item crítico. Tudo em dia!
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {itens.map(it => {
            const cor = corPorTipo[it.tipo];
            return (
              <div key={`${it.tipo}-${it.id}`} style={{
                background: it.atrasado ? `${T.red}11` : `${T.gold}11`,
                border: `1px solid ${it.atrasado ? T.red : T.gold}55`,
                borderLeft: `4px solid ${it.atrasado ? T.red : T.gold}`,
                borderRadius: 8, padding: "12px 14px",
                display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
              }}>
                <span style={{
                  fontSize: 9.5, letterSpacing: ".1em", padding: "2px 7px",
                  borderRadius: 4, background: `${cor}22`, color: cor,
                  fontWeight: 700, textTransform: "uppercase",
                }}>
                  {labelPorTipo[it.tipo]}
                </span>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ color: T.ink, fontSize: 13, fontWeight: 500 }}>{it.nome}</div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 2 }}>
                    {it.atrasado
                      ? `Venceu ${it.venc.slice(8,10)}/${it.venc.slice(5,7)} · há ${-it.dias}d`
                      : `Vence ${it.venc.slice(8,10)}/${it.venc.slice(5,7)} · em ${it.dias === 0 ? "hoje" : `${it.dias}d`}`}
                  </div>
                </div>
                <div className="num" style={{
                  color: it.tipo === "devedor" ? T.green : T.red,
                  fontFamily: T.serif, fontSize: 16, fontWeight: 600,
                  minWidth: 110, textAlign: "right",
                }}>
                  {hidden ? "•••" : fmt(it.valor)}
                </div>
                <button onClick={() => irPara(it.tipo)}
                  style={{
                    background: "transparent", color: cor,
                    border: `1px solid ${cor}55`, borderRadius: 6,
                    padding: "7px 12px", fontSize: 10.5, fontWeight: 600,
                    letterSpacing: ".05em", textTransform: "uppercase", cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}>
                  Abrir →
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
