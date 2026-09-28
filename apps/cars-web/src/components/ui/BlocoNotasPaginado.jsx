import React, { useState } from "react";
import { Plus, X } from "lucide-react";
import { T } from "../../lib/theme.js";
import NotasRapidasCard from "./NotasRapidasCard.jsx";

// Bloco de notas do atalho 🗒️ com PÁGINAS (pedido 2026-09-28).
// A página "Geral" é a nota antiga (mesma chave de sempre — nada migra);
// as demais vivem em notasRapidas["pg:<id>"] e a lista de páginas em
// notasRapidas.atalhoPaginas — tudo sincroniza igual às outras notas.
const ATIVA_KEY = "af4:notas-atalho-pagina";

export default function BlocoNotasPaginado({ notasRapidas, setNotasRapidas }) {
  const paginas = [{ id: "geral", nome: "Geral" }, ...(notasRapidas.atalhoPaginas || [])];
  const [ativa, setAtiva] = useState(() => {
    try {
      const salva = localStorage.getItem(ATIVA_KEY);
      return paginas.some(p => p.id === salva) ? salva : "geral";
    } catch { return "geral"; }
  });
  const [novoNome, setNovoNome] = useState(null); // null = não está adicionando

  const trocar = (id) => {
    setAtiva(id);
    try { localStorage.setItem(ATIVA_KEY, id); } catch {}
  };

  const adicionar = () => {
    const nome = (novoNome || "").trim() || `Página ${paginas.length + 1}`;
    const id = Date.now().toString(36);
    setNotasRapidas(p => ({ ...p, atalhoPaginas: [...(p.atalhoPaginas || []), { id, nome }] }));
    setNovoNome(null);
    trocar(id);
  };

  const remover = (pg) => {
    if (!window.confirm(`Apagar a página "${pg.nome}" e o que está escrito nela?`)) return;
    setNotasRapidas(p => {
      const n = { ...p, atalhoPaginas: (p.atalhoPaginas || []).filter(x => x.id !== pg.id) };
      delete n["pg:" + pg.id];
      return n;
    });
    trocar("geral");
  };

  const valorDa = (id) => id === "geral" ? notasRapidas.geral : notasRapidas["pg:" + id];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12, alignItems: "center" }}>
        {paginas.map(pg => {
          const on = pg.id === ativa;
          return (
            <button key={pg.id} onClick={() => trocar(pg.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "7px 13px", borderRadius: 100, cursor: "pointer",
                background: on ? `${T.gold}22` : T.bgSoft,
                border: `1px solid ${on ? T.gold : T.border}`,
                color: on ? T.gold : T.muted, fontSize: 13, fontWeight: on ? 700 : 500,
                fontFamily: T.sans, whiteSpace: "nowrap",
              }}>
              {pg.nome}
              {on && pg.id !== "geral" && (
                <X size={13} role="button" aria-label={`Apagar página ${pg.nome}`}
                   onClick={(e) => { e.stopPropagation(); remover(pg); }}
                   style={{ opacity: .8 }} />
              )}
            </button>
          );
        })}
        {novoNome === null ? (
          <button onClick={() => setNovoNome("")} title="Nova página" aria-label="Nova página"
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "7px 12px", borderRadius: 100, cursor: "pointer",
              background: "transparent", border: `1px dashed ${T.border}`,
              color: T.faint, fontSize: 13, fontFamily: T.sans,
            }}>
            <Plus size={14} /> Página
          </button>
        ) : (
          <input autoFocus value={novoNome}
            placeholder="Nome da página"
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") adicionar(); if (e.key === "Escape") setNovoNome(null); }}
            onBlur={() => (novoNome || "").trim() ? adicionar() : setNovoNome(null)}
            style={{
              width: 150, padding: "7px 12px", borderRadius: 100,
              background: T.bgSoft, border: `1px solid ${T.gold}`,
              color: T.ink, fontSize: 13, outline: "none", fontFamily: T.sans,
            }} />
        )}
      </div>
      <NotasRapidasCard
        key={ativa}
        storageKey={ativa === "geral" ? "af4:notas-rapidas:geral:v1" : `af4:notas-rapidas:pg:${ativa}:v1`}
        valor={valorDa(ativa)}
        linhas={12}
        onSalvar={(t) => setNotasRapidas(p => ativa === "geral" ? { ...p, geral: t } : { ...p, ["pg:" + ativa]: t })}
        style={{ boxShadow: "none", border: "none", padding: 0, background: "transparent" }} />
    </div>
  );
}
