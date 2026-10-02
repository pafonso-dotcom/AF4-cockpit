import React, { useMemo } from "react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import { useDolar, useEuro } from "../../lib/useDolar.js";
import { resumoOrcamento, duracaoViagem } from "../../lib/orcamentoViagem.js";
import { RoscaViagem, CORES_VIAGEM } from "./ViagemOrcamento.jsx";
import { CATEGORIAS_VIAGEM } from "../../lib/orcamentoViagem.js";
import Card from "../ui/Card.jsx";

/**
 * Painel · Próximas viagens com previsão de gasto (pedido 2026-10-02).
 * SÓ VISUAL — não mexe em nenhum número do app.
 */
export default function ViagensCard({ viagens = [], hidden, onVer }) {
  const usd = useDolar(), eur = useEuro();
  const hoje = new Date().toISOString().slice(0, 10);
  const lista = useMemo(() => (viagens || [])
    .filter(v => v.inicio && (v.fim || v.inicio) >= hoje)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map(v => ({ v, r: resumoOrcamento(v.orcamento, { USD: usd, EUR: eur }, duracaoViagem(v)) })), [viagens, usd, eur, hoje]);
  if (!lista.length) return null;

  const oc = (x) => hidden ? "•••" : fmt(x);
  const faltam = (v) => {
    if (v.inicio <= hoje) return "✈️ em viagem";
    const d = Math.ceil((new Date(v.inicio + "T00:00:00") - new Date(hoje + "T00:00:00")) / 86400000);
    return `faltam ${d} dia${d === 1 ? "" : "s"}`;
  };
  const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  const [{ v, r }, ...outras] = lista;
  const milhasTxt = (m) => `${fmtN(m / 1000, m % 1000 ? 1 : 0)} mil milhas`;
  const totalGeral = lista.reduce((s, x) => s + x.r.previsto, 0);
  const faltaGeral = lista.reduce((s, x) => s + x.r.falta, 0);

  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.ink }}>✈️ Próximas viagens</span>
        <span style={{ fontSize: 11, color: T.muted, border: `1px solid ${T.border}`, borderRadius: 12, padding: "3px 8px" }}>só previsão · não mexe nos saldos</span>
      </div>

      <div className="painel-rosca" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <RoscaViagem porCat={r.porCat} tamanho={130}
          centro={<div><div style={{ fontSize: 10, color: T.muted }}>previsto</div><div className="num" style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{oc(r.total)}</div></div>} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div onClick={onVer} style={{ cursor: onVer ? "pointer" : "default" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>{v.titulo}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 2 }}>
              {v.destino ? `📍 ${v.destino} · ` : ""}{br(v.inicio)}{v.fim && v.fim !== v.inicio ? ` → ${br(v.fim)}` : ""} · <b style={{ color: T.gold }}>{faltam(v)}</b>
            </div>
          </div>
          {r.total > 0 ? (<>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
              <div><div style={{ fontSize: 11, color: T.muted }}>Em dinheiro</div><div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{oc(r.previsto)}</div></div>
              <div><div style={{ fontSize: 11, color: T.muted }}>Falta pagar</div><div className="num" style={{ fontSize: 16, fontWeight: 700, color: r.falta > 0 ? T.gold : T.green }}>{oc(r.falta)}</div></div>
              {r.milhas > 0 && <div><div style={{ fontSize: 11, color: T.muted }}>Milhas</div><div className="num" style={{ fontSize: 16, fontWeight: 700, color: T.ink }}>{milhasTxt(r.milhas)}</div></div>}
            </div>
            {r.previsto > 0 && (
              <div style={{ height: 6, borderRadius: 99, background: T.bgSoft, overflow: "hidden", marginTop: 10 }} title={`${fmtN(r.pctPago, 0)}% já pago`}>
                <div style={{ width: `${r.pctPago}%`, height: "100%", background: T.green, borderRadius: 99 }} />
              </div>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 10 }}>
              {r.porCat.map(c => (
                <span key={c.k} style={{ fontSize: 11.5, color: T.muted, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 3, background: CORES_VIAGEM[CATEGORIAS_VIAGEM.findIndex(x => x.k === c.k) % CORES_VIAGEM.length] }} />
                  {c.icone} {oc(c.valor)}
                </span>
              ))}
            </div>
          </>) : (
            <button onClick={onVer} style={{ marginTop: 10, background: "transparent", border: `1px dashed ${T.border}`, color: T.gold, borderRadius: 12, padding: "8px 12px", cursor: "pointer", fontSize: 12.5 }}>
              💰 Montar o orçamento desta viagem
            </button>
          )}
        </div>
      </div>

      {outras.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 10, borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
          {outras.map(({ v: o, r: ro }) => (
            <div key={o.id} onClick={onVer} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, cursor: onVer ? "pointer" : "default" }}>
              <span style={{ flex: 1, minWidth: 0, color: T.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.titulo}</span>
              <span style={{ color: T.muted, whiteSpace: "nowrap" }}>{faltam(o)}</span>
              <span className="num" style={{ color: T.ink, whiteSpace: "nowrap", minWidth: 90, textAlign: "right" }}>{ro.total > 0 ? oc(ro.previsto) : "—"}{ro.milhas ? ` + ${Math.round(ro.milhas / 1000)}k mi` : ""}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.muted, marginTop: 4 }}>
            <span>Todas as viagens · em dinheiro</span>
            <span className="num">{oc(totalGeral)} · falta {oc(faltaGeral)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}
