/**
 * 💵 Fluxo de caixa — projeção DIÁRIA (pedido 2026-09-28).
 * Linha do saldo projetado + "extrato do futuro": cada entrada/saída na
 * sua data com o saldo após. Base: lib/fluxoCaixa.js (pura).
 */
import React, { useMemo, useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { montarFluxoCaixa } from "../../../lib/fluxoCaixa.js";

const rotuloDia = (iso) => {
  const [a, m, d] = String(iso).split("-").map(Number);
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${String(d).padStart(2, "0")}/${nomes[(m || 1) - 1]}`;
};
const FONTES = { fixa: "fixa", divida: "dívida", parcela: "cartão", devedor: "a receber", cheque: "cheque", transacao: "lançamento" };

export default function FluxoCaixa({
  transacoes = [], contas = [], fixas = [], fixaOcorrencias = [], parcelamentos = [],
  dividas = [], devedores = [], cartoes = [], cheques = [], escopoAtivo = "tudo", hidden,
}) {
  const [dias, setDias] = useState(60);
  const m = (v) => (hidden ? "•••" : fmt(v));

  const state = useMemo(
    () => ({ transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques }),
    [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques]
  );
  const fluxo = useMemo(() => {
    try { return montarFluxoCaixa(state, escopoAtivo, dias); } catch { return null; }
  }, [state, escopoAtivo, dias]);

  if (!fluxo) return null;
  const { saldoInicial, saldoFinal, eventos, porDia, piorDia, primeiroNegativo } = fluxo;

  // ---- gráfico: linha do saldo dia a dia (SVG, série única) ----
  const W = 640, H = 150, PAD = 6;
  const pontos = [{ dataISO: "hoje", saldoFim: saldoInicial }, ...porDia];
  const vals = pontos.map(p => p.saldoFim);
  const maxV = Math.max(...vals, 0), minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;
  const x = (i) => PAD + (i / Math.max(pontos.length - 1, 1)) * (W - PAD * 2);
  const y = (v) => PAD + (1 - (v - minV) / range) * (H - PAD * 2);
  const linha = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.saldoFim).toFixed(1)}`).join(" ");
  const area = `${PAD},${y(Math.max(minV, 0))} ${linha} ${(W - PAD).toFixed(1)},${y(Math.max(minV, 0))}`;

  // eventos agrupados por dia (pra lista)
  const grupos = [];
  for (const e of eventos) {
    const g = grupos[grupos.length - 1];
    if (g && g.dataISO === e.data) g.itens.push(e);
    else grupos.push({ dataISO: e.data, itens: [e] });
  }

  return (
    <div style={{ paddingTop: 4 }}>
      {/* horizonte */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[30, 60, 90].map(d => (
          <button key={d} onClick={() => setDias(d)}
                  style={{ padding: "6px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700, cursor: "pointer",
                           border: `1px solid ${dias === d ? T.gold : T.border}`,
                           background: dias === d ? `${T.gold}18` : "transparent",
                           color: dias === d ? T.gold : T.muted }}>{d} dias</button>
        ))}
      </div>

      {/* herói + veredito */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: T.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>
          Caixa projetado daqui a {dias} dias
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: saldoFinal < 0 ? T.red : T.ink }}>{m(saldoFinal)}</div>
        <div style={{ fontSize: 12, color: T.muted }}>hoje: {m(saldoInicial)}{piorDia ? <> · pior dia: <span style={{ color: piorDia.saldo < 0 ? T.red : T.ink, fontWeight: 700 }}>{m(piorDia.saldo)}</span> em {rotuloDia(piorDia.dataISO)}</> : null}</div>
      </div>
      {primeiroNegativo && (
        <div style={{ background: `${T.red}12`, border: `1px solid ${T.red}55`, borderRadius: 12,
                      padding: "9px 13px", marginBottom: 12, fontSize: 12.5, fontWeight: 700, color: T.ink }}>
          ⚠️ O caixa <span style={{ color: T.red }}>fura em {rotuloDia(primeiroNegativo)}</span> — antecipe um recebimento ou adie uma saída.
        </div>
      )}

      {/* linha do saldo */}
      {porDia.length > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", marginBottom: 4 }}
             role="img" aria-label="Saldo projetado dia a dia">
          <polygon points={area} fill={T.gold} opacity="0.1" />
          {minV < 0 && (
            <line x1={PAD} x2={W - PAD} y1={y(0)} y2={y(0)} stroke={T.red} strokeWidth="1" opacity="0.5" />
          )}
          <polyline points={linha} fill="none" stroke={T.gold} strokeWidth="2"
                    strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(pontos.length - 1)} cy={y(saldoFinal)} r="4" fill={T.gold} stroke={T.card} strokeWidth="2" />
        </svg>
      )}
      {porDia.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T.faint, marginBottom: 14 }}>
          <span>hoje</span><span>{rotuloDia(porDia[porDia.length - 1].dataISO)}</span>
        </div>
      )}

      {/* extrato do futuro */}
      {grupos.length === 0 ? (
        <div style={{ fontSize: 12.5, color: T.muted, fontStyle: "italic", padding: "10px 0" }}>
          Nada previsto pros próximos {dias} dias — caixa parado em {m(saldoInicial)}. ✨
        </div>
      ) : grupos.map(g => (
        <div key={g.dataISO} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: T.muted, letterSpacing: ".04em",
                        textTransform: "uppercase", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
            {rotuloDia(g.dataISO)}
          </div>
          {g.itens.map((e, i) => (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "6px 2px",
                                  borderBottom: `1px solid ${T.bgSoft}`, fontSize: 12.5 }}>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: T.ink }}>
                {e.descricao}
                {e.atrasado && <span style={{ color: T.red, fontSize: 10, fontWeight: 700 }}> · atrasado</span>}
                {FONTES[e.fonte] && <span style={{ color: T.faint, fontSize: 10 }}> · {FONTES[e.fonte]}</span>}
              </span>
              <span className="num" style={{ fontWeight: 700, color: e.tipo === "entrada" ? T.green : T.red, flexShrink: 0 }}>
                {e.tipo === "entrada" ? "+" : "−"} {m(e.valor)}
              </span>
              <span className="num" style={{ width: 92, textAlign: "right", fontSize: 11.5, flexShrink: 0,
                                             color: e.saldoApos < 0 ? T.red : T.muted, fontWeight: e.saldoApos < 0 ? 800 : 500 }}>
                {m(e.saldoApos)}
              </span>
            </div>
          ))}
        </div>
      ))}

      <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", marginTop: 6 }}>
        Caixa = saldo atual das contas + o que está previsto e ainda não aconteceu (fixas,
        parcelas, dívidas, a receber, cheques). Atrasados contam como hoje. Última coluna:
        saldo após cada evento.
      </div>
    </div>
  );
}
