import React, { useMemo, useState } from "react";
import { Sparkles, ChevronRight, ChevronDown, Check } from "lucide-react";
import { T } from "../../lib/theme.js";
import { fmt } from "../../lib/format.js";
import Modal from "../ui/Modal.jsx";
import { sugerirCategorias } from "../../lib/autoCategorizar.js";

// Preview + aprovação da auto-categorização das transações em "Outros"/sem
// categoria. Nada é aplicado sem o usuário clicar "Aplicar" — e só o que ficou
// marcado. onAplicar recebe um mapa { idTransacao: categoriaNome }.
export default function AutoCategorizarModal({ transacoes = [], categorias = [], onClose, onAplicar }) {
  const { sugestoes, porCategoria, semSugestao } = useMemo(
    () => sugerirCategorias(transacoes, categorias),
    [transacoes, categorias],
  );

  const [excluidos, setExcluidos] = useState(() => new Set()); // ids desmarcados
  const [abertos, setAbertos] = useState(() => new Set());     // grupos expandidos

  const cats = Object.keys(porCategoria).sort(
    (a, b) => porCategoria[b].length - porCategoria[a].length,
  );

  const toggleItem = (id) => setExcluidos((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const toggleGrupo = (cat) => setExcluidos((s) => {
    const n = new Set(s);
    const ids = porCategoria[cat].map((x) => x.id);
    const todosMarcados = ids.every((id) => !n.has(id));
    if (todosMarcados) ids.forEach((id) => n.add(id)); // desmarca todos
    else ids.forEach((id) => n.delete(id));            // marca todos
    return n;
  });
  const toggleAberto = (cat) => setAbertos((s) => {
    const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n;
  });

  const aprovadas = sugestoes.filter((s) => !excluidos.has(s.id));

  const aplicar = () => {
    const mapa = {};
    aprovadas.forEach((s) => { mapa[s.id] = s.sugerida; });
    onAplicar?.(mapa);
    onClose?.();
  };

  return (
    <Modal title="✨ Auto-categorizar" onClose={onClose} wide>
      <div style={{ fontSize: 12.5, color: T.muted, marginBottom: 12 }}>
        Sugestões pela descrição, só pras transações em <b>Outros</b> ou sem categoria.
        Revise, desmarque o que não quiser e clique em <b>Aplicar</b>. Dá pra desfazer.
      </div>

      {sugestoes.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: T.faint, fontSize: 13, fontStyle: "italic" }}>
          Nenhuma sugestão automática no momento.
          {semSugestao > 0 && ` (${semSugestao} sem descrição reconhecível — ajuste manual.)`}
        </div>
      ) : (
        <>
          <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {cats.map((cat) => {
              const itens = porCategoria[cat];
              const ids = itens.map((x) => x.id);
              const marcados = ids.filter((id) => !excluidos.has(id)).length;
              const total = itens.filter((x) => !excluidos.has(x.id)).reduce((s, x) => s + x.valor, 0);
              const aberto = abertos.has(cat);
              const algum = marcados > 0;
              return (
                <div key={cat} style={{ border: `1px solid ${T.border}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: T.bgSoft }}>
                    <button onClick={() => toggleGrupo(cat)} title={algum ? "Desmarcar grupo" : "Marcar grupo"}
                      style={{ width: 18, height: 18, borderRadius: 5, border: `1px solid ${algum ? T.gold : T.border}`, background: algum ? T.gold : "transparent", color: T.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                      {algum && <Check size={12} />}
                    </button>
                    <button onClick={() => toggleAberto(cat)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}>
                      {aberto ? <ChevronDown size={13} style={{ color: T.muted }} /> : <ChevronRight size={13} style={{ color: T.muted }} />}
                      <span style={{ fontWeight: 700, color: T.ink, fontSize: 13 }}>{cat}</span>
                      <span style={{ fontSize: 11, color: T.muted }}>· {marcados}/{itens.length}</span>
                    </button>
                    <span className="num" style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>{fmt(total)}</span>
                  </div>
                  {aberto && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {itens.map((x) => {
                        const marcado = !excluidos.has(x.id);
                        return (
                          <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px 7px 34px", borderTop: `1px solid ${T.border}`, opacity: marcado ? 1 : 0.5 }}>
                            <button onClick={() => toggleItem(x.id)}
                              style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${marcado ? T.gold : T.border}`, background: marcado ? T.gold : "transparent", color: T.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                              {marcado && <Check size={11} />}
                            </button>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {x.descricao || "(sem descrição)"}
                              <span style={{ color: T.faint }}> · {x.atual || "sem categoria"} → </span>
                              <span style={{ color: T.gold, fontWeight: 600 }}>{x.sugerida}</span>
                            </span>
                            <span className="num" style={{ fontSize: 11.5, color: x.tipo === "receita" ? T.green : T.muted, flexShrink: 0 }}>{fmt(x.valor)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {semSugestao > 0 && (
            <div style={{ fontSize: 11, color: T.faint, marginTop: 10, fontStyle: "italic" }}>
              {semSugestao} transaç{semSugestao === 1 ? "ão" : "ões"} sem descrição reconhecível ficaram de fora — ajuste manual pelo dropdown de categoria.
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center" }}>
            <button className="btn-gold" onClick={aplicar} disabled={aprovadas.length === 0}
              style={{ opacity: aprovadas.length === 0 ? 0.5 : 1 }}>
              <Sparkles size={14} className="inline mr-2" />
              Aplicar {aprovadas.length > 0 ? `(${aprovadas.length})` : ""}
            </button>
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          </div>
        </>
      )}
    </Modal>
  );
}
