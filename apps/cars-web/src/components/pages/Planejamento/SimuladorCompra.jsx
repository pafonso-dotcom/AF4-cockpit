/**
 * 🛒 Simulador de compra ("E se?") — pedido 2026-09-25.
 * O usuário digita uma compra hipotética (valor, à vista ou Nx, mês de
 * início) e vê a projeção de saldo dos próximos meses COM × SEM a compra.
 * SÓ VISUAL: nada é lançado nem persistido — estado local do formulário.
 */
import React, { useMemo, useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { getProjecaoSaldo } from "../../../lib/agregador.js";
import { aplicarCompraNaProjecao } from "../../../lib/simuladorCompra.js";

const mesAtualISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const proxMeses = (n = 6) => Array.from({ length: n }, (_, i) => {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
  const iso = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
  const nomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return { iso, label: `${nomes[x.getMonth()]}/${String(x.getFullYear()).slice(2)}` };
});

export default function SimuladorCompra({
  transacoes = [], contas = [], fixas = [], fixaOcorrencias = [], parcelamentos = [],
  dividas = [], devedores = [], cartoes = [], cheques = [], escopoAtivo = "tudo", hidden,
}) {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState(1);
  const [mesInicio, setMesInicio] = useState(mesAtualISO());

  const m = (v) => (hidden ? "•••" : fmt(v));
  const state = useMemo(
    () => ({ transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques }),
    [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques]
  );

  const valorNum = Number(String(valor).replace(/\./g, "").replace(",", ".")) || 0;
  const offsetInicio = Math.max(0, proxMeses(12).findIndex(x => x.iso === mesInicio));
  const horizonte = Math.min(12, Math.max(6, offsetInicio + Number(parcelas) + 1));

  const sim = useMemo(() => {
    if (!valorNum) return null;
    try {
      const proj = getProjecaoSaldo(state, escopoAtivo, horizonte);
      return aplicarCompraNaProjecao(proj, { valorTotal: valorNum, parcelas, mesInicioISO: mesInicio });
    } catch { return null; }
  }, [state, escopoAtivo, horizonte, valorNum, parcelas, mesInicio]);

  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 12,
                border: `1px solid ${T.border}`, background: T.bg, color: T.ink, fontSize: 13 };
  const rot = { fontSize: 10.5, color: T.muted, fontWeight: 700, letterSpacing: ".05em",
                textTransform: "uppercase", display: "block", marginBottom: 4 };

  const cabe = sim && sim.mesesNegativos === 0;

  return (
    <div style={{ paddingTop: 4 }}>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 12px" }}>
        Digite a compra que você está <strong>pensando</strong> em fazer e veja como ficaria o
        saldo dos próximos meses. <strong>Nada é lançado</strong> — é só uma simulação.
      </p>

      {/* formulário */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <span style={rot}>O que você quer comprar? (opcional)</span>
          <input style={inp} value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Geladeira nova" />
        </div>
        <div>
          <span style={rot}>Valor total (R$)</span>
          <input style={inp} inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="3.000,00" />
        </div>
        <div>
          <span style={rot}>Como pagar</span>
          <select style={inp} value={parcelas} onChange={e => setParcelas(Number(e.target.value))}>
            <option value={1}>À vista (1x)</option>
            {Array.from({ length: 11 }, (_, i) => i + 2).map(n => (
              <option key={n} value={n}>{n}x de {valorNum ? (hidden ? "•••" : fmt(valorNum / n)) : "…"}</option>
            ))}
          </select>
        </div>
        <div>
          <span style={rot}>Começando em</span>
          <select style={inp} value={mesInicio} onChange={e => setMesInicio(e.target.value)}>
            {proxMeses(6).map(x => <option key={x.iso} value={x.iso}>{x.label}</option>)}
          </select>
        </div>
      </div>

      {/* resultado */}
      {!sim ? (
        <div style={{ fontSize: 12.5, color: T.faint, fontStyle: "italic", padding: "8px 0" }}>
          Preencha o valor pra ver a simulação. 🛒
        </div>
      ) : (
        <>
          <div style={{
            background: cabe ? `${T.green}12` : `${T.red}12`,
            border: `1px solid ${cabe ? T.green : T.red}55`,
            borderRadius: 14, padding: "11px 14px", marginBottom: 12, fontSize: 13.5, fontWeight: 700, color: T.ink,
          }}>
            {cabe
              ? <>✅ {descricao.trim() || "A compra"} <span style={{ color: T.green }}>cabe no bolso</span> — pior momento: {m(sim.piorSaldo)} em {sim.piorMesLabel}.</>
              : <>⚠️ {descricao.trim() || "A compra"} <span style={{ color: T.red }}>aperta</span>: o saldo projetado fica negativo em {sim.mesesNegativos} mês(es) — pior momento: {m(sim.piorSaldo)} em {sim.piorMesLabel}.</>}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
              <thead>
                <tr style={{ color: T.muted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ textAlign: "left", padding: "6px 4px" }}>Mês</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>Parcela</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>Saldo sem a compra</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>Saldo com a compra</th>
                </tr>
              </thead>
              <tbody>
                {sim.meses.map(x => (
                  <tr key={x.mesISO} style={{ borderTop: `1px solid ${T.bgSoft}` }}>
                    <td style={{ padding: "7px 4px", fontWeight: 600 }}>{x.label}</td>
                    <td className="num" style={{ padding: "7px 4px", textAlign: "right", color: x.parcela ? T.red : T.faint }}>
                      {x.parcela ? `− ${m(x.parcela)}` : "—"}
                    </td>
                    <td className="num" style={{ padding: "7px 4px", textAlign: "right", color: T.muted }}>{m(x.saldoFim)}</td>
                    <td className="num" style={{ padding: "7px 4px", textAlign: "right", fontWeight: 700,
                                                 color: x.saldoFimCom < 0 ? T.red : T.ink }}>
                      {m(x.saldoFimCom)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: T.faint, fontStyle: "italic", marginTop: 8 }}>
            Projeção: saldo atual das contas + entradas e saídas já previstas (fixas, parcelas,
            dívidas, a receber) − a compra simulada. Nada foi lançado nos teus dados.
          </div>
        </>
      )}
    </div>
  );
}
