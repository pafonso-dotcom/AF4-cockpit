import React from "react";
import { History as HistoryIcon, Trash2 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import PageHeader from "../../ui/PageHeader.jsx";

export default function Historico({ tradeHistorico = [], setTradeHistorico }) {
  const limpar = async () => {
    const ok = await confirm({
      title: "Limpar histórico de varreduras?",
      body: `Apaga as ${tradeHistorico.length} entradas.`,
      danger: true, confirmLabel: "Limpar",
    });
    if (!ok) return;
    setTradeHistorico?.([]);
    toast.success("Histórico limpo.");
  };

  return (
    <div className="fade-up py-8 px-6">
      <PageHeader
        eyebrow="AF4 Trade · Histórico"
        title={<>Varreduras <em>anteriores.</em></>}
        sub="Últimas 30 análises do Radar. Útil pra acompanhar evolução dos scores ao longo do tempo."
        action={
          tradeHistorico.length > 0 && (
            <button className="btn-ghost" onClick={limpar}>
              <Trash2 size={13} className="inline mr-1.5" /> Limpar
            </button>
          )
        }
      />

      {tradeHistorico.length === 0 ? (
        <div style={{
          padding: 60, textAlign: "center", color: T.muted, fontStyle: "italic",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 10,
        }}>
          <HistoryIcon size={32} style={{ color: T.muted, marginBottom: 10 }} />
          <div>Nenhuma varredura ainda. Vá ao Radar e clique "Atualizar".</div>
        </div>
      ) : (
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, overflow: "auto" }}>
          <table className="tbl" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 400 }}>
            <thead>
              <tr style={{ background: T.bgSoft }}>
                <th style={th}>Quando</th>
                <th style={th} className="hidden sm:table-cell">Timeframe</th>
                <th style={th}>Top 5 (por score)</th>
              </tr>
            </thead>
            <tbody>
              {tradeHistorico.map((h, i) => {
                const d = new Date(h.timestamp);
                return (
                  <tr key={h.timestamp + i} style={{ borderTop: `1px solid ${T.border}` }}>
                    <td style={td}>
                      <div style={{ color: T.ink, fontWeight: 500 }}>
                        {d.toLocaleDateString("pt-BR")} {d.toLocaleTimeString("pt-BR").slice(0, 5)}
                      </div>
                      <div className="sm:hidden" style={{ color: T.faint, fontSize: 10, marginTop: 2 }}>
                        {h.intervalo || "—"}
                      </div>
                    </td>
                    <td className="hidden sm:table-cell" style={{ ...td, color: T.muted }}>{h.intervalo || "—"}</td>
                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(h.top5 || []).map(t => {
                          const cor = t.score >= 70 ? T.green : t.score >= 50 ? T.gold : T.muted;
                          return (
                            <span key={t.symbol} style={{
                              padding: "3px 9px", borderRadius: 100,
                              background: `${cor}22`, color: cor,
                              fontSize: 10.5, fontWeight: 600, fontFamily: "monospace",
                            }}>
                              {t.symbol.replace(/USDT$/, "")} {t.score}
                              <span style={{ color: T.faint, marginLeft: 4, fontSize: 9 }}>{t.direcao}</span>
                            </span>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = {
  padding: "10px 14px", textAlign: "left",
  fontSize: 9.5, letterSpacing: ".15em", textTransform: "uppercase",
  color: "var(--tm)", fontWeight: 500,
};
const td = { padding: "12px 14px", verticalAlign: "middle" };
