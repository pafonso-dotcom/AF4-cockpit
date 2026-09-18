import React from "react";
import { fmt } from "../../../lib/format.js";
import { T } from "../../../lib/theme.js";
import Card from "../../ui/Card.jsx";
import { totalAssinaturas } from "../../../lib/inteligenciaPainel.js";
import { Vazio } from "./ScoreCard.jsx";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

export default function AssinaturasCard({ assinaturas = [], fixas = [], hidden, onTabChange }) {
  if (!assinaturas.length) {
    return <Card><Vazio texto="Nenhuma assinatura recorrente detectada." /></Card>;
  }
  const fixaNomes = new Set((fixas || []).map((f) => norm(f.nome)));
  // Totais só das ATIVAS — as "paradas" (possivelmente canceladas) não
  // comprometem o mês.
  const ativas = assinaturas.filter((a) => !a.parada);
  const { mensal, anual } = totalAssinaturas(ativas);
  const comAumento = assinaturas.filter((a) => a.aumento && !a.parada);
  return (
    <Card>
      <div style={{ fontSize: 12.5, color: T.ink, marginBottom: 4 }}>
        Você compromete <strong style={{ color: T.gold }}>{hidden ? "•••" : fmt(mensal)}/mês</strong>
        {" "}em assinaturas (<span className="num">{hidden ? "•••" : fmt(anual)}</span>/ano).
      </div>
      {comAumento.length > 0 && (
        <div style={{ fontSize: 11.5, color: T.red, marginBottom: 10, fontWeight: 600 }}>
          ⚠ {comAumento.length} assinatura{comAumento.length === 1 ? "" : "s"} subiu{comAumento.length === 1 ? "" : "ram"} de preço recentemente — veja abaixo.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: comAumento.length ? 0 : 6 }}>
        {assinaturas.map((a, i) => {
          const jaFixa = fixaNomes.has(norm(a.descricao));
          return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, opacity: a.parada ? 0.6 : 1 }}>
            <span style={{ flex: 1, minWidth: 0, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {a.conhecida ? "★ " : ""}{a.descricao || "Assinatura"}
              {a.aumento && !a.parada && (
                <span className="num" title={`Última cobrança acima da média das anteriores (+${a.aumento.pct.toFixed(0)}%)`}
                      style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: T.red, background: `${T.red}15`, border: `1px solid ${T.red}44`, borderRadius: 100, padding: "1px 7px", whiteSpace: "nowrap" }}>
                  ▲ {hidden ? "•••" : `${fmt(a.aumento.de)} → ${fmt(a.aumento.para)}`}
                </span>
              )}
              {a.parada && (
                <span title="Sem cobrança há mais tempo que o normal — pode ter sido cancelada (ou a cobrança ainda vai cair)."
                      style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: T.muted, background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 100, padding: "1px 7px", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: ".03em" }}>
                  parou? {a.diasSemCobrar}d sem cobrar
                </span>
              )}
            </span>
            <span style={{ fontSize: 10.5, color: T.muted }}>{a.frequencia}</span>
            <span className="num" style={{ color: T.ink, fontWeight: 600, minWidth: 70, textAlign: "right" }}>{hidden ? "•••" : fmt(a.valorUltimo ?? a.valorMedio)}</span>
            {jaFixa ? (
              <span style={{ fontSize: 8.5, padding: "2px 7px", borderRadius: 100, background: `${T.green}1f`, color: T.green, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>já é fixa</span>
            ) : (
              <button onClick={() => onTabChange?.("fixas")}
                title="Cadastrar como despesa fixa"
                style={{ fontSize: 9.5, padding: "3px 9px", borderRadius: 100, background: `${T.gold}1f`, color: T.gold, border: `1px solid ${T.gold}55`, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap" }}>
                Virar fixa
              </button>
            )}
          </div>
          );
        })}
      </div>
    </Card>
  );
}
