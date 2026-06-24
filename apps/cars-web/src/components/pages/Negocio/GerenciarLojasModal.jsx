import React, { useState } from "react";
import { Plus, Trash2, Check, X } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { uid } from "../../../lib/format.js";
import { toast } from "../../../lib/toast.js";
import { confirm } from "../../../lib/confirm.js";
import Modal from "../../ui/Modal.jsx";

/**
 * Gerenciar lojas do Negócio: criar "Loja N", renomear (inline) e excluir.
 * Exclusão bloqueada se a loja tiver lançamentos (temItens) ou for a única.
 */
export default function GerenciarLojasModal({ lojas = [], setLojas, lojaAtiva, setLojaAtiva, temItens, onClose }) {
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");

  const criar = () => {
    const nome = `Loja ${lojas.length + 1}`;
    setLojas([...lojas, { id: uid(), nome }]);
    toast.success(`${nome} criada.`);
  };
  const salvarNome = (l) => {
    const nome = editNome.trim();
    if (!nome) { toast.error("Nome obrigatório."); return; }
    setLojas(lojas.map((x) => (x.id === l.id ? { ...x, nome } : x)));
    setEditId(null); setEditNome("");
  };
  const excluir = async (l) => {
    if (lojas.length <= 1) { toast.error("Tem que existir ao menos uma loja."); return; }
    if (temItens && temItens(l.id)) {
      toast.error("Essa loja tem lançamentos financeiros. Remova ou mova antes de excluir.");
      return;
    }
    const ok = await confirm({ title: `Excluir "${l.nome}"?`, body: "A loja será removida.", danger: true, confirmLabel: "Excluir" });
    if (!ok) return;
    const resto = lojas.filter((x) => x.id !== l.id);
    setLojas(resto);
    if (lojaAtiva === l.id) setLojaAtiva(resto[0].id);
    toast.success("Loja excluída.");
  };

  return (
    <Modal title="Gerenciar lojas" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {lojas.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 12 }}>
            {editId === l.id ? (
              <>
                <input autoFocus value={editNome} onChange={(e) => setEditNome(e.target.value)}
                       onKeyDown={(e) => { if (e.key === "Enter") salvarNome(l); }} style={{ flex: 1 }} />
                <button className="btn-gold" style={{ padding: "4px 8px" }} onClick={() => salvarNome(l)}><Check size={13} /></button>
                <button className="btn-ghost" style={{ padding: "4px 8px" }} onClick={() => { setEditId(null); setEditNome(""); }}><X size={13} /></button>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.ink }}>{l.nome}</span>
                <button onClick={() => { setEditId(l.id); setEditNome(l.nome); }} title="Renomear"
                        style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>Renomear</button>
                <button onClick={() => excluir(l)} title="Excluir"
                        style={{ background: "transparent", color: T.red, border: `1px solid ${T.red}55`, borderRadius: 8, padding: "4px 8px", cursor: "pointer" }}><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-4">
        <button className="btn-gold" onClick={criar}><Plus size={14} className="inline mr-1" /> Nova loja</button>
        <button className="btn-ghost" onClick={onClose}>Fechar</button>
      </div>
    </Modal>
  );
}
