import React from "react";
import { Settings } from "lucide-react";
import { T } from "../../../lib/theme.js";
import { LOJA_TODAS } from "../../../lib/negocioLojas.js";

/**
 * Barra de seleção de loja (financeiro do Negócio): nomes das lojas FIXOS no
 * menu (chips clicáveis, sempre à vista) + botão Gerenciar. A loja ativa fica
 * destacada.
 */
export default function LojaSelector({ lojas = [], lojaAtiva, setLojaAtiva, onGerenciar, incluirTodas = true }) {
  const itens = [
    ...(incluirTodas ? [{ id: LOJA_TODAS, nome: "Todas as lojas" }] : []),
    ...lojas,
  ];
  const chip = (ativo) => ({
    background: ativo ? T.gold : "transparent",
    color: ativo ? T.bg : T.ink,
    border: `1px solid ${ativo ? T.gold : T.border}`,
    borderRadius: 999,
    padding: "5px 12px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: T.muted, fontWeight: 700, marginRight: 2 }}>Loja</span>
      {itens.map((l) => (
        <button key={l.id} onClick={() => setLojaAtiva(l.id)} style={chip(lojaAtiva === l.id)}>
          {l.nome}
        </button>
      ))}
      {onGerenciar && (
        <button onClick={onGerenciar} title="Gerenciar lojas"
          style={{ background: "transparent", color: T.muted, border: `1px solid ${T.border}`, borderRadius: 999, padding: "5px 8px", cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
          <Settings size={14} />
        </button>
      )}
    </div>
  );
}
