import React from "react";
import { Settings } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { LOJA_TODAS } from "../../../lib/negocioLojas.js";

/**
 * Barra de seleção de loja (financeiro do Negócio): dropdown + botão Gerenciar.
 */
export default function LojaSelector({ lojas = [], lojaAtiva, setLojaAtiva, onGerenciar, incluirTodas = true }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 700 }}>Loja</span>
      <select value={lojaAtiva} onChange={(e) => setLojaAtiva(e.target.value)}
        style={{ background: T.bgSoft, border: `1px solid ${T.border}`, color: T.ink, borderRadius: 8, padding: "5px 10px", fontSize: 12.5, cursor: "pointer", fontWeight: 600 }}>
        {incluirTodas && <option value={LOJA_TODAS}>Todas as lojas</option>}
        {lojas.map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}
      </select>
      {onGerenciar && (
        <button onClick={onGerenciar} title="Gerenciar lojas"
          style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 8, padding: "5px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
          <Settings size={14} />
        </button>
      )}
    </div>
  );
}
