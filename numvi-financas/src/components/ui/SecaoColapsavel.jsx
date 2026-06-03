import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { T } from "../../lib/theme.js";

/**
 * Seção colapsável com estado persistido (localStorage).
 *
 * Props:
 * - idKey (string, obrigatório): chave única pra lembrar o estado
 * - titulo (string|node): título do cabeçalho
 * - count (number, opcional): badge com contagem ao lado do título
 * - defaultAberto (bool): estado inicial se nunca interagiu (default false = recolhido)
 * - acao (node, opcional): conteúdo à direita do cabeçalho (ex: botão), não dispara o toggle
 * - children: conteúdo que aparece quando aberto
 */
export default function SecaoColapsavel({ idKey, titulo, count, defaultAberto = false, acao, children }) {
  const [aberto, setAberto] = useState(() => {
    try {
      const v = localStorage.getItem(`af4:secao:${idKey}`);
      return v === null ? defaultAberto : v === "1";
    } catch { return defaultAberto; }
  });

  const toggle = () => {
    setAberto(prev => {
      const novo = !prev;
      try { localStorage.setItem(`af4:secao:${idKey}`, novo ? "1" : "0"); } catch {}
      return novo;
    });
  };

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: 6,
        background: T.bgSoft, border: `1px solid ${T.border}`,
        cursor: "pointer",
      }} onClick={toggle}>
        <ChevronRight size={15}
          style={{ color: T.gold, transform: aberto ? "rotate(90deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink, flex: 1 }}>
          {titulo}
          {typeof count === "number" && (
            <span style={{
              marginLeft: 8, fontSize: 10.5, color: T.muted, fontWeight: 500,
              background: T.border, borderRadius: 100, padding: "1px 8px",
            }}>{count}</span>
          )}
        </span>
        {acao && <div onClick={e => e.stopPropagation()}>{acao}</div>}
      </div>
      {aberto && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}
