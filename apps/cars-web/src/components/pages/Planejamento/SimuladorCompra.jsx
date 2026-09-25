/**
 * 🛒 Simulador de compra ("E se?") — pedido 2026-09-25.
 * O usuário monta uma LISTA de compras hipotéticas (valor, à vista ou Nx,
 * mês de início cada uma) e vê a projeção de saldo dos próximos meses
 * COM × SEM as compras. SÓ VISUAL: nada é lançado nem persistido.
 */
import React, { useMemo, useState } from "react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { getProjecaoSaldo } from "../../../lib/agregador.js";
import { aplicarComprasNaProjecao } from "../../../lib/simuladorCompra.js";

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
const parseValor = (s) => Number(String(s).replace(/\./g, "").replace(",", ".")) || 0;
const novaCompra = () => ({ id: Math.random().toString(36).slice(2), descricao: "", valor: "", parcelas: 1, mesInicio: mesAtualISO() });

export default function SimuladorCompra({
  transacoes = [], contas = [], fixas = [], fixaOcorrencias = [], parcelamentos = [],
  dividas = [], devedores = [], cartoes = [], cheques = [], escopoAtivo = "tudo", hidden,
}) {
  const [compras, setCompras] = useState([novaCompra()]);
  const mudar = (id, patch) => setCompras(cs => cs.map(c => c.id === id ? { ...c, ...patch } : c));
  const remover = (id) => setCompras(cs => cs.filter(c => c.id !== id));

  const m = (v) => (hidden ? "•••" : fmt(v));
  const state = useMemo(
    () => ({ transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques }),
    [transacoes, contas, fixas, fixaOcorrencias, parcelamentos, dividas, devedores, cartoes, cheques]
  );

  const validas = compras
    .map(c => ({ descricao: c.descricao.trim(), valorTotal: parseValor(c.valor), parcelas: c.parcelas, mesInicioISO: c.mesInicio }))
    .filter(c => c.valorTotal > 0);

  // Horizonte: até a última parcela da compra que termina mais tarde (6–12 meses).
  const listaMeses = proxMeses(12);
  const horizonte = Math.min(12, Math.max(6, ...validas.map(c => {
    const off = Math.max(0, listaMeses.findIndex(x => x.iso === c.mesInicioISO));
    return off + Number(c.parcelas) + 1;
  }), 6));

  const sim = useMemo(() => {
    if (!validas.length) return null;
    try {
      const proj = getProjecaoSaldo(state, escopoAtivo, horizonte);
      return aplicarComprasNaProjecao(proj, validas);
    } catch { return null; }
  }, [state, escopoAtivo, horizonte, JSON.stringify(validas)]); // eslint-disable-line react-hooks/exhaustive-deps

  const inp = { width: "100%", boxSizing: "border-box", padding: "9px 11px", borderRadius: 12,
                border: `1px solid ${T.border}`, background: T.bg, color: T.ink, fontSize: 13 };
  const rot = { fontSize: 10.5, color: T.muted, fontWeight: 700, letterSpacing: ".05em",
                textTransform: "uppercase", display: "block", marginBottom: 4 };

  const cabe = sim && sim.mesesNegativos === 0;
  const nomeCompras = validas.length === 1
    ? (validas[0].descricao || "A compra")
    : `As ${validas.length} compras`;

  return (
    <div style={{ paddingTop: 4 }}>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "0 0 12px" }}>
        Monte a lista do que você está <strong>pensando</strong> em comprar e veja como ficaria o
        saldo dos próximos meses com tudo junto. <strong>Nada é lançado</strong> — é só simulação.
      </p>

      {/* lista de compras */}
      {compras.map((c, idx) => (
        <div key={c.id} style={{ background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 14,
                                 padding: "10px 12px", marginBottom: 8, position: "relative" }}>
          {compras.length > 1 && (
            <button onClick={() => remover(c.id)} title="Tirar esta compra da simulação"
                    style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none",
                             color: T.red, cursor: "pointer", fontSize: 14, padding: 4 }}>✕</button>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
            <div style={{ gridColumn: "1 / -1" }}>
              <span style={rot}>Compra {compras.length > 1 ? idx + 1 : ""} — o quê? (opcional)</span>
              <input style={inp} value={c.descricao} onChange={e => mudar(c.id, { descricao: e.target.value })}
                     placeholder={idx === 0 ? "Ex.: Geladeira nova" : "Ex.: Sofá"} />
            </div>
            <div>
              <span style={rot}>Valor total (R$)</span>
              <input style={inp} inputMode="decimal" value={c.valor}
                     onChange={e => mudar(c.id, { valor: e.target.value })} placeholder="3.000,00" />
            </div>
            <div>
              <span style={rot}>Como pagar</span>
              <select style={inp} value={c.parcelas} onChange={e => mudar(c.id, { parcelas: Number(e.target.value) })}>
                <option value={1}>À vista (1x)</option>
                {Array.from({ length: 11 }, (_, i) => i + 2).map(nn => (
                  <option key={nn} value={nn}>
                    {nn}x{parseValor(c.valor) ? ` de ${hidden ? "•••" : fmt(parseValor(c.valor) / nn)}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={rot}>Começando em</span>
              <select style={inp} value={c.mesInicio} onChange={e => mudar(c.id, { mesInicio: e.target.value })}>
                {proxMeses(6).map(x => <option key={x.iso} value={x.iso}>{x.label}</option>)}
              </select>
            </div>
          </div>
        </div>
      ))}
      <button onClick={() => setCompras(cs => [...cs, novaCompra()])}
              style={{ background: "transparent", border: `1px dashed ${T.borderHi}`, borderRadius: 12,
                       color: T.gold, fontWeight: 700, fontSize: 12.5, padding: "9px 14px",
                       cursor: "pointer", width: "100%", marginBottom: 14 }}>
        ＋ Mais uma compra na simulação
      </button>

      {/* resultado */}
      {!sim ? (
        <div style={{ fontSize: 12.5, color: T.faint, fontStyle: "italic", padding: "8px 0" }}>
          Preencha o valor de pelo menos uma compra pra ver a simulação. 🛒
        </div>
      ) : (
        <>
          <div style={{
            background: cabe ? `${T.green}12` : `${T.red}12`,
            border: `1px solid ${cabe ? T.green : T.red}55`,
            borderRadius: 14, padding: "11px 14px", marginBottom: 12, fontSize: 13.5, fontWeight: 700, color: T.ink,
          }}>
            {cabe
              ? <>✅ {nomeCompras} <span style={{ color: T.green }}>cabe{validas.length > 1 ? "m" : ""} no bolso</span> — pior momento: {m(sim.piorSaldo)} em {sim.piorMesLabel}.</>
              : <>⚠️ {nomeCompras} <span style={{ color: T.red }}>aperta{validas.length > 1 ? "m" : ""}</span>: o saldo projetado fica negativo em {sim.mesesNegativos} mês(es) — pior momento: {m(sim.piorSaldo)} em {sim.piorMesLabel}.</>}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 420 }}>
              <thead>
                <tr style={{ color: T.muted, fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <th style={{ textAlign: "left", padding: "6px 4px" }}>Mês</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>Parcelas</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>Saldo sem as compras</th>
                  <th style={{ textAlign: "right", padding: "6px 4px" }}>Saldo com as compras</th>
                </tr>
              </thead>
              <tbody>
                {sim.meses.map(x => (
                  <tr key={x.mesISO} style={{ borderTop: `1px solid ${T.bgSoft}` }}
                      title={x.porCompra?.length ? x.porCompra.map(pc => `${pc.descricao || "Compra"}: ${hidden ? "•••" : fmt(pc.valor)}`).join(" · ") : ""}>
                    <td style={{ padding: "7px 4px", fontWeight: 600 }}>{x.label}</td>
                    <td className="num" style={{ padding: "7px 4px", textAlign: "right", color: x.parcela ? T.red : T.faint }}>
                      {x.parcela ? `− ${m(x.parcela)}` : "—"}
                      {x.porCompra?.length > 1 && <span style={{ color: T.faint, fontSize: 10 }}> ({x.porCompra.length})</span>}
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
            dívidas, a receber) − as compras simuladas. Nada foi lançado nos teus dados.
          </div>
        </>
      )}
    </div>
  );
}
