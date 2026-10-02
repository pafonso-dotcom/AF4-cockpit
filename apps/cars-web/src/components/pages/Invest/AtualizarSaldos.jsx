import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { fmt } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { aplicarAtualizacao, ehRendaFixa } from "../../../lib/atualizarSaldos.js";
import Modal from "../../ui/Modal.jsx";

/**
 * 🔄 Atualizar saldos da renda fixa (pedido 2026-10-02): digite o saldo e o
 * rendimento como aparecem no app do banco — o resto o app calcula
 * (preço médio = saldo − rendimento). Também dá pra incluir aplicação nova.
 */
const novaLinha = () => ({ id: Math.random().toString(36).slice(2, 9), nome: "", saldo: "", rendimento: "", indexador: "cdi", taxa: "", vencimento: "", liquidez: "vencimento" });

export default function AtualizarSaldos({ ativos = [], setAtivos, hidden, onClose }) {
  const rf = ativos.filter(ehRendaFixa);
  const [edits, setEdits] = useState(() => Object.fromEntries(rf.map(a => [a.id, {
    saldo: "", rendimento: "", taxa: a.rfTaxa ?? "", vencimento: a.vencimento || "", liquidez: a.liquidez || "vencimento",
  }])));
  const [novas, setNovas] = useState(rf.length ? [] : [novaLinha()]);
  const set = (id, k, v) => setEdits(e => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const setNova = (id, k, v) => setNovas(n => n.map(x => x.id === id ? { ...x, [k]: v } : x));

  const salvar = () => {
    const linhas = [];
    for (const a of rf) {
      const e = edits[a.id];
      if (!e || e.saldo === "") continue;
      linhas.push({ alvo: a, lido: { tipo: a.tipo, saldo: e.saldo, rendimento: e.rendimento, indexador: a.rfIndexador || (e.taxa ? "cdi" : null), taxa: e.taxa, vencimento: e.vencimento || null, liquidez: e.liquidez } });
    }
    for (const n of novas) {
      if (!n.nome.trim() || n.saldo === "") continue;
      linhas.push({ ticker: n.nome.trim(), lido: { nome: n.nome.trim(), tipo: "cdb", saldo: n.saldo, rendimento: n.rendimento, indexador: n.indexador, taxa: n.taxa, vencimento: n.vencimento || null, liquidez: n.liquidez } });
    }
    if (!linhas.length) { toast.info("Preencha o saldo de pelo menos uma aplicação."); return; }
    setAtivos(aplicarAtualizacao(ativos, linhas));
    toast.success(`🔄 ${linhas.length} aplicação(ões) atualizada(s).`);
    onClose?.();
  };

  const inp = { padding: "8px 10px", fontSize: 13, borderRadius: 10, minWidth: 0, width: "100%" };
  const rot = { fontSize: 10.5, color: T.muted, fontWeight: 600, marginBottom: 3 };
  const campo = (label, el) => <label style={{ display: "block", minWidth: 0 }}><div style={rot}>{label}</div>{el}</label>;
  const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 8 };

  return (
    <Modal title="🔄 Atualizar saldos · Renda fixa" onClose={onClose} wide>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 14 }}>
        Copie do app do banco o <b>Saldo</b> e o <b>Rendimento</b> de cada aplicação. Deixe em branco o que não mudou.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rf.map(a => {
          const e = edits[a.id];
          const aplicado = e.saldo !== "" && e.rendimento !== "" ? Number(String(e.saldo).replace(",", ".")) - Number(String(e.rendimento).replace(",", ".")) : null;
          return (
            <div key={a.id} style={{ padding: 12, borderRadius: 14, background: T.bgSoft, border: `1px solid ${e.saldo !== "" ? T.gold : "transparent"}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <b style={{ fontSize: 13.5, color: T.ink }}>{a.ticker}</b>
                <span style={{ fontSize: 11.5, color: T.muted }}>hoje no app: {hidden ? "•••" : fmt((Number(a.qtd) || 0) * (Number(a.preco) || 0))}{a.saldoAtualizadoEm ? ` · atualizado ${a.saldoAtualizadoEm.split("-").reverse().join("/")}` : ""}</span>
              </div>
              <div style={grade}>
                {campo("Saldo (R$)", <input inputMode="decimal" value={e.saldo} onChange={ev => set(a.id, "saldo", ev.target.value)} placeholder="6228,67" style={inp} />)}
                {campo("Rendimento (R$)", <input inputMode="decimal" value={e.rendimento} onChange={ev => set(a.id, "rendimento", ev.target.value)} placeholder="228,67" style={inp} />)}
                {campo("% do CDI", <input inputMode="decimal" value={e.taxa} onChange={ev => set(a.id, "taxa", ev.target.value)} placeholder="104,5" style={inp} />)}
                {campo("Vencimento", <input type="date" value={e.vencimento} onChange={ev => set(a.id, "vencimento", ev.target.value)} style={inp} />)}
                {campo("Resgate", <select value={e.liquidez} onChange={ev => set(a.id, "liquidez", ev.target.value)} style={inp}><option value="vencimento">No vencimento</option><option value="diaria">Diário</option></select>)}
              </div>
              {aplicado != null && Number.isFinite(aplicado) && <div style={{ fontSize: 11.5, color: T.green, marginTop: 6 }}>Valor aplicado calculado: {fmt(aplicado)}</div>}
            </div>
          );
        })}

        {novas.map(n => (
          <div key={n.id} style={{ padding: 12, borderRadius: 14, border: `1px dashed ${T.gold}`, position: "relative" }}>
            <button onClick={() => setNovas(v => v.filter(x => x.id !== n.id))} aria-label="Remover" style={{ position: "absolute", top: 8, right: 8, background: "transparent", border: "none", color: T.red, cursor: "pointer", minHeight: 0 }}><Trash2 size={14} /></button>
            <div style={{ ...rot, color: T.gold, marginBottom: 8 }}>NOVA APLICAÇÃO</div>
            <div style={grade}>
              <div style={{ gridColumn: "1 / -1" }}>{campo("Nome (como no banco)", <input value={n.nome} onChange={ev => setNova(n.id, "nome", ev.target.value)} placeholder="CDB PICPAY JUN/2028" style={inp} />)}</div>
              {campo("Saldo (R$)", <input inputMode="decimal" value={n.saldo} onChange={ev => setNova(n.id, "saldo", ev.target.value)} style={inp} />)}
              {campo("Rendimento (R$)", <input inputMode="decimal" value={n.rendimento} onChange={ev => setNova(n.id, "rendimento", ev.target.value)} style={inp} />)}
              {campo("% do CDI", <input inputMode="decimal" value={n.taxa} onChange={ev => setNova(n.id, "taxa", ev.target.value)} style={inp} />)}
              {campo("Vencimento", <input type="date" value={n.vencimento} onChange={ev => setNova(n.id, "vencimento", ev.target.value)} style={inp} />)}
              {campo("Resgate", <select value={n.liquidez} onChange={ev => setNova(n.id, "liquidez", ev.target.value)} style={inp}><option value="vencimento">No vencimento</option><option value="diaria">Diário</option></select>)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <button className="btn-ghost" onClick={() => setNovas(v => [...v, novaLinha()])}><Plus size={13} className="inline mr-1" /> Adicionar aplicação</button>
        <button className="btn-gold" onClick={salvar} style={{ marginLeft: "auto" }}>Salvar</button>
      </div>
    </Modal>
  );
}
