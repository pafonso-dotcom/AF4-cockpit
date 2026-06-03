import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Bell, X } from "lucide-react";
import { T } from "../lib/theme.js";
import { fmt, todayISO } from "../lib/format.js";
import { computarAlertas } from "../lib/alertas.js";

/**
 * Central de Alertas — sino com badge + painel suspenso.
 * Junta fatura/parcela vencendo, dívidas, recebíveis, fixas e orçamento.
 *
 * Props: dados financeiros + onNavegar(modulo, tab) pra ir ao item ao clicar.
 * `btnStyle` permite reusar o estilo dos outros botões do header.
 */
export default function AlertCenter({
  dividas, devedores, fixas, fixaOcorrencias, parcelamentos,
  cartoes, categorias, transacoes,
  onNavegar, btnStyle, iconSize = 18,
}) {
  const [aberto, setAberto] = useState(false);

  const alertas = useMemo(() => computarAlertas({
    hoje: todayISO(),
    dividas, devedores, fixas, fixaOcorrencias, parcelamentos,
    cartoes, categorias, transacoes,
  }), [dividas, devedores, fixas, fixaOcorrencias, parcelamentos, cartoes, categorias, transacoes]);

  const qtd = alertas.length;
  const temVencido = alertas.some(a => a.severidade === "vencido");
  const corBadge = temVencido ? T.red : (T.gold || "#c9a961");

  const corSev = (s) => s === "vencido" ? T.red : s === "proximo" ? (T.gold || "#c9a961") : T.muted;
  const labelSev = (s) => s === "vencido" ? "Vencido" : s === "proximo" ? "Em breve" : "Aviso";

  const irPara = (a) => {
    setAberto(false);
    onNavegar?.(a.modulo, a.tab);
  };

  const painel = (
    <>
      <div onClick={() => setAberto(false)} style={{ position: "fixed", inset: 0, zIndex: 1000 }} />
      <div style={{
        position: "fixed", top: 62, right: 14, zIndex: 1001,
        width: "min(380px, calc(100vw - 28px))", maxHeight: "75vh",
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,.35)", display: "flex", flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink, letterSpacing: ".02em" }}>
            Alertas {qtd > 0 && <span style={{ color: corBadge }}>· {qtd}</span>}
          </span>
          <button onClick={() => setAberto(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: T.muted, padding: 2 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ overflowY: "auto" }}>
          {qtd === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: T.muted, fontSize: 13, fontStyle: "italic" }}>
              🎉 Nada pendente. Tudo em dia!
            </div>
          ) : (
            alertas.map(a => (
              <button key={a.id} onClick={() => irPara(a)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
                  background: "transparent", border: "none", borderLeft: `3px solid ${corSev(a.severidade)}`,
                  cursor: "pointer",
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{
                      fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase",
                      color: corSev(a.severidade), background: `${corSev(a.severidade)}22`,
                      padding: "1px 6px", borderRadius: 3, flexShrink: 0,
                    }}>{labelSev(a.severidade)}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.titulo}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{a.sub}</div>
                </div>
                {a.valor > 0 && (
                  <span className="num" style={{ fontSize: 12.5, fontWeight: 600, color: corSev(a.severidade), flexShrink: 0 }}>
                    {fmt(a.valor)}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      <button onClick={() => setAberto(v => !v)}
              title={qtd > 0 ? `${qtd} alerta${qtd > 1 ? "s" : ""}` : "Sem alertas"}
              className="hdr-util"
              style={{ ...btnStyle, position: "relative" }}>
        <Bell size={iconSize} />
        {qtd > 0 && (
          <span style={{
            position: "absolute", top: 4, right: 4, minWidth: 15, height: 15, padding: "0 3px",
            background: corBadge, color: "#fff", borderRadius: 100,
            fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", lineHeight: 1,
          }}>
            {qtd > 9 ? "9+" : qtd}
          </span>
        )}
      </button>
      {aberto && createPortal(painel, document.body)}
    </>
  );
}
