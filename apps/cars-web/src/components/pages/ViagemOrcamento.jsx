import React, { useEffect, useMemo, useRef, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Sparkles } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt, fmtN } from "../../lib/format.js";
import {
  CATEGORIAS_VIAGEM, CAT_POR_K, MILHEIRO_PADRAO, PROGRAMAS, MOEDAS, ESTILOS,
  duracaoViagem, resumoOrcamento, estimarOrcamento,
} from "../../lib/orcamentoViagem.js";
import Modal from "../ui/Modal.jsx";

export const CORES_VIAGEM = ["#4DD9C0", "#e0b45c", "#6f9bd1", "#d97a6c", "#9b8cd6", "#7fbf7f", "#c9a0a0", "#8fb8c9", "#b0a07a"];
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const fmtMilhas = (m) => `${fmtN(m / 1000, m % 1000 ? 1 : 0)} mil milhas`;

/** Rosca do orçamento por categoria (usada na ficha e no Painel). */
export function RoscaViagem({ porCat = [], tamanho = 130, centro }) {
  if (!porCat.length) return null;
  return (
    <div style={{ width: tamanho, height: tamanho, position: "relative", flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={porCat} dataKey="valor" nameKey="label" innerRadius={tamanho * 0.32} outerRadius={tamanho * 0.47} paddingAngle={2} stroke="none" isAnimationActive>
            {porCat.map((c) => <Cell key={c.k} fill={CORES_VIAGEM[CATEGORIAS_VIAGEM.findIndex(x => x.k === c.k) % CORES_VIAGEM.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      {centro && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>{centro}</div>}
    </div>
  );
}

/**
 * Ficha de orçamento de uma viagem (pedido 2026-10-02): hotel, carro,
 * passagens (dinheiro, milhas ou misto), etc. Só previsão — não mexe nos
 * números do app.
 */
export default function ViagemOrcamento({ viagem, cambio = {}, hidden, onSalvar, onClose }) {
  const [orc, setOrc] = useState(() => ({ pessoas: 2, itens: [], milheiro: {}, ...(viagem.orcamento || {}) }));
  const [estilo, setEstilo] = useState("conforto");
  const [verMilheiro, setVerMilheiro] = useState(false);
  const dur = duracaoViagem(viagem);
  const r = useMemo(() => resumoOrcamento(orc, cambio, dur), [orc, cambio, dur.dias]);
  const oc = (v) => hidden ? "•••" : fmt(v);

  const mudar = (fn) => setOrc(fn);
  // Salva sozinho a cada mudança (fora do updater: updaters devem ser puros).
  const primeira = useRef(true);
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    onSalvar?.(orc);
  }, [orc]); // eslint-disable-line react-hooks/exhaustive-deps
  const mudarItem = (id, campos) => mudar(o => ({ ...o, itens: o.itens.map(i => i.id === id ? { ...i, ...campos } : i) }));
  const addItem = (cat) => mudar(o => ({ ...o, itens: [...o.itens, { id: novoId(), cat, desc: "", moeda: "BRL", valor: "", pago: false, ...(cat === "passagens" ? { forma: "dinheiro", programa: "Smiles", milhas: "" } : {}) }] }));
  const tirarItem = (id) => mudar(o => ({ ...o, itens: o.itens.filter(i => i.id !== id) }));
  const estimar = () => {
    const novos = estimarOrcamento(estilo, orc.pessoas, dur, true, orc.itens, novoId);
    if (!novos.length) return;
    mudar(o => ({ ...o, itens: [...o.itens, ...novos] }));
  };

  const inp = { padding: "7px 9px", fontSize: 13, borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgSoft, color: T.ink, minWidth: 0 };
  const sel = { ...inp, width: "auto", flex: "0 0 auto", maxWidth: 170 };
  const kpi = (rot, val, cor = T.ink, sub) => (
    <div style={{ background: T.bgSoft, borderRadius: 14, padding: "10px 12px", minWidth: 0 }}>
      <div style={{ fontSize: 10.5, color: T.muted, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{rot}</div>
      <div className="num" style={{ fontSize: 18, fontWeight: 700, color: cor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{val}</div>
      {sub && <div style={{ fontSize: 11, color: T.faint, marginTop: 1 }}>{sub}</div>}
    </div>
  );
  const br = (iso) => iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "";

  return (
    <Modal title={`🧳 ${viagem.titulo}`} onClose={onClose} wide>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {viagem.destino && <span>📍 {viagem.destino}</span>}
        <span>{br(viagem.inicio)}{viagem.fim && viagem.fim !== viagem.inicio ? ` → ${br(viagem.fim)}` : ""} · {dur.dias} dia{dur.dias > 1 ? "s" : ""}{dur.noites ? ` · ${dur.noites} noite${dur.noites > 1 ? "s" : ""}` : ""}</span>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          👥 <input type="number" min="1" value={orc.pessoas} onChange={e => mudar(o => ({ ...o, pessoas: Math.max(1, Number(e.target.value) || 1) }))}
                   style={{ ...inp, width: 56, flex: "0 0 56px", padding: "4px 6px", textAlign: "center" }} /> pessoas
        </label>
      </div>

      {/* Resumo */}
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
        <RoscaViagem porCat={r.porCat} tamanho={130}
          centro={<div><div style={{ fontSize: 10, color: T.muted }}>total</div><div className="num" style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>{hidden ? "•••" : fmt(r.total)}</div></div>} />
        <div style={{ flex: 1, minWidth: 240, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {kpi("💵 Em dinheiro", oc(r.previsto), T.ink, `${oc(r.pago)} já pago`)}
          {kpi("⏳ Falta pagar", oc(r.falta), r.falta > 0 ? T.gold : T.green)}
          {kpi("🎯 Milhas", r.milhas ? fmtMilhas(r.milhas) : "—", T.ink, r.milhas ? `≈ ${oc(r.milhasBRL)}` : "nenhuma")}
          {kpi("👤 Por pessoa", oc(r.porPessoa), T.ink, `${oc(r.porDia)} por dia`)}
        </div>
      </div>
      {r.previsto > 0 && (
        <div style={{ height: 6, borderRadius: 99, background: T.bgSoft, overflow: "hidden", marginBottom: 6 }}>
          <div style={{ width: `${r.pctPago}%`, height: "100%", background: T.green, borderRadius: 99 }} />
        </div>
      )}
      {r.semCambio && <div style={{ fontSize: 11.5, color: T.gold, marginBottom: 6 }}>⚠ Câmbio do dia ainda não carregou — valores em €/US$ ficam fora do total por enquanto.</div>}

      {/* Estimativa rápida */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: 10, borderRadius: 14, border: `1px dashed ${T.border}`, margin: "10px 0 16px" }}>
        <Sparkles size={15} style={{ color: T.gold }} />
        <span style={{ fontSize: 12.5, color: T.muted, flex: "1 1 180px" }}>Montar estimativa (preenche só o que estiver vazio):</span>
        <select value={estilo} onChange={e => setEstilo(e.target.value)} style={sel}>
          {Object.entries(ESTILOS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <button className="btn-ghost" onClick={estimar} style={{ padding: "7px 12px", fontSize: 11 }}>Estimar</button>
      </div>

      {/* Itens por categoria */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {CATEGORIAS_VIAGEM.map((c, ci) => {
          const itens = orc.itens.filter(i => i.cat === c.k);
          const tot = r.porCat.find(x => x.k === c.k)?.valor || 0;
          return (
            <div key={c.k}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: CORES_VIAGEM[ci % CORES_VIAGEM.length] }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: T.ink, flex: 1 }}>{c.icone} {c.label}</span>
                {tot > 0 && <span className="num" style={{ fontSize: 12.5, color: T.muted }}>{oc(tot)}</span>}
                <button onClick={() => addItem(c.k)} aria-label={`Adicionar em ${c.label}`}
                        style={{ background: "transparent", border: `1px solid ${T.border}`, color: T.gold, borderRadius: 99, width: 26, height: 26, minHeight: 0, padding: 0, display: "grid", placeItems: "center", cursor: "pointer" }}>
                  <Plus size={14} />
                </button>
              </div>
              {itens.map(it => {
                const ehPass = c.k === "passagens";
                const forma = it.forma || "dinheiro";
                return (
                  <div key={it.id} style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", padding: 8, borderRadius: 12, background: T.bgSoft, marginBottom: 6, opacity: it.pago ? 0.75 : 1 }}>
                    <input value={it.desc} onChange={e => mudarItem(it.id, { desc: e.target.value })} placeholder={ehPass ? "Trecho (ex.: GRU → LIS)" : "Descrição"}
                           style={{ ...inp, flex: "2 1 160px" }} />
                    {ehPass && (
                      <select value={forma} onChange={e => mudarItem(it.id, { forma: e.target.value })} style={sel}>
                        <option value="dinheiro">💵 Dinheiro</option>
                        <option value="milhas">🎯 Milhas</option>
                        <option value="misto">🔀 Milhas + taxas</option>
                      </select>
                    )}
                    {ehPass && forma !== "dinheiro" && (<>
                      <select value={it.programa || "Smiles"} onChange={e => mudarItem(it.id, { programa: e.target.value })} style={sel}>
                        {PROGRAMAS.map(p => <option key={p}>{p}</option>)}
                      </select>
                      <input type="number" inputMode="numeric" value={it.milhas} onChange={e => mudarItem(it.id, { milhas: e.target.value })} placeholder="milhas"
                             style={{ ...inp, width: 100, flex: "0 0 100px" }} />
                    </>)}
                    {!(ehPass && forma === "milhas") && (<>
                      <select value={it.moeda || "BRL"} onChange={e => mudarItem(it.id, { moeda: e.target.value })} style={{ ...sel, width: 70 }}>
                        {Object.entries(MOEDAS).map(([k, s]) => <option key={k} value={k}>{s}</option>)}
                      </select>
                      <input type="number" inputMode="decimal" value={it.valor} onChange={e => mudarItem(it.id, { valor: e.target.value })}
                             placeholder={ehPass && forma === "misto" ? "taxas" : "valor"} style={{ ...inp, width: 100, flex: "0 0 100px" }} />
                    </>)}
                    <label title="Já pago / já emitido" style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: it.pago ? T.green : T.muted, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!it.pago} onChange={e => mudarItem(it.id, { pago: e.target.checked })} style={{ accentColor: T.green }} /> pago
                    </label>
                    <button onClick={() => tirarItem(it.id)} aria-label="Remover" style={{ background: "transparent", border: "none", color: T.red, cursor: "pointer", padding: 4, minHeight: 0 }}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Valor do milheiro */}
      <div style={{ marginTop: 16, fontSize: 12.5 }}>
        <button onClick={() => setVerMilheiro(v => !v)} style={{ background: "transparent", border: "none", color: T.gold, cursor: "pointer", padding: 0, fontSize: 12.5 }}>
          🎯 Valor do milheiro (R$ por 1.000 milhas) {verMilheiro ? "▲" : "▼"}
        </button>
        {verMilheiro && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginTop: 8 }}>
            {PROGRAMAS.map(p => (
              <label key={p} style={{ display: "flex", alignItems: "center", gap: 6, color: T.muted }}>
                <span style={{ flex: 1 }}>{p}</span>
                <input type="number" inputMode="decimal" value={orc.milheiro?.[p] ?? MILHEIRO_PADRAO[p]}
                       onChange={e => mudar(o => ({ ...o, milheiro: { ...(o.milheiro || {}), [p]: Number(e.target.value) || 0 } }))}
                       style={{ ...inp, width: 70, flex: "0 0 70px" }} />
              </label>
            ))}
          </div>
        )}
      </div>
      <div style={{ fontSize: 11, color: T.faint, marginTop: 12 }}>
        Só previsão: não mexe em saldo, fluxo, "pode gastar" nem patrimônio. Salva sozinho.
      </div>
    </Modal>
  );
}

export { CAT_POR_K };
