import React, { useMemo, useState } from "react";
import { Plus, Trash2, Sparkles, Pin, PinOff, Search } from "lucide-react";
import { T } from "../../lib/theme.js";
import { uid } from "../../lib/format.js";
import { toast } from "../../lib/toast.js";
import { confirm } from "../../lib/confirm.js";
import PageHeader from "../ui/PageHeader.jsx";

/**
 * Ideias — brain dump livre. Sem data, sem categoria.
 * Cada ideia: { id, texto, pinned, createdAt }
 * Pode ser projeto, lembrança, link, frase, qualquer coisa.
 */
export default function Ideias({ ideias = [], setIdeias }) {
  const [novo, setNovo] = useState("");
  const [busca, setBusca] = useState("");

  const adicionar = () => {
    const t = novo.trim();
    if (!t) return;
    const item = {
      id: uid(),
      texto: t,
      pinned: false,
      createdAt: new Date().toISOString(),
    };
    setIdeias([item, ...ideias]);
    setNovo("");
  };

  const togglePin = (item) => {
    setIdeias(ideias.map(i => i.id === item.id ? { ...i, pinned: !i.pinned } : i));
  };

  const editar = (item, texto) => {
    setIdeias(ideias.map(i => i.id === item.id ? { ...i, texto } : i));
  };

  const excluir = async (item) => {
    const ok = await confirm({
      title: "Excluir ideia?",
      message: item.texto.slice(0, 80) + (item.texto.length > 80 ? "…" : ""),
      confirmLabel: "Excluir",
      destructive: true,
    });
    if (!ok) return;
    setIdeias(ideias.filter(i => i.id !== item.id));
    toast.success("Ideia removida.");
  };

  const { fixadas, soltas } = useMemo(() => {
    const term = busca.trim().toLowerCase();
    const filtrar = (i) => !term || (i.texto || "").toLowerCase().includes(term);
    const ordemDesc = (a, b) => (b.createdAt || "").localeCompare(a.createdAt || "");
    return {
      fixadas: ideias.filter(i => i.pinned).filter(filtrar).sort(ordemDesc),
      soltas:  ideias.filter(i => !i.pinned).filter(filtrar).sort(ordemDesc),
    };
  }, [ideias, busca]);

  return (
    <div className="fade-up py-8">
      <PageHeader
        eyebrow="Brain Dump"
        title="Ideias"
        sub="Anote agora, organize depois. Sem data, sem categoria."
      />

      {/* Quick add */}
      <div style={{
        background: T.card, border: `1px solid ${T.border}`, borderRadius: 10,
        padding: 12, marginBottom: 12,
      }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <textarea value={novo}
                    onChange={e => setNovo(e.target.value)}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        adicionar();
                      }
                    }}
                    placeholder="O que veio na cabeça? (Cmd/Ctrl+Enter pra salvar)"
                    rows={2}
                    style={{ flex: "1 1 280px", minWidth: 200, fontSize: 14, fontFamily: T.body, resize: "vertical" }} />
          <button className="btn-gold" onClick={adicionar} disabled={!novo.trim()}>
            <Plus size={14} className="inline mr-1" />Salvar
          </button>
        </div>
      </div>

      {/* Busca */}
      {ideias.length > 3 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <Search size={14} style={{ color: T.muted }} />
          <input value={busca}
                 onChange={e => setBusca(e.target.value)}
                 placeholder="Buscar nas ideias…"
                 style={{ flex: 1, fontSize: 13 }} />
        </div>
      )}

      {ideias.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "60px 24px",
          background: T.card, border: `1px dashed ${T.border}`, borderRadius: 12,
        }}>
          <Sparkles size={36} style={{ color: T.gold, marginBottom: 12 }} />
          <h3 style={{ fontFamily: T.serif, fontSize: 20, color: T.ink, margin: "0 0 8px", fontWeight: 600 }}>
            Sem ideias ainda
          </h3>
          <p style={{ color: T.muted, fontSize: 13, margin: 0 }}>
            Solte tudo que vier — depois você decide o que vira projeto.
          </p>
        </div>
      ) : (
        <>
          {fixadas.length > 0 && (
            <>
              <SectionLabel>Fixadas ({fixadas.length})</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {fixadas.map(i => (
                  <IdeiaCard key={i.id} item={i}
                             onTogglePin={togglePin} onExcluir={excluir} onEditar={editar} />
                ))}
              </div>
            </>
          )}

          {soltas.length > 0 && (
            <>
              {fixadas.length > 0 && <SectionLabel>Outras ({soltas.length})</SectionLabel>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {soltas.map(i => (
                  <IdeiaCard key={i.id} item={i}
                             onTogglePin={togglePin} onExcluir={excluir} onEditar={editar} />
                ))}
              </div>
            </>
          )}

          {fixadas.length === 0 && soltas.length === 0 && busca.trim() && (
            <div style={{ textAlign: "center", color: T.muted, fontSize: 13, padding: 24 }}>
              Nenhuma ideia encontrada pra "{busca}".
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, color: T.muted, letterSpacing: ".1em",
      textTransform: "uppercase", fontWeight: 600, marginBottom: 6, marginTop: 4,
    }}>
      {children}
    </div>
  );
}

function IdeiaCard({ item, onTogglePin, onExcluir, onEditar }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(item.texto);

  const salvar = () => {
    const t = texto.trim();
    if (!t) return;
    onEditar(item, t);
    setEditando(false);
  };

  const data = item.createdAt ? new Date(item.createdAt) : null;
  const dataLbl = data
    ? data.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
    : "";

  return (
    <div style={{
      background: T.card,
      border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${item.pinned ? T.gold : T.border}`,
      borderRadius: 8,
      padding: "10px 12px",
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editando ? (
          <textarea value={texto}
                    onChange={e => setTexto(e.target.value)}
                    onKeyDown={e => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault(); salvar();
                      } else if (e.key === "Escape") {
                        setTexto(item.texto); setEditando(false);
                      }
                    }}
                    autoFocus
                    rows={Math.max(2, texto.split("\n").length)}
                    style={{ width: "100%", fontSize: 13.5, fontFamily: T.body, resize: "vertical" }} />
        ) : (
          <div onClick={() => setEditando(true)}
               style={{
                 fontSize: 13.5, color: T.ink, lineHeight: 1.45,
                 whiteSpace: "pre-wrap", wordBreak: "break-word",
                 cursor: "text",
               }}>
            {item.texto}
          </div>
        )}
        {dataLbl && !editando && (
          <div style={{ fontSize: 10, color: T.faint, marginTop: 4 }}>{dataLbl}</div>
        )}
        {editando && (
          <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
            <button className="btn-gold" onClick={salvar} style={{ padding: "5px 10px", fontSize: 10.5 }}>
              Salvar
            </button>
            <button className="btn-ghost" onClick={() => { setTexto(item.texto); setEditando(false); }}
                    style={{ padding: "5px 10px", fontSize: 10.5 }}>
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <button onClick={() => onTogglePin(item)}
                title={item.pinned ? "Desafixar" : "Fixar"}
                style={{
                  background: "transparent", border: "none",
                  color: item.pinned ? T.gold : T.muted,
                  cursor: "pointer", padding: 8, minHeight: 36, minWidth: 36, display: "grid", placeItems: "center",
                }}>
          {item.pinned ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
        <button onClick={() => onExcluir(item)} title="Excluir"
                style={{
                  background: "transparent", border: "none", color: T.muted,
                  cursor: "pointer", padding: 8, minHeight: 36, minWidth: 36, display: "grid", placeItems: "center",
                }}>
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
