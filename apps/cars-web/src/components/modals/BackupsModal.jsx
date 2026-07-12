import React, { useEffect, useState } from "react";
import { RotateCcw, Download, Trash2, ShieldCheck, RefreshCw } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import { listarBackups, obterBackup, apagarBackup } from "../../lib/autobackup.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import Modal from "../ui/Modal.jsx";

const fmtBytes = (b) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtData = (ts) => {
  try { return new Date(ts).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return "—"; }
};

/**
 * Pontos de restauração locais (backups automáticos em IndexedDB). Lista os
 * snapshots e deixa restaurar / baixar / apagar. A criação é automática
 * (diária + antes de ações destrutivas) — aqui é só gestão/recuperação.
 */
export default function BackupsModal({ onRestaurar, onClose }) {
  const [lista, setLista] = useState(null);

  const recarregar = () => listarBackups().then(setLista).catch(() => setLista([]));
  useEffect(() => { recarregar(); }, []);

  const baixar = async (b) => {
    const dados = await obterBackup(b.id);
    if (!dados) { toast.error("Backup não encontrado."); return; }
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `afinancas-backup-${new Date(b.ts).toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restaurar = async (b) => {
    const ok = await confirm({
      title: "Restaurar este ponto?",
      body: `Vai substituir os dados atuais pelos de ${fmtData(b.ts)}. Um ponto de restauração do estado atual é criado antes, por segurança.`,
      confirmLabel: "Restaurar",
    });
    if (!ok) return;
    await onRestaurar?.(b.id);
  };

  const apagar = async (b) => {
    const ok = await confirm({ title: "Apagar este ponto?", body: `${fmtData(b.ts)} será removido.`, danger: true, confirmLabel: "Apagar" });
    if (!ok) return;
    await apagarBackup(b.id);
    recarregar();
    toast.success("Ponto de restauração apagado.");
  };

  return (
    <Modal title="Pontos de restauração" onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
        <ShieldCheck size={15} style={{ color: T.green }} />
        Cópias automáticas do seus dados (diárias + antes de ações que apagam).
        Ficam só neste aparelho.
      </div>

      {lista == null ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13 }}>Carregando…</div>
      ) : lista.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13, fontStyle: "italic", border: `1px dashed ${T.border}`, borderRadius: 12 }}>
          Ainda não há pontos de restauração. O primeiro é criado automaticamente ao usar o app.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
          {lista.map((b) => (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: T.bgSoft, border: `1px solid ${T.border}`, borderRadius: 11, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, color: T.ink, fontWeight: 600 }}>{fmtData(b.ts)}</div>
                <div style={{ fontSize: 10.5, color: T.muted }}>{b.motivo} · {fmtBytes(b.bytes)}</div>
              </div>
              <button onClick={() => restaurar(b)} className="btn-gold" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 5 }}>
                <RotateCcw size={12} /> Restaurar
              </button>
              <button onClick={() => baixar(b)} title="Baixar JSON" style={btn}><Download size={13} /></button>
              <button onClick={() => apagar(b)} title="Apagar" style={{ ...btn, color: T.red, borderColor: `${T.red}55` }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center mt-5">
        <button onClick={recarregar} className="btn-ghost" style={{ fontSize: 11, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <RefreshCw size={12} /> Atualizar
        </button>
        <button onClick={onClose} className="btn-ghost">Fechar</button>
      </div>
    </Modal>
  );
}

const btn = { background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 9, padding: "6px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center" };
